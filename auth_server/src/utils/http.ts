import type { NextFunction, Request, RequestHandler, Response } from 'express'

export class HttpError extends Error {
  constructor(public statusCode: number, message: string, public code?: string) {
    super(message)
  }
}

export const asyncHandler = (handler: RequestHandler): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(handler(req, res, next)).catch(next)

export function notFound(req: Request, res: Response) {
  res.status(404).json({ message: `Not found: ${req.originalUrl}` })
}

export function errorHandler(
  error: Error & { statusCode?: number; code?: string },
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  const statusCode = error.statusCode ?? 500
  res.status(statusCode).json({
    message: statusCode === 500 ? 'Internal server error' : error.message,
    ...(error.code ? { code: error.code } : {}),
    ...(process.env.NODE_ENV !== 'production' && statusCode === 500 ? { detail: error.message } : {}),
  })
}
