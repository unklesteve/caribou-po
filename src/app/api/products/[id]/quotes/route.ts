import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const quotes = await prisma.productQuote.findMany({
    where: { productId: params.id },
    orderBy: { quoteDate: 'desc' },
  })

  return NextResponse.json(quotes)
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

  // Create the quote
  const quote = await prisma.productQuote.create({
    data: {
      productId: params.id,
      quoteDate: new Date(body.quoteDate),
      unitPrice: parseFloat(body.unitPrice),
      notes: body.notes || null,
    },
  })

  // Update product's unitPrice to reflect the most recent quote
  const mostRecentQuote = await prisma.productQuote.findFirst({
    where: { productId: params.id },
    orderBy: { quoteDate: 'desc' },
  })

  if (mostRecentQuote) {
    await prisma.product.update({
      where: { id: params.id },
      data: { unitPrice: mostRecentQuote.unitPrice },
    })
  }

  return NextResponse.json(quote, { status: 201 })
}
