import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { jsPDF } from 'jspdf'
import fs from 'fs'
import path from 'path'

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function hasSteel(material: string | null | undefined): boolean {
  return material?.includes('Steel') || false
}

// Load logo as base64
function getLogoBase64(): string {
  const logoPath = path.join(process.cwd(), 'public', 'caribou-logo.png')
  const logoBuffer = fs.readFileSync(logoPath)
  return logoBuffer.toString('base64')
}

// Fetch image from URL and return as base64
async function fetchImageAsBase64(url: string): Promise<{ base64: string; format: string } | null> {
  try {
    // Handle SSL parameter for URLs that need it
    const fetchUrl = url.includes('?')
      ? (url.includes('ssl=') ? url : `${url}&ssl=1`)
      : `${url}?ssl=1`

    const response = await fetch(fetchUrl)
    if (!response.ok) return null

    const contentType = response.headers.get('content-type') || 'image/jpeg'
    const arrayBuffer = await response.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')

    // Determine format from content type
    let format = 'JPEG'
    if (contentType.includes('png')) format = 'PNG'
    else if (contentType.includes('gif')) format = 'GIF'
    else if (contentType.includes('webp')) format = 'WEBP'

    return { base64, format }
  } catch {
    return null
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: params.id },
    include: {
      supplier: true,
      lineItems: {
        include: {
          product: true,
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

  if (!po) {
    return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })
  }

  // Pre-fetch all color images
  const colorImages: Map<string, { base64: string; format: string }> = new Map()
  await Promise.all(
    po.lineItems
      .filter(item => item.color?.imageUrl)
      .map(async (item) => {
        if (item.color?.imageUrl) {
          const imageData = await fetchImageAsBase64(item.color.imageUrl)
          if (imageData) {
            colorImages.set(item.color.imageUrl, imageData)
          }
        }
      })
  )

  // Pre-fetch all engraving images
  const engravingImages: Map<string, { base64: string; format: string }> = new Map()
  await Promise.all(
    po.lineItems
      .flatMap(item => item.engravings || [])
      .filter(eng => eng.engravingArt?.imageUrl)
      .map(async (eng) => {
        if (eng.engravingArt?.imageUrl && !engravingImages.has(eng.engravingArt.imageUrl)) {
          const imageData = await fetchImageAsBase64(eng.engravingArt.imageUrl)
          if (imageData) {
            engravingImages.set(eng.engravingArt.imageUrl, imageData)
          }
        }
      })
  )

  // Create PDF
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  let y = 20

  // Header with logo
  try {
    const logoBase64 = getLogoBase64()
    // Logo dimensions: original is 300x162, scale to fit nicely
    const logoWidth = 60
    const logoHeight = (162 / 300) * logoWidth
    doc.addImage(`data:image/png;base64,${logoBase64}`, 'PNG', 20, y - 5, logoWidth, logoHeight)
  } catch {
    // Fallback to text if logo can't be loaded
    doc.setFontSize(24)
    doc.setFont('helvetica', 'bold')
    doc.text('Caribou Lodge', 20, y)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'normal')
    doc.text('Yo-Yo Company', 20, y + 8)
  }

  // PO Number and Date
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text('PURCHASE ORDER', pageWidth - 20, y, { align: 'right' })

  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  doc.text(po.poNumber, pageWidth - 20, y + 8, { align: 'right' })
  doc.text(`Date: ${formatDate(po.createdAt)}`, pageWidth - 20, y + 16, { align: 'right' })
  doc.text(`Status: ${po.status}`, pageWidth - 20, y + 24, { align: 'right' })

  y += 50

  // Supplier info
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('SUPPLIER:', 20, y)
  doc.setFont('helvetica', 'normal')
  y += 6
  doc.text(po.supplier.name, 20, y)
  if (po.supplier.address) {
    y += 5
    doc.text(po.supplier.address, 20, y)
  }
  if (po.supplier.city || po.supplier.state || po.supplier.zip) {
    y += 5
    doc.text(
      `${po.supplier.city || ''}${po.supplier.city && po.supplier.state ? ', ' : ''}${po.supplier.state || ''} ${po.supplier.zip || ''}`.trim(),
      20,
      y
    )
  }
  if (po.supplier.email) {
    y += 5
    doc.text(po.supplier.email, 20, y)
  }
  if (po.supplier.phone) {
    y += 5
    doc.text(po.supplier.phone, 20, y)
  }

  y += 15

  // Line items table
  const colWidths = [50, 60, 50, 20]  // Product, Color, Engravings, Qty
  const startX = 20
  const colorImageSize = 12  // Size of color thumbnail
  const engravingImageSize = 10  // Size of engraving thumbnail
  let tableY = y

  // Table header - Caribou Lodge maroon (#280003)
  doc.setFillColor(40, 0, 3)
  doc.rect(startX, tableY, pageWidth - 40, 8, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(9)
  let colX = startX + 2
  doc.text('Product', colX, tableY + 6)
  colX += colWidths[0]
  doc.text('Color', colX, tableY + 6)
  colX += colWidths[1]
  doc.text('Engravings', colX, tableY + 6)
  colX += colWidths[2]
  doc.text('Qty', colX, tableY + 6)

  tableY += 10
  doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'normal')

  // Table rows
  for (const item of po.lineItems) {
    const hasColor = item.color !== null
    const pantoneChips = item.color?.pantoneChips || []
    const hasSteelRim = hasSteel(item.product.material) && item.ringColor
    const hasColorImage = hasColor && item.color?.imageUrl && colorImages.has(item.color.imageUrl)
    const engravings = item.engravings || []

    // Calculate row height based on content
    let rowHeight = 14
    if (hasColor && pantoneChips.length > 0) {
      rowHeight = hasSteelRim ? 26 : 20  // Extra space for rim color line
    } else if (hasSteelRim) {
      rowHeight = 18  // Just rim color, no pantone chips
    }
    // Ensure minimum height for color image
    if (hasColorImage && rowHeight < 16) {
      rowHeight = 16
    }
    // Ensure minimum height for engravings (each engraving needs ~12 height)
    const engravingsHeight = engravings.length * 12 + 2
    if (engravingsHeight > rowHeight) {
      rowHeight = engravingsHeight
    }

    // Product column
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text(item.product.name, startX + 2, tableY + 5, { maxWidth: colWidths[0] - 4 })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6)
    doc.setTextColor(100, 100, 100)
    doc.text(item.product.sku, startX + 2, tableY + 10, { maxWidth: colWidths[0] - 4 })
    doc.setTextColor(0, 0, 0)

    // Color column
    colX = startX + colWidths[0]
    if (hasColor && item.color) {
      // Text offset for when image is present
      const textOffsetX = hasColorImage ? colorImageSize + 3 : 0

      // Draw color image if available
      if (hasColorImage && item.color.imageUrl) {
        const imgData = colorImages.get(item.color.imageUrl)
        if (imgData) {
          try {
            doc.addImage(
              `data:image/${imgData.format.toLowerCase()};base64,${imgData.base64}`,
              imgData.format,
              colX + 2,
              tableY + 1,
              colorImageSize,
              colorImageSize
            )
            // Draw border around image
            doc.setDrawColor(200, 200, 200)
            doc.rect(colX + 2, tableY + 1, colorImageSize, colorImageSize, 'S')
          } catch {
            // Silently fail if image can't be added
          }
        }
      }

      doc.setFontSize(7)
      doc.setFont('helvetica', 'bold')
      doc.text(item.color.name, colX + 2 + textOffsetX, tableY + 5, { maxWidth: colWidths[1] - 4 - textOffsetX })
      doc.setFont('helvetica', 'normal')

      // Show rim color for steel products
      if (hasSteel(item.product.material) && item.ringColor) {
        doc.setFontSize(6)
        doc.setTextColor(80, 80, 80)
        doc.text(`Rim: ${item.ringColor}`, colX + 2 + textOffsetX, tableY + 10, { maxWidth: colWidths[1] - 4 - textOffsetX })
        doc.setTextColor(0, 0, 0)
      }

      // Pantone chips
      if (pantoneChips.length > 0) {
        doc.setFontSize(5)
        doc.setTextColor(80, 80, 80)
        const chipWidth = 6
        const chipHeight = 5
        let chipX = colX + 2 + textOffsetX
        // Move chips down if rim color is shown
        const chipYOffset = hasSteelRim ? 6 : 0
        const chipY = tableY + 8 + chipYOffset

        for (const cp of pantoneChips.slice(0, 3)) {
          // Draw color swatch
          const hex = cp.pantone.hexColor
          const r = parseInt(hex.slice(1, 3), 16)
          const g = parseInt(hex.slice(3, 5), 16)
          const b = parseInt(hex.slice(5, 7), 16)
          doc.setFillColor(r, g, b)
          doc.rect(chipX, chipY, chipWidth, chipHeight, 'F')
          doc.setDrawColor(150, 150, 150)
          doc.rect(chipX, chipY, chipWidth, chipHeight, 'S')
          chipX += chipWidth + 1
        }

        // List Pantone codes below swatches
        doc.setFontSize(4)
        const pantoneNames = pantoneChips.map(cp => cp.pantone.code).slice(0, 3).join(', ')
        doc.text(pantoneNames, colX + 2 + textOffsetX, tableY + 15 + chipYOffset, { maxWidth: colWidths[1] - 4 - textOffsetX })
        doc.setTextColor(0, 0, 0)
      }
    } else {
      doc.setFontSize(7)
      doc.setTextColor(150, 150, 150)
      doc.text('-', colX + 2, tableY + 6)
      doc.setTextColor(0, 0, 0)
    }

    // Engravings column
    colX += colWidths[1]
    if (engravings.length > 0) {
      let engY = tableY + 2
      for (const eng of engravings) {
        const engArt = eng.engravingArt
        if (!engArt) continue

        // Draw engraving image if available
        if (engArt.imageUrl && engravingImages.has(engArt.imageUrl)) {
          const imgData = engravingImages.get(engArt.imageUrl)
          if (imgData) {
            try {
              doc.addImage(
                `data:image/${imgData.format.toLowerCase()};base64,${imgData.base64}`,
                imgData.format,
                colX + 2,
                engY,
                engravingImageSize,
                engravingImageSize
              )
              // Draw border around image
              doc.setDrawColor(200, 200, 200)
              doc.rect(colX + 2, engY, engravingImageSize, engravingImageSize, 'S')
            } catch {
              // Silently fail if image can't be added
            }
          }
        }

        // Engraving name and position
        doc.setFontSize(6)
        doc.setFont('helvetica', 'bold')
        doc.text(engArt.name, colX + engravingImageSize + 4, engY + 4, { maxWidth: colWidths[2] - engravingImageSize - 6 })
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(100, 100, 100)
        doc.text(engArt.position, colX + engravingImageSize + 4, engY + 8, { maxWidth: colWidths[2] - engravingImageSize - 6 })
        doc.setTextColor(0, 0, 0)

        engY += 12
      }
    } else {
      doc.setFontSize(7)
      doc.setTextColor(150, 150, 150)
      doc.text('-', colX + 2, tableY + 6)
      doc.setTextColor(0, 0, 0)
    }

    // Quantity column
    colX += colWidths[2]
    doc.setFontSize(8)
    doc.text(`${item.quantity}`, colX + 2, tableY + 6)
    doc.setFontSize(6)
    doc.setTextColor(100, 100, 100)
    doc.text(item.product.unit, colX + 2, tableY + 10)
    doc.setTextColor(0, 0, 0)

    tableY += rowHeight
    doc.setDrawColor(200, 200, 200)
    doc.line(startX, tableY - 2, pageWidth - 20, tableY - 2)
  }

  // Notes
  if (po.notes) {
    tableY += 20
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('Notes:', 20, tableY)
    doc.setFont('helvetica', 'normal')
    tableY += 6
    doc.text(po.notes, 20, tableY, { maxWidth: pageWidth - 40 })
  }

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 20
  doc.setFontSize(8)
  doc.setTextColor(128, 128, 128)
  doc.text('Thank you for your business!', pageWidth / 2, footerY, { align: 'center' })
  doc.text('Caribou Lodge Yo-Yo Company', pageWidth / 2, footerY + 5, { align: 'center' })

  // Generate PDF buffer
  const pdfBuffer = Buffer.from(doc.output('arraybuffer'))

  return new NextResponse(pdfBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${po.poNumber}.pdf"`,
    },
  })
}
