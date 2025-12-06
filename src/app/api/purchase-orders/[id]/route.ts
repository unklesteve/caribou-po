import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const purchaseOrder = await prisma.purchaseOrder.findUnique({
    where: { id: params.id },
    include: {
      supplier: true,
      lineItems: {
        include: {
          product: {
            include: {
              engravingArt: {
                where: { isActive: true },
                orderBy: { position: 'asc' },
              },
            },
          },
          color: {
            include: {
              pantoneChips: {
                include: { pantone: true },
                orderBy: { orderIndex: 'asc' },
              },
            },
          },
          engravings: {
            include: {
              engravingArt: true,
            },
          },
        },
      },
    },
  })

  if (!purchaseOrder) {
    return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })
  }

  // Calculate totals
  const subtotal = purchaseOrder.lineItems.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0
  )
  const tax = subtotal * (purchaseOrder.taxRate / 100)
  const total = subtotal + tax + purchaseOrder.shippingCost

  return NextResponse.json({ ...purchaseOrder, subtotal, tax, total })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json()

  // Delete existing line items and create new ones
  await prisma.lineItem.deleteMany({
    where: { purchaseOrderId: params.id },
  })

  const purchaseOrder = await prisma.purchaseOrder.update({
    where: { id: params.id },
    data: {
      supplierId: body.supplierId,
      notes: body.notes || null,
      shippingCost: parseFloat(body.shippingCost) || 0,
      taxRate: parseFloat(body.taxRate) || 0,
      lineItems: {
        create: body.lineItems.map((item: { productId: string; colorId?: string | null; quantity: number; unitPrice: number; engravings?: { engravingArtId: string; quantity: number }[] }) => ({
          productId: item.productId,
          colorId: item.colorId || null,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          engravings: item.engravings?.length ? {
            create: item.engravings.map((eng) => ({
              engravingArtId: eng.engravingArtId,
              quantity: eng.quantity,
            })),
          } : undefined,
        })),
      },
    },
    include: {
      supplier: true,
      lineItems: {
        include: {
          product: {
            include: {
              engravingArt: {
                where: { isActive: true },
                orderBy: { position: 'asc' },
              },
            },
          },
          color: {
            include: {
              pantoneChips: {
                include: { pantone: true },
                orderBy: { orderIndex: 'asc' },
              },
            },
          },
          engravings: {
            include: {
              engravingArt: true,
            },
          },
        },
      },
    },
  })

  return NextResponse.json(purchaseOrder)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json()

  const updateData: Record<string, unknown> = {}

  if (body.status) {
    updateData.status = body.status
    if (body.status === 'ORDERED') {
      updateData.sentAt = new Date()
    } else if (body.status === 'RECEIVED') {
      updateData.receivedAt = new Date()
    }
  }

  const purchaseOrder = await prisma.purchaseOrder.update({
    where: { id: params.id },
    data: updateData,
    include: {
      supplier: true,
      lineItems: {
        include: {
          product: {
            include: {
              engravingArt: {
                where: { isActive: true },
                orderBy: { position: 'asc' },
              },
            },
          },
          color: {
            include: {
              pantoneChips: {
                include: { pantone: true },
                orderBy: { orderIndex: 'asc' },
              },
            },
          },
          engravings: {
            include: {
              engravingArt: true,
            },
          },
        },
      },
    },
  })

  return NextResponse.json(purchaseOrder)
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  await prisma.purchaseOrder.delete({
    where: { id: params.id },
  })

  return NextResponse.json({ success: true })
}
