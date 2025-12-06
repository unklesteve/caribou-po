import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import pantoneNumbers from '@/data/pantone-numbers.json'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function formatPantoneName(name: string): string {
  return name
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

type PantoneEntry = {
  name: string
  hex: string
}

export async function POST() {
  try {
    let created = 0
    let skipped = 0

    const entries = Object.entries(pantoneNumbers) as [string, PantoneEntry][]

    for (const [number, data] of entries) {
      const hex = data.hex
      const name = data.name

      // Skip if hex is missing or invalid
      if (!hex || typeof hex !== 'string') {
        skipped++
        continue
      }

      const code = `PANTONE ${number} TCX`
      const displayName = formatPantoneName(name)
      const hexColor = hex.startsWith('#') ? hex : `#${hex}`

      // Check if already exists
      const existing = await prisma.pantoneChip.findFirst({
        where: {
          OR: [
            { code },
            { name: displayName }
          ]
        }
      })

      if (existing) {
        skipped++
        continue
      }

      await prisma.pantoneChip.create({
        data: {
          code,
          name: displayName,
          hexColor,
        },
      })
      created++
    }

    return NextResponse.json({
      success: true,
      message: `Imported ${created} Pantone colors (${skipped} skipped as duplicates)`,
      total: entries.length,
      created,
      skipped,
    })
  } catch (error) {
    console.error('Pantone seed error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { success: false, error: `Failed to seed Pantone colors: ${errorMessage}` },
      { status: 500 }
    )
  }
}

export async function GET() {
  const count = await prisma.pantoneChip.count()
  const entries = Object.keys(pantoneNumbers)
  return NextResponse.json({
    message: 'POST to this endpoint to import Pantone colors',
    currentCount: count,
    availableToImport: entries.length,
  })
}
