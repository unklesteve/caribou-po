import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const engravingArt = await prisma.engravingArt.findMany({
    where: { productId: params.id },
    orderBy: { position: 'asc' },
  })

  return NextResponse.json(engravingArt)
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json()

  // Verify product exists
  const product = await prisma.product.findUnique({
    where: { id: params.id },
  })

  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  }

  const engravingArt = await prisma.engravingArt.create({
    data: {
      name: body.name,
      imageUrl: body.imageUrl,
      position: body.position, // "Side 1", "Side 2", "Rim"
      productId: params.id,
      isActive: body.isActive ?? true,
    },
  })

  return NextResponse.json(engravingArt, { status: 201 })
}
