import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { and, eq, isNull, gt, or } from 'drizzle-orm'
import { db } from '../db'
import { users, passwordResetTokens } from '../db/schema'
import { HttpError } from '../utils/http'
import { createOtp, verifyOtp } from './otp.service'
import { issueRefreshToken, signAccessToken } from './token.service'
import { env } from '../config/env'

const passwordSchema = z.string()
  .min(12, 'Password must contain at least 12 characters')
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[0-9]/, 'Password must contain a number')

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

export async function register(input: {
  username: string
  email: string
  password: string
  confirmPassword: string
  termsAccepted: boolean
  syncPrompts: boolean
}, metadata: { ipAddress?: string; userAgent?: string }) {
  const username = input.username.trim()
  const email = normalizeEmail(input.email)
  if (!/^[a-zA-Z0-9._-]{3,50}$/.test(username)) {
    throw new HttpError(400, 'Username must be 3-50 characters and use letters, numbers, dots, underscores or hyphens')
  }
  const emailResult = z.string().email().safeParse(email)
  if (!emailResult.success) throw new HttpError(400, 'Enter a valid email address')
  if (input.password !== input.confirmPassword) throw new HttpError(400, 'Passwords do not match')
  const passwordResult = passwordSchema.safeParse(input.password)
  if (!passwordResult.success) throw new HttpError(400, passwordResult.error.issues[0].message)
  if (!input.termsAccepted) throw new HttpError(400, 'You must accept the Terms and Privacy Policy')

  const existing = await db.select({ id: users.id })
    .from(users)
    .where(or(eq(users.email, email), eq(users.username, username)))
    .limit(1)
  if (existing.length) throw new HttpError(409, 'An account with that username or email already exists', 'ACCOUNT_EXISTS')

  const passwordHash = await bcrypt.hash(input.password, env.bcryptSaltRounds)
  const [user] = await db.insert(users).values({
    username,
    email,
    passwordHash,
    termsAccepted: true,
    syncPrompts: input.syncPrompts,
  }).returning()
  const challenge = await createOtp(user.id, email, 'registration', metadata)
  return { message: 'Account created. Verify your email to continue.', requiresOtp: true, ...challenge }
}

export async function verifyRegistration(challengeId: string, code: string, metadata: { ipAddress?: string; userAgent?: string }) {
  const challenge = await verifyOtp(challengeId, code)
  if (challenge.purpose !== 'registration' || !challenge.userId) {
    throw new HttpError(400, 'Invalid verification purpose', 'OTP_PURPOSE')
  }
  const [user] = await db.update(users).set({ emailVerified: true, updatedAt: new Date() })
    .where(eq(users.id, challenge.userId)).returning()
  if (!user) throw new HttpError(400, 'Account unavailable')
  const accessToken = signAccessToken(user)
  const refreshToken = await issueRefreshToken(user, { rememberMe: false, ...metadata })
  return { accessToken, refreshToken, user: publicUser(user) }
}

export async function login(emailInput: string, password: string, metadata: { ipAddress?: string; userAgent?: string }) {
  const email = normalizeEmail(emailInput)
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1)
  if (!user) throw new HttpError(401, 'Invalid email or password', 'INVALID_CREDENTIALS')
  if (!user.isActive) throw new HttpError(403, 'Account is disabled', 'ACCOUNT_DISABLED')
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new HttpError(423, 'Account temporarily locked. Try again later.', 'ACCOUNT_LOCKED')
  }
  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) {
    const attempts = user.failedLoginAttempts + 1
    await db.update(users).set({
      failedLoginAttempts: attempts,
      lockedUntil: attempts >= 10 ? new Date(Date.now() + 15 * 60_000) : null,
      updatedAt: new Date(),
    }).where(eq(users.id, user.id))
    throw new HttpError(401, 'Invalid email or password', 'INVALID_CREDENTIALS')
  }
  if (!user.emailVerified) throw new HttpError(403, 'Verify your email before signing in', 'EMAIL_NOT_VERIFIED')
  await db.update(users).set({ failedLoginAttempts: 0, lockedUntil: null, updatedAt: new Date() })
    .where(eq(users.id, user.id))
  const challenge = await createOtp(user.id, user.email, 'login', metadata)
  return { message: 'Verification code sent', requiresOtp: true, ...challenge }
}

export async function verifyLogin(challengeId: string, code: string, rememberMe: boolean, metadata: { ipAddress?: string; userAgent?: string }) {
  const challenge = await verifyOtp(challengeId, code)
  if (challenge.purpose !== 'login' || !challenge.userId) throw new HttpError(400, 'Invalid verification purpose', 'OTP_PURPOSE')
  const [user] = await db.select().from(users).where(eq(users.id, challenge.userId)).limit(1)
  if (!user || !user.isActive) throw new HttpError(403, 'Account unavailable')
  await db.update(users).set({ lastLoginAt: new Date(), updatedAt: new Date() }).where(eq(users.id, user.id))
  const accessToken = signAccessToken(user)
  const refreshToken = await issueRefreshToken(user, { rememberMe, ...metadata })
  return { accessToken, refreshToken, user: publicUser(user) }
}

export async function forgotPassword(emailInput: string, metadata: { ipAddress?: string; userAgent?: string }) {
  const email = normalizeEmail(emailInput)
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1)
  if (user) await createOtp(user.id, user.email, 'password_reset', metadata)
  return { message: 'If that account exists, a verification code has been sent.' }
}

export async function resetPassword(challengeId: string, code: string, newPassword: string, confirmPassword: string) {
  if (newPassword !== confirmPassword) throw new HttpError(400, 'Passwords do not match')
  const passwordResult = passwordSchema.safeParse(newPassword)
  if (!passwordResult.success) throw new HttpError(400, passwordResult.error.issues[0].message)
  const challenge = await verifyOtp(challengeId, code)
  if (challenge.purpose !== 'password_reset' || !challenge.userId) throw new HttpError(400, 'Invalid verification purpose')
  const passwordHash = await bcrypt.hash(newPassword, env.bcryptSaltRounds)
  await db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash, failedLoginAttempts: 0, lockedUntil: null, updatedAt: new Date() })
      .where(eq(users.id, challenge.userId!))
  })
  return { message: 'Password reset successful' }
}

export async function getMe(userId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  if (!user || !user.isActive) throw new HttpError(401, 'Account unavailable')
  return publicUser(user)
}

function publicUser(user: typeof users.$inferSelect) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    emailVerified: user.emailVerified,
    syncPrompts: user.syncPrompts,
  }
}
