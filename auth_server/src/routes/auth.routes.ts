import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import type { Request, Response } from 'express'
import { getCsrf } from '../middleware/csrf'
import { requireAuth } from '../middleware/auth'
import { asyncHandler, HttpError } from '../utils/http'
import * as auth from '../services/auth.service'
import * as tokenService from '../services/token.service'
import { resendOtp } from '../services/otp.service'
import { env } from '../config/env'

const router = Router()
const refreshCookieName = 'promptpilot_refresh'

const setRefreshCookie = (res: Response, token: string, rememberMe: boolean) => {
  res.cookie(refreshCookieName, token, {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: env.cookieSameSite,
    path: '/api/auth',
    maxAge: (rememberMe ? 30 : 7) * 24 * 60 * 60 * 1000,
  })
}

const clearRefreshCookie = (res: Response) => {
  res.clearCookie(refreshCookieName, {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: env.cookieSameSite,
    path: '/api/auth',
  })
}

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many attempts. Try again later.', code: 'RATE_LIMITED' },
})

const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many verification requests. Try again later.', code: 'RATE_LIMITED' },
})

router.get('/csrf', getCsrf)
router.post('/register', authLimiter, asyncHandler(async (req: Request, res: Response) => {
  const result = await auth.register(req.body, {
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  })
  res.status(201).json(result)
}))

router.post('/verify-registration', otpLimiter, asyncHandler(async (req: Request, res: Response) => {
  const result = await auth.verifyRegistration(String(req.body.challengeId ?? ''), String(req.body.code ?? ''), {
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  })
  setRefreshCookie(res, result.refreshToken, false)
  res.json({ message: 'Email verified', user: result.user, accessToken: result.accessToken })
}))

router.post('/login', authLimiter, asyncHandler(async (req: Request, res: Response) => {
  const result = await auth.login(String(req.body.email ?? ''), String(req.body.password ?? ''), {
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  })
  res.json(result)
}))

router.post('/verify-login', otpLimiter, asyncHandler(async (req: Request, res: Response) => {
  const result = await auth.verifyLogin(
    String(req.body.challengeId ?? ''),
    String(req.body.code ?? ''),
    Boolean(req.body.rememberMe),
    { ipAddress: req.ip, userAgent: req.get('user-agent') },
  )
  setRefreshCookie(res, result.refreshToken, Boolean(req.body.rememberMe))
  res.json({ message: 'Logged in', user: result.user, accessToken: result.accessToken })
}))

router.post('/resend-otp', otpLimiter, asyncHandler(async (req: Request, res: Response) => {
  const challengeId = String(req.body.challengeId ?? '')
  if (!challengeId) throw new HttpError(400, 'Verification session is required')
  const result = await resendOtp(challengeId, { ipAddress: req.ip, userAgent: req.get('user-agent') })
  res.json({ message: 'Verification code sent', requiresOtp: true, ...result })
}))

router.post('/refresh', asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.[refreshCookieName] as string | undefined
  if (!token) throw new HttpError(401, 'Refresh token required', 'REFRESH_REQUIRED')
  const result = await tokenService.refreshAccessToken(token, {
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  })
  setRefreshCookie(res, result.refreshToken, result.rememberMe)
  res.json({ accessToken: result.accessToken })
}))

router.post('/logout', asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.[refreshCookieName] as string | undefined
  if (token) await tokenService.revokeRefreshToken(token)
  clearRefreshCookie(res)
  res.json({ message: 'Logged out' })
}))

router.get('/me', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const result = await auth.getMe(req.auth!.sub)
  res.json({ user: result })
}))

router.post('/forgot-password', authLimiter, asyncHandler(async (req: Request, res: Response) => {
  const result = await auth.forgotPassword(String(req.body.email ?? ''), {
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  })
  res.json(result)
}))

router.post('/reset-password', otpLimiter, asyncHandler(async (req: Request, res: Response) => {
  const result = await auth.resetPassword(
    String(req.body.challengeId ?? ''),
    String(req.body.code ?? ''),
    String(req.body.newPassword ?? ''),
    String(req.body.confirmPassword ?? ''),
  )
  res.json(result)
}))

export default router
