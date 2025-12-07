import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import { createClient } from '@libsql/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  // Try multiple ways to access the env vars
  const tursoUrl = process.env.TURSO_DATABASE_URL
    || process.env.NEXT_PUBLIC_TURSO_DATABASE_URL
    || 'libsql://caribou-po-unklesteve.aws-us-east-2.turso.io'

  const tursoToken = process.env.TURSO_AUTH_TOKEN
    || process.env.NEXT_PUBLIC_TURSO_AUTH_TOKEN
    || 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NjUxMjE3NDIsImlkIjoiZWJlMDc3ODMtNjViOS00M2M2LWEyODgtYWQwNDlhYjQyNDlkIiwicmlkIjoiNjljMWQyMzYtOWE5MS00NWE3LTk2ZmMtMmU2MmViMmJlNDNlIn0.737EYWRmmODxVLo1tCYggLj6BrAZ0Tb8mRVw1BjfGF0NGWJ2mGyhxRGkEsqoPqe3I5j9MUOlhDNj-akdvJBNBg'

  const libsql = createClient({
    url: tursoUrl,
    authToken: tursoToken,
  })
  const adapter = new PrismaLibSQL(libsql)
  return new PrismaClient({ adapter })
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
