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
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(products)
}

export async function POST(request: NextRequest) {
  const body = await request.json()

  const product = await prisma.product.create({
    data: {
      sku: body.sku,
      name: body.name,
      description: body.description || null,
      unitPrice: parseFloat(body.unitPrice),
      unit: body.unit || 'each',
      category: body.category || null,
      isActive: body.isActive ?? true,
    },
  })

  return NextResponse.json(product, { status: 201 })
}
