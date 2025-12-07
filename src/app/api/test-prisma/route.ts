import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Test if prisma is defined
    if (!prisma) {
      return NextResponse.json({ error: 'prisma is undefined' })
    }

    // Test if supplier model exists
    if (!prisma.supplier) {
      return NextResponse.json({ error: 'prisma.supplier is undefined', keys: Object.keys(prisma) })
    }

    // Try to count suppliers
    const count = await prisma.supplier.count()
    return NextResponse.json({ success: true, supplierCount: count })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: errorMessage })
  }
}
