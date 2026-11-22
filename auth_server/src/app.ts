import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import { env } from './config/env'
import authRoutes from './routes/auth.routes'
import { validateCsrf, validateOrigin } from './middleware/csrf'
import { errorHandler, notFound } from './utils/http'

export const app = express()

app.disable('x-powered-by')
app.set('trust proxy', 1)
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}))
app.use(cors({
  origin(origin, callback) {
    if (!origin || env.allowedOrigins.includes(origin)) callback(null, true)
    else callback(new Error('Origin is not allowed'))
  },
  credentials: true,
}))
app.use(express.json({ limit: '32kb' }))
app.use(express.urlencoded({ extended: false, limit: '32kb' }))
app.use(cookieParser())
app.use(validateOrigin)
app.use(validateCsrf)

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'promptpilot-auth', uptime: process.uptime() })
})
app.use('/api/auth', authRoutes)

app.use(notFound)
app.use(errorHandler)
