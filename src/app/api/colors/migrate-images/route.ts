import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function downloadImage(url: string, filename: string): Promise<string | null> {
  try {
    // Add ssl=1 if needed
    let fullUrl = url
    if (!fullUrl.includes('ssl=')) {
      fullUrl = fullUrl.includes('?') ? `${fullUrl}&ssl=1` : `${fullUrl}?ssl=1`
    }

    const response = await fetch(fullUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'image/*,*/*',
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg'

    // Determine extension from content type
    let ext = 'jpg'
    if (contentType.includes('png')) ext = 'png'
    else if (contentType.includes('gif')) ext = 'gif'
    else if (contentType.includes('webp')) ext = 'webp'

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    if (buffer.length < 100) {
      throw new Error('Image too small, likely invalid')
    }

    // Create safe filename
    const safeFilename = filename
      .replace(/[^a-zA-Z0-9-_]/g, '-')
      .substring(0, 50)
    const finalFilename = `${safeFilename}-${Date.now()}.${ext}`

    // Ensure directory exists
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'colors')
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
    }

    // Write file
    const filepath = path.join(uploadDir, finalFilename)
    await writeFile(filepath, buffer)

    return `/uploads/colors/${finalFilename}`
  } catch (error) {
    console.error(`Failed to download ${url}:`, error)
    return null
  }
}

export async function POST() {
  try {
    // Get all colors with external image URLs (not local)
    const colors = await prisma.yoyoColor.findMany({
      where: {
        imageUrl: {
          not: null,
        },
        NOT: {
          imageUrl: {
            startsWith: '/uploads',
          },
        },
      },
    })

    const results: { id: string; name: string; status: string; newUrl?: string; error?: string }[] = []

    for (const color of colors) {
      if (!color.imageUrl) continue

      // Skip if already local
      if (color.imageUrl.startsWith('/uploads')) {
        results.push({
          id: color.id,
          name: color.name,
          status: 'skipped',
          newUrl: color.imageUrl,
        })
        continue
      }

      const newUrl = await downloadImage(color.imageUrl, color.name)

      if (newUrl) {
        // Update the database
        await prisma.yoyoColor.update({
          where: { id: color.id },
          data: { imageUrl: newUrl },
        })

        results.push({
          id: color.id,
          name: color.name,
          status: 'migrated',
          newUrl,
        })
      } else {
        results.push({
          id: color.id,
          name: color.name,
          status: 'failed',
          error: 'Could not download image',
        })
      }
    }

    const migrated = results.filter(r => r.status === 'migrated').length
    const failed = results.filter(r => r.status === 'failed').length
    const skipped = results.filter(r => r.status === 'skipped').length

    return NextResponse.json({
      success: true,
      message: `Migrated ${migrated} images, ${failed} failed, ${skipped} skipped`,
      results,
    })
  } catch (error) {
    console.error('Migration error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { success: false, error: `Migration failed: ${errorMessage}` },
      { status: 500 }
    )
  }
}

export async function GET() {
  const externalCount = await prisma.yoyoColor.count({
    where: {
      imageUrl: {
        not: null,
      },
      NOT: {
        imageUrl: {
          startsWith: '/uploads',
        },
      },
    },
  })

  const localCount = await prisma.yoyoColor.count({
    where: {
      imageUrl: {
        startsWith: '/uploads',
      },
    },
  })

  return NextResponse.json({
    message: 'POST to this endpoint to migrate external images to local storage',
    externalImages: externalCount,
    localImages: localCount,
  })
}
