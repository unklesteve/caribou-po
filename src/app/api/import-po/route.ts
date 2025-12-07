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

interface ParsedPO {
  poNumber: string | null
  date: string | null
  notes: string | null
  items: {
    product: string
    color: string
    quantity: number
    notes: string
  }[]
}

function parseCaribouCSV(csvText: string): ParsedPO {
  const lines = csvText.split('\n')

  const result: ParsedPO = {
    poNumber: null,
    date: null,
    notes: null,
    items: [],
  }

  let headerRowIndex = -1
  let productIdx = -1
  let colorIdx = -1
  let qtyIdx = -1
  let notesIdx = -1
  let currentProduct = ''

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    // Parse CSV properly handling quoted fields
    const values = parseCSVLine(line)

    // Look for PO number in early rows (format: "PO:,2025-09-BOREALISOG")
    if (i < 5) {
      for (let j = 0; j < values.length; j++) {
        const val = values[j].trim()
        if (val === 'PO:' && values[j + 1]) {
          // PO number is in next cell
          result.poNumber = values[j + 1].trim()
        } else if (val.startsWith('PO:')) {
          // PO number might be in same cell
          const poMatch = val.match(/PO:\s*(.+)/)
          if (poMatch && poMatch[1]) {
            result.poNumber = poMatch[1].trim()
          }
        }
        if (val.startsWith('Date:')) {
          const dateMatch = val.match(/Date:\s*(.+)/)
          if (dateMatch) {
            result.date = dateMatch[1].trim()
          }
        }
        // Look for production notes
        if (val.toLowerCase().includes('production notes')) {
          result.notes = val
        }
      }
    }

    // Find header row - look for "Color" and "QTY" (product name comes from first data column)
    const lowerValues = values.map(v => v.toLowerCase().trim())
    if (headerRowIndex === -1) {
      const hasColor = lowerValues.includes('color')
      const hasQty = lowerValues.includes('qty') || lowerValues.includes('quantity')

      if (hasColor && hasQty) {
        headerRowIndex = i
        colorIdx = lowerValues.indexOf('color')
        qtyIdx = lowerValues.includes('qty') ? lowerValues.indexOf('qty') : lowerValues.indexOf('quantity')
        notesIdx = lowerValues.indexOf('notes')
        // Product index is typically column 0 (before Color), or same as Color - 1
        productIdx = lowerValues.includes('product') ? lowerValues.indexOf('product') : 0
        continue
      }
    }

    // Skip if we haven't found header yet
    if (headerRowIndex === -1) continue

    // Skip header row
    if (i === headerRowIndex) continue

    // Parse data rows
    const productVal = values[productIdx]?.trim() || ''
    const colorVal = values[colorIdx]?.trim() || ''
    const qtyVal = values[qtyIdx]?.trim() || ''
    const notesVal = notesIdx >= 0 ? values[notesIdx]?.trim() || '' : ''

    // Skip empty rows or total row
    if (colorVal.toLowerCase() === 'total:' || productVal.toLowerCase() === 'total:') {
      continue
    }

    // Parse quantity
    const quantity = parseInt(qtyVal, 10)
    if (isNaN(quantity) || quantity <= 0) {
      continue
    }

    // Track current product (product name may only appear on first row of a group)
    if (productVal) {
      currentProduct = productVal
    }

    // Skip if we don't have a product yet
    if (!currentProduct) {
      continue
    }

    // Skip if no color (but has quantity - probably a formatting row)
    if (!colorVal) {
      continue
    }

    result.items.push({
      product: currentProduct,
      color: colorVal,
      quantity,
      notes: notesVal,
    })
  }

  return result
}

// Parse a CSV line handling quoted fields
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  result.push(current)

  return result
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const supplierId = formData.get('supplierId') as string

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      )
    }

    if (!supplierId) {
      return NextResponse.json(
        { success: false, error: 'No supplier selected' },
        { status: 400 }
      )
    }

    // Verify supplier exists
    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
    })

    if (!supplier) {
      return NextResponse.json(
        { success: false, error: 'Supplier not found' },
        { status: 400 }
      )
    }

    // Parse CSV
    const csvText = await file.text()
    console.log('CSV content (first 500 chars):', csvText.substring(0, 500))

    const parsed = parseCaribouCSV(csvText)
    console.log('Parsed result:', JSON.stringify(parsed, null, 2))

    if (parsed.items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid line items found in CSV. Check that your CSV has Color and QTY columns.' },
        { status: 400 }
      )
    }

    // Process each item
    const lineItemsData: {
      productId: string
      colorId: string | null
      quantity: number
    }[] = []

    const errors: string[] = []
    const createdColors: string[] = []
    const createdProducts: string[] = []

    for (const item of parsed.items) {
      // Find product by name or SKU
      let product = await prisma.product.findFirst({
        where: {
          OR: [
            { name: { equals: item.product } },
            { sku: { equals: item.product } },
          ],
        },
      })

      if (!product) {
        // Auto-create the product
        const sku = `CL-${item.product.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)}`
        product = await prisma.product.create({
          data: {
            name: item.product,
            sku,
            unitPrice: 0,
            isActive: true,
          },
        })
        createdProducts.push(item.product)
      }

      // Find or create color
      let colorId: string | null = null
      if (item.color) {
        let color = await prisma.yoyoColor.findFirst({
          where: { name: item.color },
        })

        if (!color) {
          // Create the color
          color = await prisma.yoyoColor.create({
            data: {
              name: item.color,
              isActive: true,
            },
          })
          createdColors.push(item.color)
        }
        colorId = color.id
      }

      lineItemsData.push({
        productId: product.id,
        colorId,
        quantity: item.quantity,
      })
    }

    if (lineItemsData.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No valid line items could be processed',
          details: errors,
        },
        { status: 400 }
      )
    }

    // Create PO - use PO number from CSV if available, otherwise generate one
    let poNumber: string
    if (parsed.poNumber) {
      // Add PO- prefix if not present
      poNumber = parsed.poNumber.startsWith('PO-') ? parsed.poNumber : `PO-${parsed.poNumber}`

      // Check if this PO number already exists
      const existing = await prisma.purchaseOrder.findUnique({
        where: { poNumber },
      })
      if (existing) {
        return NextResponse.json(
          { success: false, error: `PO number ${poNumber} already exists` },
          { status: 400 }
        )
      }
    } else {
      poNumber = await generatePONumber()
    }

    const po = await prisma.purchaseOrder.create({
      data: {
        poNumber,
        supplierId,
        status: 'DRAFT',
        notes: parsed.notes || undefined,
        lineItems: {
          create: lineItemsData,
        },
      },
      include: {
        lineItems: true,
      },
    })

    let message = `Created ${po.poNumber} with ${po.lineItems.length} items`
    if (createdProducts.length > 0) {
      message += `. Created ${createdProducts.length} new product(s): ${createdProducts.join(', ')}`
    }
    if (createdColors.length > 0) {
      message += `. Created ${createdColors.length} new color(s): ${createdColors.join(', ')}`
    }
    if (errors.length > 0) {
      message += `. ${errors.length} item(s) skipped.`
    }

    return NextResponse.json({
      success: true,
      message,
      poId: po.id,
      poNumber: po.poNumber,
      lineItemCount: po.lineItems.length,
      createdProducts: createdProducts.length > 0 ? createdProducts : undefined,
      createdColors: createdColors.length > 0 ? createdColors : undefined,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('Import error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}
