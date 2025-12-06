import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

async function generatePONumber(): Promise<string> {
  const counter = await prisma.pOCounter.upsert({
    where: { id: 'singleton' },
    update: { counter: { increment: 1 } },
    create: { id: 'singleton', counter: 1 },
  })
  return `PO-${counter.counter.toString().padStart(4, '0')}`
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const search = searchParams.get('search') || ''
  const status = searchParams.get('status') || ''
  const supplierId = searchParams.get('supplierId') || ''

  const purchaseOrders = await prisma.purchaseOrder.findMany({
    where: {
      AND: [
        search
          ? {
              OR: [
                { poNumber: { contains: search } },
                { supplier: { name: { contains: search } } },
              ],
            }
          : {},
        status ? { status } : {},
        supplierId ? { supplierId } : {},
      ],
    },
    include: {
      supplier: true,
      lineItems: {
        include: { product: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  // Calculate totals for each PO
  const posWithTotals = purchaseOrders.map((po) => {
    const subtotal = po.lineItems.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0
    )
    const tax = subtotal * (po.taxRate / 100)
    const total = subtotal + tax + po.shippingCost
    return { ...po, subtotal, tax, total }
  })

  return NextResponse.json(posWithTotals)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const poNumber = await generatePONumber()

  const purchaseOrder = await prisma.purchaseOrder.create({
    data: {
      poNumber,
      supplierId: body.supplierId,
      status: 'DRAFT',
      notes: body.notes || null,
      shippingCost: parseFloat(body.shippingCost) || 0,
      taxRate: parseFloat(body.taxRate) || 0,
      lineItems: {
        create: body.lineItems.map((item: { productId: string; quantity: number; unitPrice: number }) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
      },
    },
    include: {
      supplier: true,
      lineItems: { include: { product: true } },
    },
  })

  return NextResponse.json(purchaseOrder, { status: 201 })
}
