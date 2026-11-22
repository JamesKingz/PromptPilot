import crypto from 'node:crypto'
import { appendFile } from 'node:fs/promises'
import path from 'node:path'
import nodemailer from 'nodemailer'
import { and, eq, gt, isNull } from 'drizzle-orm'
import { db } from '../db'
import { otpChallenges } from '../db/schema'
import { env } from '../config/env'
import { HttpError } from '../utils/http'

export type OtpPurpose = 'registration' | 'login' | 'password_reset'

async function deliverOtp(email: string, code: string, purpose: OtpPurpose) {
  const expiryMinutes = purpose === 'password_reset'
    ? env.passwordResetExpiryMinutes
    : env.otpExpiryMinutes
  const text = `Your verification code is ${code}. It expires in ${expiryMinutes} minutes.`
  const subject = `Your PromptPilot ${purpose.replace('_', ' ')} code`

  if (env.otpEmailProvider === 'resend') {
    if (!env.resendApiKey) {
      throw new HttpError(503, 'Resend is not configured', 'EMAIL_PROVIDER_MISSING')
    }
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${env.resendFromName} <${env.resendFromEmail}>`,
        to: [email],
        subject,
        text,
      }),
    })
    if (!response.ok) {
      throw new HttpError(502, 'Could not deliver verification email', 'EMAIL_DELIVERY_FAILED')
    }
  } else if (env.otpEmailProvider === 'smtp') {
    const transporter = nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      secure: process.env.SMTP_SECURE === 'true',
      auth: env.smtpUser ? {
        user: env.smtpUser,
        pass: env.smtpPassword,
      } : undefined,
    })
    await transporter.sendMail({
      from: `${env.smtpFromName} <${env.smtpFromEmail}>`,
      to: email,
      subject,
      text,
    })
  } else if (env.otpEmailProvider === 'file' && env.nodeEnv !== 'production') {
    const mailboxPath = path.resolve(process.cwd(), 'auth_server/.otp-mailbox.log')
    await appendFile(mailboxPath, `${JSON.stringify({
      createdAt: new Date().toISOString(),
      to: email,
      subject,
      text,
    })}\n`, 'utf8')
    console.info(`[PromptPilot OTP] ${email}: ${code}`)
  } else {
    throw new HttpError(503, 'Email delivery is not configured', 'EMAIL_PROVIDER_MISSING')
  }
}

export async function createOtp(
  userId: string | null,
  email: string,
  purpose: OtpPurpose,
  metadata: { ipAddress?: string; userAgent?: string },
) {
  const now = new Date()
  const since = new Date(now.getTime() - env.otpSendWindowMinutes * 60_000)
  const recent = await db.select({ id: otpChallenges.id })
    .from(otpChallenges)
    .where(and(eq(otpChallenges.email, email), eq(otpChallenges.purpose, purpose), gt(otpChallenges.createdAt, since)))
  if (recent.length >= env.otpMaxSendsPerWindow) {
    throw new HttpError(429, 'Too many verification codes requested. Try again later.', 'OTP_RATE_LIMITED')
  }

  const id = crypto.randomUUID()
  const code = String(crypto.randomInt(100000, 1000000))
  const codeHash = crypto.createHmac('sha256', env.otpHmacSecret).update(`${id}:${code}`).digest('hex')
  const expiryMinutes = purpose === 'password_reset'
    ? env.passwordResetExpiryMinutes
    : env.otpExpiryMinutes
  await db.update(otpChallenges).set({ supersededAt: now })
    .where(and(
      eq(otpChallenges.email, email),
      eq(otpChallenges.purpose, purpose),
      isNull(otpChallenges.consumedAt),
      isNull(otpChallenges.supersededAt),
    ))
  await db.insert(otpChallenges).values({
    id,
    userId,
    email,
    purpose,
    codeHash,
    expiresAt: new Date(now.getTime() + expiryMinutes * 60_000),
    resendAvailableAt: new Date(now.getTime() + env.otpResendCooldownSeconds * 1000),
    maxAttempts: env.otpMaxAttempts,
    ipAddress: metadata.ipAddress,
    userAgent: metadata.userAgent,
  })
  await deliverOtp(email, code, purpose)
  return {
    challengeId: id,
    expiresAt: new Date(now.getTime() + expiryMinutes * 60_000),
    resendAvailableAt: new Date(now.getTime() + env.otpResendCooldownSeconds * 1000),
  }
}

export async function resendOtp(challengeId: string, metadata: { ipAddress?: string; userAgent?: string }) {
  const [old] = await db.select().from(otpChallenges).where(eq(otpChallenges.id, challengeId)).limit(1)
  if (!old || old.consumedAt || old.supersededAt) {
    throw new HttpError(400, 'Verification session is no longer valid', 'OTP_INVALID')
  }
  if (old.resendAvailableAt > new Date()) {
    throw new HttpError(429, 'Please wait before requesting another code', 'OTP_COOLDOWN')
  }
  return createOtp(old.userId, old.email, old.purpose as OtpPurpose, metadata)
}

export async function verifyOtp(challengeId: string, code: string) {
  const [challenge] = await db.select().from(otpChallenges).where(eq(otpChallenges.id, challengeId)).limit(1)
  if (!challenge || challenge.consumedAt || challenge.supersededAt) {
    throw new HttpError(400, 'Verification session is invalid or expired', 'OTP_INVALID')
  }
  if (challenge.expiresAt <= new Date()) {
    throw new HttpError(400, 'Verification code expired', 'OTP_EXPIRED')
  }
  if (challenge.attempts >= challenge.maxAttempts) {
    throw new HttpError(429, 'Too many verification attempts', 'OTP_ATTEMPTS')
  }
  const candidate = crypto.createHmac('sha256', env.otpHmacSecret)
    .update(`${challenge.id}:${code}`)
    .digest('hex')
  if (!crypto.timingSafeEqual(Buffer.from(candidate, 'hex'), Buffer.from(challenge.codeHash, 'hex'))) {
    await db.update(otpChallenges).set({ attempts: challenge.attempts + 1 })
      .where(eq(otpChallenges.id, challenge.id))
    throw new HttpError(400, 'Invalid verification code', 'OTP_INVALID')
  }
  await db.update(otpChallenges).set({ consumedAt: new Date() })
    .where(eq(otpChallenges.id, challenge.id))
  return challenge
}
