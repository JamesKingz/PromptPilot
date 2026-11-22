import crypto from 'node:crypto'
import type { Request, Response, NextFunction } from 'express'
import { env } from '../config/env'

export const csrfCookieName = 'promptpilot_csrf'

export function getCsrf(req: Request, res: Response) {
  let token = req.cookies?.[csrfCookieName]
  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    token = crypto.randomBytes(32).toString('hex')
  }
  res.cookie(csrfCookieName, token, {
    httpOnly: false,
    secure: env.cookieSecure,
    sameSite: env.cookieSameSite,
    path: '/',
  })
  res.json({ csrfToken: token })
}

export function validateCsrf(req: Request, res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next()
  const cookieToken = req.cookies?.[csrfCookieName]
  const headerToken = req.get('x-csrf-token')
  if (
    !cookieToken ||
    !headerToken ||
    cookieToken.length !== headerToken.length ||
    !crypto.timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken))
  ) {
    res.status(403).json({ message: 'Invalid CSRF token', code: 'CSRF_INVALID' })
    return
  }
  next()
}

export function validateOrigin(req: Request, res: Response, next: NextFunction) {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    const origin = req.get('origin')
    if (origin && !env.allowedOrigins.includes(origin)) {
      res.status(403).json({ message: 'Origin is not allowed', code: 'ORIGIN_INVALID' })
      return
    }
  }
  next()
}
