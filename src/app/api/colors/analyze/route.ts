import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Convert hex to RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const cleanHex = hex.replace('#', '')
  return {
    r: parseInt(cleanHex.substring(0, 2), 16),
    g: parseInt(cleanHex.substring(2, 4), 16),
    b: parseInt(cleanHex.substring(4, 6), 16),
  }
}

// Convert RGB to LAB for better color comparison
function rgbToLab(rgb: { r: number; g: number; b: number }): { l: number; a: number; b: number } {
  let r = rgb.r / 255
  let g = rgb.g / 255
  let b = rgb.b / 255

  r = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92
  g = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92
  b = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92

  const x = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047
  const y = (r * 0.2126729 + g * 0.7151522 + b * 0.072175) / 1.0
  const z = (r * 0.0193339 + g * 0.119192 + b * 0.9503041) / 1.08883

  const fx = x > 0.008856 ? Math.pow(x, 1 / 3) : 7.787 * x + 16 / 116
  const fy = y > 0.008856 ? Math.pow(y, 1 / 3) : 7.787 * y + 16 / 116
  const fz = z > 0.008856 ? Math.pow(z, 1 / 3) : 7.787 * z + 16 / 116

  return {
    l: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  }
}

// Calculate Delta E (CIE76) - color difference
function deltaE(lab1: { l: number; a: number; b: number }, lab2: { l: number; a: number; b: number }): number {
  return Math.sqrt(
    Math.pow(lab1.l - lab2.l, 2) +
    Math.pow(lab1.a - lab2.a, 2) +
    Math.pow(lab1.b - lab2.b, 2)
  )
}

// Extract colors from image using sharp
async function extractDominantColors(imageUrl: string): Promise<{ r: number; g: number; b: number }[]> {
  // Dynamic import of sharp to avoid build issues
  const sharp = (await import('sharp')).default

  const fullUrl = imageUrl.includes('?') ? imageUrl : `${imageUrl}?ssl=1`

  const response = await fetch(fullUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; ColorAnalyzer/1.0)',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  // Get image stats which includes dominant color
  const { dominant, channels } = await sharp(buffer)
    .resize(50, 50, { fit: 'cover' })
    .removeAlpha()
    .stats()

  // Return dominant color and channel means as additional colors
  const colors: { r: number; g: number; b: number }[] = [dominant]

  // Add channel-based colors if available
  if (channels && channels.length >= 3) {
    colors.push({
      r: Math.round(channels[0].mean),
      g: Math.round(channels[1].mean),
      b: Math.round(channels[2].mean),
    })
  }

  return colors
}

// Find closest Pantone matches for a color
function findClosestPantones(
  color: { r: number; g: number; b: number },
  pantones: { id: string; code: string; hexColor: string; lab?: { l: number; a: number; b: number } }[],
  limit: number = 3
): { id: string; code: string; distance: number }[] {
  const colorLab = rgbToLab(color)

  const distances = pantones.map((pantone) => {
    const pantoneLab = pantone.lab || rgbToLab(hexToRgb(pantone.hexColor))
    return {
      id: pantone.id,
      code: pantone.code,
      distance: deltaE(colorLab, pantoneLab),
    }
  })

  distances.sort((a, b) => a.distance - b.distance)
  return distances.slice(0, limit)
}

export async function POST() {
  try {
    // Get all colors with images
    const colors = await prisma.yoyoColor.findMany({
      where: {
        imageUrl: { not: null },
      },
      include: {
        pantoneChips: true,
      },
    })

    if (colors.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No colors with images found.',
      })
    }

    // Get all Pantone chips and pre-compute LAB values
    const pantonesRaw = await prisma.pantoneChip.findMany({
      select: {
        id: true,
        code: true,
        hexColor: true,
      },
    })

    if (pantonesRaw.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No Pantone colors found. Please seed Pantone colors first.',
      })
    }

    // Pre-compute LAB values for all Pantones
    const pantones = pantonesRaw.map(p => ({
      ...p,
      lab: rgbToLab(hexToRgb(p.hexColor)),
    }))

    const results: { colorId: string; colorName: string; matched: number; pantones?: string[]; error?: string }[] = []

    for (const color of colors) {
      if (!color.imageUrl) continue

      try {
        // Extract dominant colors from image
        const dominantColors = await extractDominantColors(color.imageUrl)

        // Find closest Pantone matches for each dominant color
        const matchedPantoneIds = new Set<string>()
        const matchedPantoneCodes: string[] = []

        for (const dominantColor of dominantColors) {
          const closestPantones = findClosestPantones(dominantColor, pantones, 3)

          // Only add pantones with reasonable color distance (< 25 is a good match)
          for (const match of closestPantones) {
            if (match.distance < 25 && !matchedPantoneIds.has(match.id)) {
              matchedPantoneIds.add(match.id)
              matchedPantoneCodes.push(match.code)
            }
          }
        }

        // Update the color with matched Pantone chips
        if (matchedPantoneIds.size > 0) {
          // Remove existing associations
          await prisma.colorPantone.deleteMany({
            where: { colorId: color.id },
          })

          // Create new associations
          const pantoneIdsArray = Array.from(matchedPantoneIds)
          await prisma.colorPantone.createMany({
            data: pantoneIdsArray.map((pantoneId, index) => ({
              colorId: color.id,
              pantoneId,
              order: index,
            })),
          })

          results.push({
            colorId: color.id,
            colorName: color.name,
            matched: matchedPantoneIds.size,
            pantones: matchedPantoneCodes,
          })
        } else {
          results.push({
            colorId: color.id,
            colorName: color.name,
            matched: 0,
            error: 'No close Pantone matches found',
          })
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error'
        results.push({
          colorId: color.id,
          colorName: color.name,
          matched: 0,
          error: errorMsg,
        })
      }
    }

    const successCount = results.filter((r) => r.matched > 0).length
    const failCount = results.filter((r) => r.matched === 0).length

    return NextResponse.json({
      success: true,
      message: `Analyzed ${colors.length} colors. ${successCount} matched, ${failCount} had no close matches.`,
      results,
    })
  } catch (error) {
    console.error('Color analysis error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { success: false, error: `Failed to analyze colors: ${errorMessage}` },
      { status: 500 }
    )
  }
}

export async function GET() {
  const colorCount = await prisma.yoyoColor.count({
    where: { imageUrl: { not: null } },
  })
  const pantoneCount = await prisma.pantoneChip.count()

  return NextResponse.json({
    message: 'POST to this endpoint to analyze color images and match to Pantone colors',
    colorsWithImages: colorCount,
    pantoneColorsAvailable: pantoneCount,
  })
}
