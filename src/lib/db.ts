import { PrismaClient } from '@prisma/client'

// ─── Vercel-compatible Prisma client ───
// On Vercel (and other serverless platforms), environment variables are set
// through the platform dashboard — there is no .env file on the filesystem.
// We read DATABASE_URL directly from process.env, which works everywhere.
//
// For local development, Next.js automatically loads .env files, so
// process.env.DATABASE_URL is already populated. The manual dotenv parsing
// that was previously here is removed because:
//   1. readFileSync won't work on Vercel's read-only filesystem (no .env)
//   2. Next.js's built-in env loading handles special chars correctly in v15+
//   3. The dotenv import + readFileSync could trigger Turbopack static analysis

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: process.env.DATABASE_URL,
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
