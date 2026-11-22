import { app } from './app'
import { env } from './config/env'
import { pool } from './db'

const server = app.listen(env.port, () => {
  console.info(`PromptPilot auth server listening on http://localhost:${env.port}`)
})

async function shutdown(signal: string) {
  console.info(`${signal} received; shutting down`)
  server.close(async () => {
    await pool.end()
    process.exit(0)
  })
}

process.on('SIGTERM', () => void shutdown('SIGTERM'))
process.on('SIGINT', () => void shutdown('SIGINT'))
