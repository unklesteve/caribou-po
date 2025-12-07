import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const product = await prisma.product.findUnique({
    where: { id: params.id },
    include: {
      engravingArt: {
        orderBy: { position: 'asc' },
      },
      quotes: {
        orderBy: { quoteDate: 'desc' },
      },
    },
  })

  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  }

  return NextResponse.json(product)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json()

  const product = await prisma.product.update({
    where: { id: params.id },
    data: {
      sku: body.sku,
      name: body.name,
      description: body.description || null,
      imageUrl: body.imageUrl || null,
      unitPrice: parseFloat(body.unitPrice),
      unit: body.unit || 'each',
      category: body.category || null,
      material: body.material || null,
      isActive: body.isActive ?? true,
    },
    include: {
      engravingArt: {
        orderBy: { position: 'asc' },
      },
      quotes: {
        orderBy: { quoteDate: 'desc' },
      },
    },
  })

  return NextResponse.json(product)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  await prisma.product.delete({
    where: { id: params.id },
  })

  return NextResponse.json({ success: true })
}
