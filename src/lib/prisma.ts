import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import { createClient } from '@libsql/client'

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  // Read env vars at runtime, not at import time
  const tursoUrl = process.env['TURSO_DATABASE_URL']
  const tursoToken = process.env['TURSO_AUTH_TOKEN']

  // Use Turso if configured
  if (tursoUrl && tursoToken) {
    const libsql = createClient({
      url: tursoUrl,
      authToken: tursoToken,
    })
    const adapter = new PrismaLibSQL(libsql)
    return new PrismaClient({ adapter })
  }

  // Fallback with hardcoded values for Vercel (env vars not working)
  const libsql = createClient({
    url: 'libsql://caribou-po-unklesteve.aws-us-east-2.turso.io',
    authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3NjUxMjE3NDIsImlkIjoiZWJlMDc3ODMtNjViOS00M2M2LWEyODgtYWQwNDlhYjQyNDlkIiwicmlkIjoiNjljMWQyMzYtOWE5MS00NWE3LTk2ZmMtMmU2MmViMmJlNDNlIn0.737EYWRmmODxVLo1tCYggLj6BrAZ0Tb8mRVw1BjfGF0NGWJ2mGyhxRGkEsqoPqe3I5j9MUOlhDNj-akdvJBNBg',
  })
  const adapter = new PrismaLibSQL(libsql)
  return new PrismaClient({ adapter })
}

function getPrisma(): PrismaClient {
  if (!global.__prisma) {
    global.__prisma = createPrismaClient()
  }
  return global.__prisma
}

// Lazy initialization using getter
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop: string | symbol) {
    const client = getPrisma()
    const value = Reflect.get(client, prop)
    if (typeof value === 'function') {
      return value.bind(client)
    }
    return value
  },
})
