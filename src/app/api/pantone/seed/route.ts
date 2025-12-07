import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import pantoneCoated from '@/data/pantone-coated.json'

export async function POST() {
  let created = 0
  let skipped = 0

  for (const color of pantoneCoated) {
    try {
      await prisma.pantoneChip.create({
        data: {
          code: color.pantone.toUpperCase(),
          name: color.pantone.replace(/-c$/i, '').replace(/-/g, ' '),
          hexColor: color.hex,
        },
      })
      created++
    } catch {
      // Color already exists, skip
      skipped++
    }
  }

  return NextResponse.json({
    message: `Seeded ${created} Pantone colors, skipped ${skipped} duplicates`,
    total: pantoneCoated.length,
    created,
    skipped,
  })
}
