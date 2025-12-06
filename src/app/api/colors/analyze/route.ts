import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import sharp from 'sharp'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes for processing

// Convert hex to RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 }
}

// Convert RGB to LAB for better color comparison
function rgbToLab(rgb: { r: number; g: number; b: number }): { l: number; a: number; b: number } {
  // First convert RGB to XYZ
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

// Extract dominant colors from image using k-means clustering
async function extractDominantColors(imageUrl: string, numColors: number = 5): Promise<{ r: number; g: number; b: number }[]> {
  // Fetch the image
  const response = await fetch(imageUrl.includes('?') ? imageUrl : `${imageUrl}?ssl=1`)
  const arrayBuffer = await response.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  // Resize image for faster processing and get raw pixel data
  const { data, info } = await sharp(buffer)
    .resize(100, 100, { fit: 'cover' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  // Sample pixels
  const pixels: { r: number; g: number; b: number }[] = []
  for (let i = 0; i < data.length; i += 3) {
    pixels.push({
      r: data[i],
      g: data[i + 1],
      b: data[i + 2],
    })
  }

  // Simple k-means clustering
  const colors = kMeansClustering(pixels, numColors)
  return colors
}

function kMeansClustering(
  pixels: { r: number; g: number; b: number }[],
  k: number
): { r: number; g: number; b: number }[] {
  // Initialize centroids randomly
  let centroids: { r: number; g: number; b: number }[] = []
  const usedIndices = new Set<number>()

  while (centroids.length < k) {
    const idx = Math.floor(Math.random() * pixels.length)
    if (!usedIndices.has(idx)) {
      usedIndices.add(idx)
      centroids.push({ ...pixels[idx] })
    }
  }

  // Run k-means iterations
  for (let iter = 0; iter < 10; iter++) {
    // Assign pixels to clusters
    const clusters: { r: number; g: number; b: number }[][] = Array.from({ length: k }, () => [])

    for (const pixel of pixels) {
      let minDist = Infinity
      let closestCluster = 0

      for (let i = 0; i < k; i++) {
        const dist = Math.sqrt(
          Math.pow(pixel.r - centroids[i].r, 2) +
          Math.pow(pixel.g - centroids[i].g, 2) +
          Math.pow(pixel.b - centroids[i].b, 2)
        )
        if (dist < minDist) {
          minDist = dist
          closestCluster = i
        }
      }

      clusters[closestCluster].push(pixel)
    }

    // Update centroids
    centroids = clusters.map((cluster, i) => {
      if (cluster.length === 0) return centroids[i]

      const sum = cluster.reduce(
        (acc, p) => ({ r: acc.r + p.r, g: acc.g + p.g, b: acc.b + p.b }),
        { r: 0, g: 0, b: 0 }
      )

      return {
        r: Math.round(sum.r / cluster.length),
        g: Math.round(sum.g / cluster.length),
        b: Math.round(sum.b / cluster.length),
      }
    })
  }

  return centroids
}

// Find closest Pantone matches for a color
function findClosestPantones(
  color: { r: number; g: number; b: number },
  pantones: { id: string; code: string; hexColor: string }[],
  limit: number = 3
): { id: string; code: string; distance: number }[] {
  const colorLab = rgbToLab(color)

  const distances = pantones.map((pantone) => {
    const pantoneRgb = hexToRgb(pantone.hexColor)
    const pantoneLab = rgbToLab(pantoneRgb)
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

    // Get all Pantone chips
    const pantones = await prisma.pantoneChip.findMany({
      select: {
        id: true,
        code: true,
        hexColor: true,
      },
    })

    if (pantones.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No Pantone colors found. Please seed Pantone colors first.',
      })
    }

    const results: { colorId: string; colorName: string; matched: number; error?: string }[] = []

    for (const color of colors) {
      if (!color.imageUrl) continue

      try {
        // Extract dominant colors from image
        const dominantColors = await extractDominantColors(color.imageUrl, 5)

        // Find closest Pantone matches for each dominant color
        const matchedPantoneIds = new Set<string>()

        for (const dominantColor of dominantColors) {
          const closestPantones = findClosestPantones(dominantColor, pantones, 2)

          // Only add pantones with reasonable color distance (< 30 is a good match)
          for (const match of closestPantones) {
            if (match.distance < 30) {
              matchedPantoneIds.add(match.id)
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
          })
        } else {
          results.push({
            colorId: color.id,
            colorName: color.name,
            matched: 0,
            error: 'No close Pantone matches found',
          })
        }
      } catch (error) {
        results.push({
          colorId: color.id,
          colorName: color.name,
          matched: 0,
          error: error instanceof Error ? error.message : 'Failed to analyze image',
        })
      }
    }

    const successCount = results.filter((r) => r.matched > 0).length
    const failCount = results.filter((r) => r.matched === 0).length

    return NextResponse.json({
      success: true,
      message: `Analyzed ${colors.length} colors. ${successCount} matched, ${failCount} failed.`,
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
