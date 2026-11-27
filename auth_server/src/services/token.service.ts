import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { and, eq, isNull, ne } from 'drizzle-orm'
import { db } from '../db'
import { refreshTokens } from '../db/schema'
import { env } from '../config/env'
import { HttpError } from '../utils/http'

export type AccessPayload = {
  sub: string
  username: string
  email: string
  tokenType: 'access'
  jti: string
}

const sha256 = (value: string) => crypto.createHash('sha256').update(value).digest('hex')

export function signAccessToken(user: { id: string; username: string; email: string }) {
  return jwt.sign(
    { sub: user.id, username: user.username, email: user.email, tokenType: 'access', jti: crypto.randomUUID() },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn as jwt.SignOptions['expiresIn'], issuer: 'promptpilot', audience: 'promptpilot-web' },
  )
}

export function verifyAccessToken(token: string): AccessPayload {
  try {
    const payload = jwt.verify(token, env.jwtSecret, {
      issuer: 'promptpilot',
      audience: 'promptpilot-web',
    }) as AccessPayload
    if (payload.tokenType !== 'access' || !payload.sub || !payload.jti) {
      throw new HttpError(401, 'Invalid access token', 'TOKEN_INVALID')
    }
    return payload
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new HttpError(401, 'Token expired', 'TOKEN_EXPIRED')
    }
    if (error instanceof HttpError) throw error
    throw new HttpError(401, 'Invalid access token', 'TOKEN_INVALID')
  }
}

export async function issueRefreshToken(
  user: { id: string; username: string; email: string },
  options: { rememberMe: boolean; userAgent?: string; ipAddress?: string },
) {
  const id = crypto.randomUUID()
  const familyId = crypto.randomUUID()
  const payload = { sub: user.id, username: user.username, email: user.email, tokenType: 'refresh', jti: id, familyId }
  const token = jwt.sign(payload, env.jwtRefreshSecret, {
    expiresIn: (options.rememberMe ? '30d' : env.jwtRefreshExpiresIn) as jwt.SignOptions['expiresIn'],
    issuer: 'promptpilot',
    audience: 'promptpilot-web',
  })
  const decoded = jwt.decode(token) as jwt.JwtPayload

  await db.insert(refreshTokens).values({
    id,
    userId: user.id,
    jti: id,
    familyId,
    tokenHash: sha256(token),
    rememberMe: options.rememberMe,
    expiresAt: new Date((decoded.exp ?? 0) * 1000),
    userAgent: options.userAgent,
    ipAddress: options.ipAddress,
  })
  return token
}

export async function refreshAccessToken(
  token: string,
  metadata: { userAgent?: string; ipAddress?: string },
) {
  let decoded: jwt.JwtPayload
  try {
    decoded = jwt.verify(token, env.jwtRefreshSecret, {
      issuer: 'promptpilot',
      audience: 'promptpilot-web',
    }) as jwt.JwtPayload
  } catch {
    throw new HttpError(401, 'Invalid or expired refresh token', 'REFRESH_INVALID')
  }
  if (decoded.tokenType !== 'refresh' || !decoded.jti || !decoded.familyId || !decoded.sub) {
    throw new HttpError(401, 'Invalid refresh token', 'REFRESH_INVALID')
  }

  const [stored] = await db.select().from(refreshTokens).where(eq(refreshTokens.jti, decoded.jti)).limit(1)
  if (!stored || stored.tokenHash !== sha256(token)) {
    throw new HttpError(401, 'Invalid refresh token', 'REFRESH_INVALID')
  }
  if (stored.revokedAt) {
    await db.update(refreshTokens).set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.familyId, stored.familyId), isNull(refreshTokens.revokedAt)))
    throw new HttpError(401, 'Refresh token reuse detected', 'REFRESH_REUSE')
  }
  if (stored.expiresAt <= new Date()) {
    throw new HttpError(401, 'Refresh token expired', 'REFRESH_EXPIRED')
  }

  const user = { id: decoded.sub, username: String(decoded.username), email: String(decoded.email) }
  const accessToken = signAccessToken(user)
  const replacement = await issueRefreshTokenInFamily(user, stored.familyId, stored.rememberMe, metadata)
  await db.update(refreshTokens).set({
    revokedAt: new Date(),
    replacedByTokenId: replacement.id,
  }).where(and(eq(refreshTokens.id, stored.id), isNull(refreshTokens.revokedAt)))
  return { accessToken, refreshToken: replacement.token, rememberMe: stored.rememberMe }
}

async function issueRefreshTokenInFamily(
  user: { id: string; username: string; email: string },
  familyId: string,
  rememberMe: boolean,
  metadata: { userAgent?: string; ipAddress?: string },
) {
  const id = crypto.randomUUID()
  const token = jwt.sign(
    { sub: user.id, username: user.username, email: user.email, tokenType: 'refresh', jti: id, familyId },
    env.jwtRefreshSecret,
    { expiresIn: (rememberMe ? '30d' : env.jwtRefreshExpiresIn) as jwt.SignOptions['expiresIn'], issuer: 'promptpilot', audience: 'promptpilot-web' },
  )
  const decoded = jwt.decode(token) as jwt.JwtPayload
  await db.insert(refreshTokens).values({
    id,
    userId: user.id,
    jti: id,
    familyId,
    tokenHash: sha256(token),
    rememberMe,
    expiresAt: new Date((decoded.exp ?? 0) * 1000),
    userAgent: metadata.userAgent,
    ipAddress: metadata.ipAddress,
  })
  return { id, token }
}

export async function revokeRefreshToken(token: string) {
  const decoded = jwt.decode(token) as jwt.JwtPayload | null
  if (decoded?.jti) {
    await db.update(refreshTokens).set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.jti, decoded.jti), isNull(refreshTokens.revokedAt)))
  }
}

export async function listRefreshSessions(userId: string) {
  const rows = await db.select({
    id: refreshTokens.id,
    expiresAt: refreshTokens.expiresAt,
    revokedAt: refreshTokens.revokedAt,
    userAgent: refreshTokens.userAgent,
    ipAddress: refreshTokens.ipAddress,
    createdAt: refreshTokens.createdAt,
  }).from(refreshTokens).where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)))
  return rows.filter((row) => row.expiresAt > new Date())
}

export async function revokeRefreshSession(userId: string, sessionId: string) {
  await db.update(refreshTokens).set({ revokedAt: new Date() })
    .where(and(
      eq(refreshTokens.id, sessionId),
      eq(refreshTokens.userId, userId),
      isNull(refreshTokens.revokedAt),
    ))
}

export async function revokeOtherRefreshSessions(userId: string, currentToken?: string) {
  if (!currentToken) {
    await db.update(refreshTokens).set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)))
    return
  }
  const decoded = jwt.decode(currentToken) as jwt.JwtPayload | null
  if (!decoded?.jti) return
  await db.update(refreshTokens).set({ revokedAt: new Date() })
    .where(and(
      eq(refreshTokens.userId, userId),
      isNull(refreshTokens.revokedAt),
      ne(refreshTokens.jti, decoded.jti),
    ))
}
