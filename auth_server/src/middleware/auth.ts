import type { Request, Response, NextFunction, RequestHandler } from 'express'
import { verifyAccessToken } from '../services/token.service'
import { getMe } from '../services/auth.service'

declare global {
  namespace Express {
    interface Request {
      auth?: { sub: string; username: string; email: string }
    }
  }
}

export const requireAuth: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  const header = req.headers.authorization
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined
  if (!token) {
    res.status(401).json({ message: 'Authentication required', code: 'AUTH_REQUIRED' })
    return
  }
  try {
    const payload = verifyAccessToken(token)
    void getMe(payload.sub).then((user) => {
      req.auth = { sub: payload.sub, username: user.username, email: user.email }
      next()
    }).catch(next)
  } catch (error) {
    next(error)
  }
}
