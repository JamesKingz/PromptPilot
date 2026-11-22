import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { db, pool } from './index'

await migrate(db, { migrationsFolder: './auth_server/drizzle' })
await pool.end()
console.log('PromptPilot database migrations applied.')
