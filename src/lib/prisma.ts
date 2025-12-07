import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import { createClient } from '@libsql/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  const tursoUrl = process.env.TURSO_DATABASE_URL
  const tursoToken = process.env.TURSO_AUTH_TOKEN

  console.log('[Prisma] Creating client...')
  console.log('[Prisma] TURSO_DATABASE_URL:', tursoUrl ? 'SET' : 'NOT SET')
  console.log('[Prisma] TURSO_AUTH_TOKEN:', tursoToken ? 'SET' : 'NOT SET')
  console.log('[Prisma] NODE_ENV:', process.env.NODE_ENV)
  console.log('[Prisma] All env keys:', Object.keys(process.env).filter(k => k.includes('TURSO') || k.includes('DATABASE')))

  // Use Turso if configured
  if (tursoUrl && tursoToken) {
    console.log('[Prisma] Using Turso adapter')
    const libsql = createClient({
      url: tursoUrl,
      authToken: tursoToken,
    })
    const adapter = new PrismaLibSQL(libsql)
    return new PrismaClient({ adapter })
  }

  console.log('[Prisma] Falling back to default PrismaClient')
  // Fallback to regular Prisma client for local development
  return new PrismaClient()
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
