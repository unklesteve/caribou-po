import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const pantone = await prisma.pantoneChip.findUnique({
    where: { id: params.id },
  })

  if (!pantone) {
    return NextResponse.json({ error: 'Pantone chip not found' }, { status: 404 })
  }

  return NextResponse.json(pantone)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json()

  const pantone = await prisma.pantoneChip.update({
    where: { id: params.id },
    data: {
      code: body.code,
      name: body.name,
      hexColor: body.hexColor,
    },
  })

  return NextResponse.json(pantone)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  await prisma.pantoneChip.delete({
    where: { id: params.id },
  })

  return NextResponse.json({ success: true })
}
