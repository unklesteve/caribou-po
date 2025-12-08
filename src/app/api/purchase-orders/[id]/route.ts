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

  return NextResponse.json(purchaseOrder)
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
      lineItems: {
        create: body.lineItems.map((item: { productId: string; colorId?: string | null; ringColor?: string | null; quantity: number; engravings?: { engravingArtId: string }[] }) => ({
          productId: item.productId,
          colorId: item.colorId || null,
          ringColor: item.ringColor || null,
          quantity: item.quantity,
          engravings: item.engravings?.length ? {
            create: item.engravings.map((eng) => ({
              engravingArtId: eng.engravingArtId,
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
    } else if (body.status === 'SHIPPED') {
      updateData.shippedAt = new Date()
    } else if (body.status === 'RECEIVED') {
      updateData.receivedAt = new Date()
    } else if (body.status === 'PACKAGED') {
      updateData.packagedAt = new Date()
    } else if (body.status === 'RELEASED') {
      updateData.releasedAt = new Date()
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
