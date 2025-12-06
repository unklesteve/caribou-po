import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

// Generate PO number for manually created POs (YEAR-MM-XXX format)
async function generatePONumber(): Promise<string> {
  const now = new Date()
  const year = now.getFullYear()
  const month = (now.getMonth() + 1).toString().padStart(2, '0')
  const prefix = `PO-${year}-${month}-`

  // Find the highest number for this month
  const existingPOs = await prisma.purchaseOrder.findMany({
    where: {
      poNumber: { startsWith: prefix },
    },
    select: { poNumber: true },
    orderBy: { poNumber: 'desc' },
    take: 1,
  })

  let counter = 1
  if (existingPOs.length > 0) {
    const lastNum = existingPOs[0].poNumber.replace(prefix, '')
    const parsed = parseInt(lastNum, 10)
    if (!isNaN(parsed)) {
      counter = parsed + 1
    }
  }

  return `${prefix}${counter.toString().padStart(3, '0')}`
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
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(purchaseOrders)
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
      lineItems: {
        create: body.lineItems.map((item: { productId: string; colorId?: string | null; quantity: number; engravings?: { engravingArtId: string; quantity: number }[] }) => ({
          productId: item.productId,
          colorId: item.colorId || null,
          quantity: item.quantity,
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

  return NextResponse.json(purchaseOrder, { status: 201 })
}
