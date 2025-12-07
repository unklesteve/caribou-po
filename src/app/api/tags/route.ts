import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const tags = await prisma.colorTag.findMany({
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(tags)
}
