import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'fs'
import { join } from 'path'
import { parse } from 'dotenv'

// Manually parse .env to handle special characters like & in DATABASE_URL.
// Next.js's built-in env parser truncates values at & characters, which
// breaks PostgreSQL connection URLs containing query parameters.
// We parse .env ourselves and also pass datasourceUrl directly to PrismaClient
// to bypass any env caching issues across server restarts.
function loadEnv(): Record<string, string> {
  try {
    const envPath = join(process.cwd(), '.env')
    const envContent = readFileSync(envPath, 'utf-8')
    const parsed = parse(envContent)
    // Override process.env — the .env file is the source of truth
    for (const [key, value] of Object.entries(parsed)) {
      process.env[key] = value
    }
    return parsed
  } catch {
    // fallback - env vars should already be set
    return {}
  }
}

const envVars = loadEnv()

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Pass the datasource URL directly to PrismaClient to ensure it always
// gets the correct PostgreSQL URL, even if process.env is stale or truncated.
// The datasourceUrl option overrides the env("DATABASE_URL") in schema.prisma.
export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: envVars.DATABASE_URL || process.env.DATABASE_URL,
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
