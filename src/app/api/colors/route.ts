import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const search = searchParams.get('search') || ''
  const activeOnly = searchParams.get('activeOnly') === 'true'

  const colors = await prisma.yoyoColor.findMany({
    where: {
      AND: [
        search
          ? {
              name: { contains: search },
            }
          : {},
        activeOnly ? { isActive: true } : {},
      ],
    },
    include: {
      pantoneChips: {
        include: { pantone: true },
        orderBy: { orderIndex: 'asc' },
      },
    },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(colors)
}

export async function POST(request: NextRequest) {
  const body = await request.json()

  const color = await prisma.yoyoColor.create({
    data: {
      name: body.name,
      imageUrl: body.imageUrl || null,
      description: body.description || null,
      isActive: body.isActive ?? true,
      pantoneLocked: body.pantoneLocked ?? false,
      pantoneChips: body.pantoneIds?.length
        ? {
            create: body.pantoneIds.map((pantoneId: string, index: number) => ({
              pantoneId,
              orderIndex: index,
            })),
          }
        : undefined,
    },
    include: {
      pantoneChips: {
        include: { pantone: true },
        orderBy: { orderIndex: 'asc' },
      },
    },
  })

  return NextResponse.json(color, { status: 201 })
}
