import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

const DEFAULT_TAGS = [
  'Fade',
  'Splash',
  'Speckle',
  'Splatter',
  'Acid Wash',
  'Solid',
]

export async function POST() {
  let created = 0
  let skipped = 0

  for (const tagName of DEFAULT_TAGS) {
    const existing = await prisma.colorTag.findUnique({
      where: { name: tagName },
    })

    if (existing) {
      skipped++
      continue
    }

    await prisma.colorTag.create({
      data: { name: tagName },
    })
    created++
  }

  return NextResponse.json({
    success: true,
    message: `Created ${created} tags, skipped ${skipped} existing`,
  })
}
