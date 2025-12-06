import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { jsPDF } from 'jspdf'

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: params.id },
    include: {
      supplier: true,
      lineItems: { include: { product: true } },
    },
  })

  if (!po) {
    return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })
  }

  // Calculate totals
  const subtotal = po.lineItems.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0
  )
  const tax = subtotal * (po.taxRate / 100)
  const total = subtotal + tax + po.shippingCost

  // Create PDF
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  let y = 20

  // Header
  doc.setFontSize(24)
  doc.setFont('helvetica', 'bold')
  doc.text('Caribou Lodge', 20, y)

  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  doc.text('Yo-Yo Company', 20, y + 8)

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
  const colWidths = [80, 25, 35, 35]
  const startX = 20
  let tableY = y

  // Table header - Caribou Lodge maroon (#280003)
  doc.setFillColor(40, 0, 3)
  doc.rect(startX, tableY, pageWidth - 40, 8, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.text('Product', startX + 2, tableY + 6)
  doc.text('Qty', startX + colWidths[0] + 2, tableY + 6)
  doc.text('Unit Price', startX + colWidths[0] + colWidths[1] + 2, tableY + 6)
  doc.text('Total', startX + colWidths[0] + colWidths[1] + colWidths[2] + 2, tableY + 6)

  tableY += 10
  doc.setTextColor(0, 0, 0)
  doc.setFont('helvetica', 'normal')

  // Table rows
  for (const item of po.lineItems) {
    const lineTotal = item.quantity * item.unitPrice

    doc.text(item.product.name, startX + 2, tableY + 5)
    doc.text(item.product.sku, startX + 2, tableY + 10, { maxWidth: colWidths[0] - 4 })
    doc.setFontSize(8)
    doc.text(`${item.quantity} ${item.product.unit}`, startX + colWidths[0] + 2, tableY + 6)
    doc.text(formatCurrency(item.unitPrice), startX + colWidths[0] + colWidths[1] + 2, tableY + 6)
    doc.text(formatCurrency(lineTotal), startX + colWidths[0] + colWidths[1] + colWidths[2] + 2, tableY + 6)
    doc.setFontSize(10)

    tableY += 14
    doc.setDrawColor(200, 200, 200)
    doc.line(startX, tableY - 2, pageWidth - 20, tableY - 2)
  }

  // Totals section
  const totalsX = startX + colWidths[0] + colWidths[1]
  tableY += 5

  doc.text('Subtotal:', totalsX, tableY)
  doc.text(formatCurrency(subtotal), pageWidth - 22, tableY, { align: 'right' })

  tableY += 7
  doc.text(`Tax (${po.taxRate}%):`, totalsX, tableY)
  doc.text(formatCurrency(tax), pageWidth - 22, tableY, { align: 'right' })

  tableY += 7
  doc.text('Shipping:', totalsX, tableY)
  doc.text(formatCurrency(po.shippingCost), pageWidth - 22, tableY, { align: 'right' })

  tableY += 10
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('TOTAL:', totalsX, tableY)
  doc.text(formatCurrency(total), pageWidth - 22, tableY, { align: 'right' })

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
