import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import { createClient } from '@libsql/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  const tursoUrl = process.env.TURSO_DATABASE_URL
  const tursoToken = process.env.TURSO_AUTH_TOKEN

  // Use Turso if configured
  if (tursoUrl && tursoToken) {
    const libsql = createClient({
      url: tursoUrl,
      authToken: tursoToken,
    })
    const adapter = new PrismaLibSQL(libsql)
    return new PrismaClient({ adapter })
  }

  // In production/Vercel, we MUST have Turso configured
  // Throw a clear error instead of falling back to broken SQLite
  throw new Error(
    `Turso not configured. TURSO_DATABASE_URL: ${tursoUrl ? 'set' : 'MISSING'}, TURSO_AUTH_TOKEN: ${tursoToken ? 'set' : 'MISSING'}. ` +
    `Available env vars with TURSO/DATABASE: ${Object.keys(process.env).filter(k => k.includes('TURSO') || k.includes('DATABASE')).join(', ') || 'none'}`
  )
}

// Use a getter to lazily initialize the client at runtime, not build time
export const prisma = new Proxy({} as PrismaClient, {
  get(target, prop) {
    if (!globalForPrisma.prisma) {
      globalForPrisma.prisma = createPrismaClient()
    }
    return Reflect.get(globalForPrisma.prisma, prop)
  },
})
