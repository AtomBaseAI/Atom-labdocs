import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'fs'
import { join } from 'path'
import { parse } from 'dotenv'

// Manually parse .env to handle special characters like & in DATABASE_URL
// Next.js built-in env parser may truncate values at & characters
// We MUST override process.env values because Next.js may have cached stale
// values from before the .env was updated (e.g., switching from SQLite to Postgres)
function loadEnv() {
  try {
    const envPath = join(process.cwd(), '.env')
    const envContent = readFileSync(envPath, 'utf-8')
    const parsed = parse(envContent)
    for (const [key, value] of Object.entries(parsed)) {
      // Always override — the .env file is the source of truth
      process.env[key] = value
    }
  } catch {
    // fallback - env vars should already be set
  }
}

loadEnv()

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
