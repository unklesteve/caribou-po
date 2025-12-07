import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; artId: string } }
) {
  const engravingArt = await prisma.engravingArt.findUnique({
    where: { id: params.artId, productId: params.id },
  })

  if (!engravingArt) {
    return NextResponse.json({ error: 'Engraving art not found' }, { status: 404 })
  }

  return NextResponse.json(engravingArt)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; artId: string } }
) {
  const body = await request.json()

  const engravingArt = await prisma.engravingArt.update({
    where: { id: params.artId },
    data: {
      name: body.name,
      imageUrl: body.imageUrl,
      position: body.position,
      isActive: body.isActive ?? true,
    },
  })

  return NextResponse.json(engravingArt)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; artId: string } }
) {
  await prisma.engravingArt.delete({
    where: { id: params.artId },
  })

  return NextResponse.json({ success: true })
}
