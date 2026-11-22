import dotenv from 'dotenv'
import path from 'node:path'
import { defineConfig } from 'drizzle-kit'

dotenv.config({ path: path.resolve(process.cwd(), 'auth_server/.env') })

export default defineConfig({
  schema: './auth_server/src/db/schema.ts',
  out: './auth_server/drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgresql://postgres@localhost:5432/PromptPilot',
  },
})
