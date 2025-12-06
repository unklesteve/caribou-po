import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// Archived PO data extracted from Google Sheets
const archivedPOs = [
  {
    poNumber: '2025-12-KLONDIKE',
    date: new Date('2025-12-04'),
    productName: 'Klondike',
    notes: 'Production notes:\n- Caribou Lodge Standard Finish.\n- Center Trac Bearing',
    lineItems: [
      { color: 'Army Green', style: 'Solid', quantity: 50, rimColor: 'Silver, Blasted' },
      { color: 'Safety Orange', style: 'Solid', quantity: 50, rimColor: 'Silver, Blasted' },
      { color: 'Salmon Fade', style: 'Solid', quantity: 50, rimColor: 'Silver, Blasted' },
      { color: 'Black w/ Gold Rims', style: 'Solid', quantity: 50, rimColor: 'Gold, Blasted' },
      { color: 'Autumn Brown', style: 'Solid 2-tone', quantity: 30, rimColor: 'Gold, Blasted' },
    ],
  },
  {
    poNumber: '2025-12-BEATER',
    date: new Date('2025-09-09'),
    productName: 'Beater',
    notes: 'Production notes:\n- Caribou Lodge Standard Finish.\n- Center Trac Bearing',
    lineItems: [
      { color: 'Navy Blue', style: 'Solid', quantity: 60 },
      { color: 'Tiffany Mint', style: 'Solid', quantity: 60 },
      { color: 'Broken Twill', style: 'Acid Wash / Light Splash', quantity: 60 },
      { color: 'Hulk Smash', style: 'Splash', quantity: 60 },
    ],
  },
  {
    poNumber: '2025-12-SWAN',
    date: new Date('2025-09-09'),
    productName: 'Swan',
    notes: 'Production notes:\n- Caribou Lodge Standard Finish.\n- Center Trac Bearing',
    lineItems: [
      { color: 'Lime Sherbet', style: 'Solid', quantity: 40 },
      { color: 'Harrison Hurricane', style: 'Fade', quantity: 40 },
      { color: 'Salmon Fade', style: 'Splash', quantity: 40 },
      { color: '28 Stories', style: 'Acid Wash / Splash', quantity: 40 },
      { color: 'Tiffany Mint', style: 'Speckle', quantity: 40 },
      { color: 'Delirium Dive', style: 'Splash', quantity: 40 },
    ],
  },
]

export async function POST() {
  try {
    // Create or find a supplier for the manufacturer
    let supplier = await prisma.supplier.findFirst({
      where: { name: 'Manufacturing Partner' },
    })

    if (!supplier) {
      supplier = await prisma.supplier.create({
        data: {
          name: 'Manufacturing Partner',
          notes: 'Primary yo-yo manufacturing partner',
        },
      })
    }

    const results = []

    for (const poData of archivedPOs) {
      // Check if PO already exists
      const existingPO = await prisma.purchaseOrder.findUnique({
        where: { poNumber: poData.poNumber },
      })

      if (existingPO) {
        results.push({ poNumber: poData.poNumber, status: 'skipped', reason: 'already exists' })
        continue
      }

      // Create or find the product
      let product = await prisma.product.findFirst({
        where: { name: poData.productName },
      })

      if (!product) {
        product = await prisma.product.create({
          data: {
            sku: poData.productName.toUpperCase(),
            name: poData.productName,
            description: `${poData.productName} yo-yo`,
            unitPrice: 0, // Price not specified in archive
            unit: 'each',
            category: 'Yo-Yo',
          },
        })
      }

      // Create the purchase order
      const po = await prisma.purchaseOrder.create({
        data: {
          poNumber: poData.poNumber,
          supplierId: supplier.id,
          status: 'RECEIVED',
          notes: poData.notes,
          shippingCost: 0,
          taxRate: 0,
          createdAt: poData.date,
          sentAt: poData.date,
          receivedAt: poData.date,
          lineItems: {
            create: await Promise.all(
              poData.lineItems.map(async (item) => {
                // Try to find existing color or create placeholder
                let color = await prisma.yoyoColor.findFirst({
                  where: { name: item.color },
                })

                if (!color) {
                  const rimColor = 'rimColor' in item ? item.rimColor : null
                  color = await prisma.yoyoColor.create({
                    data: {
                      name: item.color,
                      description: item.style + (rimColor ? ` | Rim: ${rimColor}` : ''),
                      isActive: true,
                    },
                  })
                }

                return {
                  productId: product!.id,
                  colorId: color.id,
                  quantity: item.quantity,
                  unitPrice: 0, // Price not in archive
                }
              })
            ),
          },
        },
        include: {
          lineItems: true,
        },
      })

      results.push({
        poNumber: po.poNumber,
        status: 'created',
        lineItemCount: po.lineItems.length,
      })
    }

    return NextResponse.json({
      success: true,
      message: `Imported ${results.filter((r) => r.status === 'created').length} purchase orders`,
      results,
    })
  } catch (error) {
    console.error('Import error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to import archive' },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'POST to this endpoint to import archived purchase orders',
    archivedPOs: archivedPOs.map((po) => ({
      poNumber: po.poNumber,
      product: po.productName,
      lineItems: po.lineItems.length,
      totalQuantity: po.lineItems.reduce((sum, item) => sum + item.quantity, 0),
    })),
  })
}
