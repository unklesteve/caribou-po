import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const search = searchParams.get('search') || ''
  const activeOnly = searchParams.get('activeOnly') === 'true'

  // Check if search term matches a tag name or "untagged"
  const searchLower = search.toLowerCase().trim()
  const isUntaggedSearch = searchLower === 'untagged'

  // Find matching tag if search matches a tag name
  let matchingTag = null
  if (search && !isUntaggedSearch) {
    matchingTag = await prisma.colorTag.findFirst({
      where: { name: { equals: search } },
    })
    // Try case-insensitive match
    if (!matchingTag) {
      const allTags = await prisma.colorTag.findMany()
      matchingTag = allTags.find(t => t.name.toLowerCase() === searchLower) || null
    }
  }

  const colors = await prisma.yoyoColor.findMany({
    where: {
      AND: [
        // If searching for a tag, filter by that tag
        matchingTag
          ? { tags: { some: { id: matchingTag.id } } }
          : isUntaggedSearch
            ? { tags: { none: {} } }
            : search
              ? { name: { contains: search } }
              : {},
        activeOnly ? { isActive: true } : {},
      ],
    },
    include: {
      pantoneChips: {
        include: { pantone: true },
        orderBy: { orderIndex: 'asc' },
      },
      tags: true,
    },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(colors)
}

export async function POST(request: NextRequest) {
  const body = await request.json()

  const color = await prisma.yoyoColor.create({
    data: {
      name: body.name,
      imageUrl: body.imageUrl || null,
      description: body.description || null,
      isActive: body.isActive ?? true,
      pantoneLocked: body.pantoneLocked ?? false,
      pantoneChips: body.pantoneIds?.length
        ? {
            create: body.pantoneIds.map((pantoneId: string, index: number) => ({
              pantoneId,
              orderIndex: index,
            })),
          }
        : undefined,
      tags: body.tagIds?.length
        ? { connect: body.tagIds.map((id: string) => ({ id })) }
        : undefined,
    },
    include: {
      pantoneChips: {
        include: { pantone: true },
        orderBy: { orderIndex: 'asc' },
      },
      tags: true,
    },
  })

  return NextResponse.json(color, { status: 201 })
}
