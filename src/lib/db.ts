import { PrismaClient } from '@prisma/client'

// ─── Vercel-compatible Prisma client ───
// On Vercel (and other serverless platforms), environment variables are set
// through the platform dashboard — there is no .env file on the filesystem.
// We read DATABASE_URL directly from process.env, which works everywhere.
//
// For local development, Next.js automatically loads .env files. Some .env
// files wrap values in quotes (e.g. KEY="value"); we strip surrounding quotes
// so Prisma accepts the URL.

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Strip surrounding quotes from a .env value — some loaders keep them,
// which makes Prisma reject the URL as "not starting with postgresql://".
function cleanEnvUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  return raw.replace(/^["']|["']$/g, "");
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: cleanEnvUrl(process.env.DATABASE_URL),
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
