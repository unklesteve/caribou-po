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
              tags: true,
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

  // Line items - card-based layout for factory readability
  const startX = 20
  const cardWidth = pageWidth - 40
  const colorImageSize = 35  // Large color photo for factory reference
  const engravingImageSize = 18  // Engraving thumbnail size
  let cardY = y
  const pageHeight = doc.internal.pageSize.getHeight()

  for (let itemIndex = 0; itemIndex < po.lineItems.length; itemIndex++) {
    const item = po.lineItems[itemIndex]
    const hasColor = item.color !== null
    const pantoneChips = item.color?.pantoneChips || []
    const colorTags = item.color?.tags || []
    const hasSteelRim = hasSteel(item.product.material) && item.ringColor
    const hasColorImage = hasColor && item.color?.imageUrl && colorImages.has(item.color.imageUrl)
    const engravings = item.engravings || []
    const colorDescription = item.color?.description || ''

    // Calculate card height based on content
    // Trace through actual Y positions used in rendering:
    // Start at cardY + 6, then:
    // - Product name: +5
    // - SKU: +6
    // - Color name: +5 (if hasColor)
    // - Tags: +6 (if tags)
    // - Rim color: +5 (if steel)
    // - Description: +2 spacing + lines*4
    // - Pantone: +2 spacing + 8 chip + 5 for code text below

    let leftContentHeight = 6 + 5 + 6  // Initial offset + product + SKU

    if (hasColor) {
      leftContentHeight += 5  // Color name

      if (colorTags.length > 0) {
        leftContentHeight += 6
      }

      if (hasSteelRim) {
        leftContentHeight += 5
      }

      if (colorDescription) {
        const descLines = Math.min(3, Math.ceil(colorDescription.length / 50))
        leftContentHeight += descLines * 4 + 2
      }

      if (pantoneChips.length > 0) {
        leftContentHeight += 2 + 8 + 5  // spacing + chip height + code text
      }
    }

    // Add bottom padding
    leftContentHeight += 4

    // Calculate right side height for engravings
    // Each engraving needs: image height (18) + spacing (4) = 22
    const engravingsHeight = engravings.length > 0
      ? 14 + 5 + (engravings.length * 22) + 4  // qty display + label + engravings + padding
      : 14 + 4  // Just quantity display + padding

    // Card height is the max of left content, right content, or color image height
    const cardHeight = Math.max(leftContentHeight, engravingsHeight, colorImageSize + 10)

    // Check if we need a new page
    if (cardY + cardHeight > pageHeight - 30) {
      doc.addPage()
      cardY = 20
    }

    // Card background with light border
    doc.setDrawColor(200, 200, 200)
    doc.setFillColor(252, 252, 252)
    doc.roundedRect(startX, cardY, cardWidth, cardHeight, 2, 2, 'FD')

    // === LEFT SECTION: Color Image (large) ===
    const imageX = startX + 4
    const imageY = cardY + 4

    if (hasColorImage && item.color?.imageUrl) {
      const imgData = colorImages.get(item.color.imageUrl)
      if (imgData) {
        try {
          doc.addImage(
            `data:image/${imgData.format.toLowerCase()};base64,${imgData.base64}`,
            imgData.format,
            imageX,
            imageY,
            colorImageSize,
            colorImageSize
          )
          // Border around image
          doc.setDrawColor(180, 180, 180)
          doc.rect(imageX, imageY, colorImageSize, colorImageSize, 'S')
        } catch {
          // Draw placeholder
          doc.setFillColor(240, 240, 240)
          doc.rect(imageX, imageY, colorImageSize, colorImageSize, 'F')
          doc.setFontSize(8)
          doc.setTextColor(150, 150, 150)
          doc.text('No Image', imageX + 5, imageY + 18)
        }
      }
    } else if (hasColor) {
      // No image placeholder
      doc.setFillColor(240, 240, 240)
      doc.rect(imageX, imageY, colorImageSize, colorImageSize, 'F')
      doc.setDrawColor(200, 200, 200)
      doc.rect(imageX, imageY, colorImageSize, colorImageSize, 'S')
      doc.setFontSize(7)
      doc.setTextColor(150, 150, 150)
      doc.text('No Image', imageX + 6, imageY + 18)
    }

    // === MIDDLE SECTION: Product & Color Info ===
    const infoX = startX + colorImageSize + 12
    const rightSectionWidth = 60  // Reserve space for quantity & engravings
    const infoWidth = cardWidth - colorImageSize - 16 - rightSectionWidth  // Don't overlap right section
    let infoY = cardY + 6

    // Product name (large, bold)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(0, 0, 0)
    doc.text(item.product.name, infoX, infoY)
    infoY += 5

    // Product SKU
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 100, 100)
    doc.text(`SKU: ${item.product.sku}`, infoX, infoY)
    infoY += 6

    // Color name (prominent)
    if (hasColor && item.color) {
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(40, 0, 3)  // Maroon
      doc.text(item.color.name, infoX, infoY)
      infoY += 5

      // Color tags (badges)
      if (colorTags.length > 0) {
        let tagX = infoX
        doc.setFontSize(7)
        for (const tag of colorTags.slice(0, 4)) {
          const tagWidth = doc.getTextWidth(tag.name) + 4
          // Tag background
          doc.setFillColor(230, 230, 250)  // Light purple/blue
          doc.roundedRect(tagX, infoY - 3, tagWidth, 5, 1, 1, 'F')
          doc.setTextColor(80, 80, 120)
          doc.text(tag.name, tagX + 2, infoY)
          tagX += tagWidth + 2
        }
        infoY += 6
      }

      // Rim color for steel products
      if (hasSteelRim) {
        doc.setFontSize(9)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(60, 60, 60)
        doc.text(`Rim Color: ${item.ringColor}`, infoX, infoY)
        infoY += 5
      }

      // Color description
      if (colorDescription) {
        doc.setFontSize(8)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(80, 80, 80)
        const splitDesc = doc.splitTextToSize(colorDescription, infoWidth)
        doc.text(splitDesc.slice(0, 3), infoX, infoY)  // Max 3 lines
        infoY += splitDesc.slice(0, 3).length * 4
      }

      // Pantone colors (larger swatches)
      if (pantoneChips.length > 0) {
        infoY += 2
        const chipWidth = 12
        const chipHeight = 8
        let chipX = infoX

        for (const cp of pantoneChips.slice(0, 5)) {
          const hex = cp.pantone.hexColor
          const r = parseInt(hex.slice(1, 3), 16)
          const g = parseInt(hex.slice(3, 5), 16)
          const b = parseInt(hex.slice(5, 7), 16)
          doc.setFillColor(r, g, b)
          doc.rect(chipX, infoY, chipWidth, chipHeight, 'F')
          doc.setDrawColor(150, 150, 150)
          doc.rect(chipX, infoY, chipWidth, chipHeight, 'S')

          // Pantone code below
          doc.setFontSize(5)
          doc.setTextColor(60, 60, 60)
          doc.text(cp.pantone.code, chipX, infoY + chipHeight + 3, { maxWidth: chipWidth })
          chipX += chipWidth + 3
        }
      }
    } else {
      doc.setFontSize(9)
      doc.setTextColor(150, 150, 150)
      doc.text('No color specified', infoX, infoY)
    }

    // === RIGHT SECTION: Quantity & Engravings ===
    const rightX = startX + cardWidth - rightSectionWidth
    let rightY = cardY + 6

    // Quantity (large, prominent)
    doc.setFontSize(20)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(40, 0, 3)  // Maroon
    doc.text(`${item.quantity}`, rightX + rightSectionWidth / 2, rightY + 2, { align: 'center' })
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 100, 100)
    doc.text('pieces', rightX + rightSectionWidth / 2, rightY + 8, { align: 'center' })
    rightY += 14

    // Engravings section
    if (engravings.length > 0) {
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(60, 60, 60)
      doc.text('Engravings:', rightX, rightY)
      rightY += 5

      for (const eng of engravings) {
        const engArt = eng.engravingArt
        if (!engArt) continue

        // Engraving image - draw in a contained area without stretching
        let engImgDrawn = false
        if (engArt.imageUrl && engravingImages.has(engArt.imageUrl)) {
          const imgData = engravingImages.get(engArt.imageUrl)
          if (imgData) {
            try {
              // Use jsPDF's automatic aspect ratio by only specifying width
              // The image will scale proportionally
              doc.addImage(
                `data:image/${imgData.format.toLowerCase()};base64,${imgData.base64}`,
                imgData.format,
                rightX,
                rightY,
                engravingImageSize,
                0  // Height 0 means auto-calculate from aspect ratio
              )
              engImgDrawn = true
            } catch {
              // Skip if can't add
            }
          }
        }
        // Draw placeholder border if no image
        if (!engImgDrawn) {
          doc.setDrawColor(220, 220, 220)
          doc.setFillColor(248, 248, 248)
          doc.rect(rightX, rightY, engravingImageSize, engravingImageSize * 0.7, 'FD')
        }

        // Engraving name and position
        const engTextX = rightX + engravingImageSize + 3
        const engTextWidth = rightSectionWidth - engravingImageSize - 6
        doc.setFontSize(7)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(0, 0, 0)
        doc.text(engArt.name, engTextX, rightY + 6, { maxWidth: engTextWidth })
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(100, 100, 100)
        doc.text(engArt.position, engTextX, rightY + 11, { maxWidth: engTextWidth })

        rightY += engravingImageSize + 4
      }
    }

    cardY += cardHeight + 5
  }

  let tableY = cardY

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
