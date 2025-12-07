import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const search = searchParams.get('search') || ''

  const pantones = await prisma.pantoneChip.findMany({
    where: search
      ? {
          OR: [
            { code: { contains: search } },
            { name: { contains: search } },
          ],
        }
      : undefined,
    orderBy: { code: 'asc' },
  })

  // Sort to prioritize Coated colors (ending in " C") first
  pantones.sort((a, b) => {
    const aIsCoated = a.code.endsWith(' C')
    const bIsCoated = b.code.endsWith(' C')
    if (aIsCoated && !bIsCoated) return -1
    if (!aIsCoated && bIsCoated) return 1
    return a.code.localeCompare(b.code)
  })

  return NextResponse.json(pantones)
}

export async function POST(request: NextRequest) {
  const body = await request.json()

  const pantone = await prisma.pantoneChip.create({
    data: {
      code: body.code,
      name: body.name,
      hexColor: body.hexColor,
    },
  })

  return NextResponse.json(pantone, { status: 201 })
}
