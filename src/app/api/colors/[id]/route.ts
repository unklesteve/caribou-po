import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const color = await prisma.yoyoColor.findUnique({
    where: { id: params.id },
    include: {
      pantoneChips: {
        include: { pantone: true },
        orderBy: { orderIndex: 'asc' },
      },
      tags: true,
    },
  })

  if (!color) {
    return NextResponse.json({ error: 'Color not found' }, { status: 404 })
  }

  return NextResponse.json(color)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json()

  // Delete existing pantone relationships
  await prisma.colorPantone.deleteMany({
    where: { colorId: params.id },
  })

  const color = await prisma.yoyoColor.update({
    where: { id: params.id },
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
      // Replace all tags with the new selection
      tags: {
        set: body.tagIds?.map((id: string) => ({ id })) || [],
      },
    },
    include: {
      pantoneChips: {
        include: { pantone: true },
        orderBy: { orderIndex: 'asc' },
      },
      tags: true,
    },
  })

  return NextResponse.json(color)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  await prisma.yoyoColor.delete({
    where: { id: params.id },
  })

  return NextResponse.json({ success: true })
}
