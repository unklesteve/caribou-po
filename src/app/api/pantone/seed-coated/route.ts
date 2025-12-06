import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import pantoneCoated from '@/data/pantone-coated.json'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type PantoneCoatedEntry = {
  pantone: string
  hex: string
}

export async function POST() {
  try {
    let created = 0
    let skipped = 0

    const entries = pantoneCoated as PantoneCoatedEntry[]

    for (const entry of entries) {
      const { pantone, hex } = entry

      // Skip if hex is missing or invalid
      if (!hex || typeof hex !== 'string') {
        skipped++
        continue
      }

      // Format code like "PANTONE 100 C" from "100-c"
      const number = pantone.replace('-c', '').toUpperCase()
      const code = `PANTONE ${number} C`
      const hexColor = hex.startsWith('#') ? hex : `#${hex}`

      // Check if already exists
      const existing = await prisma.pantoneChip.findFirst({
        where: { code }
      })

      if (existing) {
        skipped++
        continue
      }

      await prisma.pantoneChip.create({
        data: {
          code,
          name: code, // Use code as name for coated colors
          hexColor,
        },
      })
      created++
    }

    return NextResponse.json({
      success: true,
      message: `Imported ${created} Pantone Coated colors (${skipped} skipped as duplicates)`,
      total: entries.length,
      created,
      skipped,
    })
  } catch (error) {
    console.error('Pantone Coated seed error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { success: false, error: `Failed to seed Pantone Coated colors: ${errorMessage}` },
      { status: 500 }
    )
  }
}

export async function GET() {
  const count = await prisma.pantoneChip.count({
    where: { code: { endsWith: ' C' } }
  })
  return NextResponse.json({
    message: 'POST to this endpoint to import Pantone Coated colors',
    currentCoatedCount: count,
    availableToImport: pantoneCoated.length,
  })
}
