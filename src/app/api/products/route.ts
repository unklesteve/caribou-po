import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const search = searchParams.get('search') || ''
  const activeOnly = searchParams.get('activeOnly') === 'true'

  const products = await prisma.product.findMany({
    where: {
      AND: [
        search
          ? {
              OR: [
                { name: { contains: search } },
                { sku: { contains: search } },
              ],
            }
          : {},
        activeOnly ? { isActive: true } : {},
      ],
    },
    include: {
      engravingArt: {
        where: { isActive: true },
        orderBy: { position: 'asc' },
      },
    },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(products)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const product = await prisma.product.create({
      data: {
        sku: body.sku,
        name: body.name,
        description: body.description || null,
        imageUrl: body.imageUrl || null,
        unitPrice: parseFloat(body.unitPrice) || 0,
        unit: body.unit || 'each',
        category: body.category || null,
        material: body.material || null,
        isActive: body.isActive ?? true,
      },
      include: {
        engravingArt: true,
      },
    })

    return NextResponse.json(product, { status: 201 })
  } catch (error) {
    console.error('Product create error:', error)
    const message = error instanceof Error ? error.message : 'Failed to create product'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
