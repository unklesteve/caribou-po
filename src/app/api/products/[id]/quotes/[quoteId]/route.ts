import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; quoteId: string } }
) {
  await prisma.productQuote.delete({
    where: { id: params.quoteId },
  })

  // Update product's unitPrice to reflect the most recent remaining quote
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

  return NextResponse.json({ success: true })
}
