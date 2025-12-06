import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import pantoneData from '@/data/pantone-colors.json'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function formatPantoneName(name: string): string {
  return name
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function formatPantoneCode(name: string): string {
  return 'PANTONE ' + name
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export async function POST() {
  try {
    let created = 0
    let skipped = 0

    for (let i = 0; i < pantoneData.names.length; i++) {
      const name = pantoneData.names[i]
      const hex = pantoneData.values[i]

      const code = formatPantoneCode(name)
      const displayName = formatPantoneName(name)

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
          hexColor: hex,
        },
      })
      created++
    }

    return NextResponse.json({
      success: true,
      message: `Imported ${created} Pantone colors (${skipped} skipped as duplicates)`,
      total: pantoneData.names.length,
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
  return NextResponse.json({
    message: 'POST to this endpoint to import Pantone colors',
    currentCount: count,
    availableToImport: pantoneData.names.length,
  })
}
