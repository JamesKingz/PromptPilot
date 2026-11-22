import dotenv from 'dotenv'
import path from 'node:path'

dotenv.config({ path: path.resolve(process.cwd(), 'auth_server/.env') })

const nodeEnv = process.env.NODE_ENV ?? 'development'

function requireDatabaseUrl() {
  const url = process.env.DATABASE_URL
  if (!url) {
    if (nodeEnv === 'production') throw new Error('DATABASE_URL is required in production')
    return 'postgresql://james@localhost:5432/PromptPilot'
  }
  return url
}

function secret(name: string, developmentFallback: string) {
  const value = process.env[name]
  if (!value) {
    if (nodeEnv === 'production') throw new Error(`Missing required secret: ${name}`)
    return developmentFallback
  }
  if (nodeEnv === 'production' && value.length < 32) {
    throw new Error(`${name} must contain at least 32 characters in production`)
  }
  return value
}

function parseJwtLifetime(value: string | undefined, fallback: string): number | string {
  const raw = value?.trim() || fallback
  if (/^\d+$/.test(raw)) return Number(raw)
  if (/^\d+(?:\*\d+)+$/.test(raw)) {
    return raw.split('*').reduce((total, part) => total * Number(part), 1)
  }
  return raw
}

const bcryptSaltRounds = Number(process.env.BCRYPT_SALT_ROUNDS) || 12
if (!Number.isInteger(bcryptSaltRounds) || bcryptSaltRounds < 4 || bcryptSaltRounds > 15) {
  throw new Error('BCRYPT_SALT_ROUNDS must be an integer between 4 and 15')
}

export const env = {
  nodeEnv,
  port: Number(process.env.PORT) || 5001,
  databaseUrl: requireDatabaseUrl(),
  jwtSecret: secret('JWT_SECRET', 'promptpilot-development-access-secret-change-me'),
  jwtRefreshSecret: secret('JWT_REFRESH_SECRET', 'promptpilot-development-refresh-secret-change-me'),
  otpHmacSecret: secret('OTP_HMAC_SECRET', 'promptpilot-development-otp-secret-change-me'),
  csrfSecret: secret('CSRF_SECRET', 'promptpilot-development-csrf-secret-change-me'),
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  cookieSecure: process.env.COOKIE_SECURE === 'true',
  cookieSameSite: (process.env.COOKIE_SAMESITE as 'lax' | 'strict' | 'none') ?? 'lax',
  otpExpiryMinutes: Number(process.env.OTP_EXPIRY_MINUTES) || 10,
  otpResendCooldownSeconds: Number(process.env.OTP_RESEND_COOLDOWN_SECONDS) || 60,
  otpMaxAttempts: Number(process.env.OTP_MAX_ATTEMPTS) || 5,
  otpMaxSendsPerWindow: Number(process.env.OTP_MAX_SENDS_PER_WINDOW) || 5,
  otpSendWindowMinutes: Number(process.env.OTP_SEND_WINDOW_MINUTES) || 15,
  passwordResetExpiryMinutes: Number(process.env.PASSWORD_RESET_EXPIRY_MINUTES) || 60,
  otpEmailProvider: (process.env.OTP_EMAIL_PROVIDER ?? 'file') as 'resend' | 'smtp' | 'file',
  jwtExpiresIn: parseJwtLifetime(process.env.JWT_EXPIRES_IN, '15m'),
  jwtRefreshExpiresIn: parseJwtLifetime(process.env.JWT_REFRESH_EXPIRES_IN, '7d'),
  bcryptSaltRounds,
  resendApiKey: process.env.RESEND_API_KEY ?? '',
  resendFromEmail: process.env.RESEND_FROM_EMAIL ?? 'no-reply@example.com',
  resendFromName: process.env.RESEND_FROM_NAME ?? 'PromptPilot',
  smtpHost: process.env.SMTP_HOST ?? '127.0.0.1',
  smtpPort: Number(process.env.SMTP_PORT) || 1025,
  smtpUser: process.env.SMTP_USER ?? '',
  smtpPassword: process.env.SMTP_PASSWORD ?? '',
  smtpFromEmail: process.env.SMTP_FROM_EMAIL ?? 'no-reply@localhost',
  smtpFromName: process.env.SMTP_FROM_NAME ?? 'PromptPilot',
}
