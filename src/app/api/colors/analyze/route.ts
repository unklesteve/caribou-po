import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import path from 'path'
import { promisify } from 'util'

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

// Calculate Delta E 2000 - more perceptually accurate color difference
function deltaE2000(lab1: { l: number; a: number; b: number }, lab2: { l: number; a: number; b: number }): number {
  const L1 = lab1.l, a1 = lab1.a, b1 = lab1.b
  const L2 = lab2.l, a2 = lab2.a, b2 = lab2.b

  const kL = 1, kC = 1, kH = 1

  const C1 = Math.sqrt(a1 * a1 + b1 * b1)
  const C2 = Math.sqrt(a2 * a2 + b2 * b2)
  const Cbar = (C1 + C2) / 2

  const G = 0.5 * (1 - Math.sqrt(Math.pow(Cbar, 7) / (Math.pow(Cbar, 7) + Math.pow(25, 7))))

  const a1p = a1 * (1 + G)
  const a2p = a2 * (1 + G)

  const C1p = Math.sqrt(a1p * a1p + b1 * b1)
  const C2p = Math.sqrt(a2p * a2p + b2 * b2)

  let h1p = Math.atan2(b1, a1p) * 180 / Math.PI
  if (h1p < 0) h1p += 360
  let h2p = Math.atan2(b2, a2p) * 180 / Math.PI
  if (h2p < 0) h2p += 360

  const dLp = L2 - L1
  const dCp = C2p - C1p

  let dhp: number
  if (C1p * C2p === 0) {
    dhp = 0
  } else if (Math.abs(h2p - h1p) <= 180) {
    dhp = h2p - h1p
  } else if (h2p - h1p > 180) {
    dhp = h2p - h1p - 360
  } else {
    dhp = h2p - h1p + 360
  }

  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(dhp * Math.PI / 360)

  const Lbarp = (L1 + L2) / 2
  const Cbarp = (C1p + C2p) / 2

  let Hbarp: number
  if (C1p * C2p === 0) {
    Hbarp = h1p + h2p
  } else if (Math.abs(h1p - h2p) <= 180) {
    Hbarp = (h1p + h2p) / 2
  } else if (h1p + h2p < 360) {
    Hbarp = (h1p + h2p + 360) / 2
  } else {
    Hbarp = (h1p + h2p - 360) / 2
  }

  const T = 1 - 0.17 * Math.cos((Hbarp - 30) * Math.PI / 180)
    + 0.24 * Math.cos(2 * Hbarp * Math.PI / 180)
    + 0.32 * Math.cos((3 * Hbarp + 6) * Math.PI / 180)
    - 0.20 * Math.cos((4 * Hbarp - 63) * Math.PI / 180)

  const dTheta = 30 * Math.exp(-Math.pow((Hbarp - 275) / 25, 2))

  const RC = 2 * Math.sqrt(Math.pow(Cbarp, 7) / (Math.pow(Cbarp, 7) + Math.pow(25, 7)))

  const SL = 1 + (0.015 * Math.pow(Lbarp - 50, 2)) / Math.sqrt(20 + Math.pow(Lbarp - 50, 2))
  const SC = 1 + 0.045 * Cbarp
  const SH = 1 + 0.015 * Cbarp * T

  const RT = -Math.sin(2 * dTheta * Math.PI / 180) * RC

  const dE = Math.sqrt(
    Math.pow(dLp / (kL * SL), 2) +
    Math.pow(dCp / (kC * SC), 2) +
    Math.pow(dHp / (kH * SH), 2) +
    RT * (dCp / (kC * SC)) * (dHp / (kH * SH))
  )

  return dE
}

// Check if a color is a background color (white, near-white, gray, black)
function isBackgroundColor(rgb: { r: number; g: number; b: number }): boolean {
  const { r, g, b } = rgb

  // Calculate brightness
  const brightness = (r + g + b) / 3

  // Calculate saturation (how colorful vs gray)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const saturation = max === 0 ? 0 : (max - min) / max

  // Filter out very bright colors (near white) - common backgrounds
  if (brightness > 240) return true

  // Filter out very dark colors (near black)
  if (brightness < 15) return true

  // Filter out low-saturation grays
  if (saturation < 0.1 && brightness > 180) return true
  if (saturation < 0.05) return true

  return false
}

// Extract colors from image using get-pixels
async function extractDominantColors(imageUrl: string): Promise<{ color: { r: number; g: number; b: number }; weight: number }[]> {
  const getPixels = require('get-pixels')
  const getPixelsAsync = promisify(getPixels)

  // For local files, read from filesystem
  let imagePath: string
  if (imageUrl.startsWith('/uploads')) {
    imagePath = path.join(process.cwd(), 'public', imageUrl)
  } else {
    // For external URLs, fetch first
    let fullUrl = imageUrl
    if (!fullUrl.includes('ssl=')) {
      fullUrl = fullUrl.includes('?') ? `${fullUrl}&ssl=1` : `${fullUrl}?ssl=1`
    }
    imagePath = fullUrl
  }

  const pixels = await getPixelsAsync(imagePath)

  const width = pixels.shape[0]
  const height = pixels.shape[1]
  const channels = pixels.shape[2] || 3

  // Sample pixels more densely (every 5th pixel) and filter backgrounds
  const samplePixels: { r: number; g: number; b: number }[] = []
  const step = 5

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const idx = (y * width + x) * channels
      const pixel = {
        r: pixels.data[idx],
        g: pixels.data[idx + 1],
        b: pixels.data[idx + 2],
      }
      // Filter out background colors
      if (!isBackgroundColor(pixel)) {
        samplePixels.push(pixel)
      }
    }
  }

  // If almost all pixels were filtered (mostly background), use unfiltered
  if (samplePixels.length < 50) {
    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const idx = (y * width + x) * channels
        samplePixels.push({
          r: pixels.data[idx],
          g: pixels.data[idx + 1],
          b: pixels.data[idx + 2],
        })
      }
    }
  }

  // Use improved k-means to find dominant colors with weights
  const dominantColors = improvedKMeans(samplePixels, 5)

  return dominantColors
}

// Improved k-means clustering with k-means++ initialization and weighted output
function improvedKMeans(pixels: { r: number; g: number; b: number }[], k: number): { color: { r: number; g: number; b: number }; weight: number }[] {
  if (pixels.length === 0) return []

  // K-means++ initialization for better starting centroids
  const centroids: { r: number; g: number; b: number }[] = []

  // Pick first centroid randomly
  centroids.push({ ...pixels[Math.floor(Math.random() * pixels.length)] })

  // Pick remaining centroids with probability proportional to distance squared
  for (let i = 1; i < k; i++) {
    const distances = pixels.map(pixel => {
      let minDist = Infinity
      for (const centroid of centroids) {
        const dist = Math.pow(pixel.r - centroid.r, 2) +
          Math.pow(pixel.g - centroid.g, 2) +
          Math.pow(pixel.b - centroid.b, 2)
        minDist = Math.min(minDist, dist)
      }
      return minDist
    })

    const totalDist = distances.reduce((a, b) => a + b, 0)
    let random = Math.random() * totalDist
    let selectedIdx = 0

    for (let j = 0; j < distances.length; j++) {
      random -= distances[j]
      if (random <= 0) {
        selectedIdx = j
        break
      }
    }

    centroids.push({ ...pixels[selectedIdx] })
  }

  // Run more iterations for convergence (15 instead of 5)
  let clusters: { r: number; g: number; b: number }[][] = []

  for (let iter = 0; iter < 15; iter++) {
    clusters = Array.from({ length: k }, () => [])

    // Assign pixels to nearest centroid
    for (const pixel of pixels) {
      let minDist = Infinity
      let closest = 0
      for (let i = 0; i < k; i++) {
        const dist = Math.pow(pixel.r - centroids[i].r, 2) +
          Math.pow(pixel.g - centroids[i].g, 2) +
          Math.pow(pixel.b - centroids[i].b, 2)
        if (dist < minDist) {
          minDist = dist
          closest = i
        }
      }
      clusters[closest].push(pixel)
    }

    // Update centroids
    let converged = true
    for (let i = 0; i < k; i++) {
      if (clusters[i].length > 0) {
        const sum = clusters[i].reduce(
          (acc, p) => ({ r: acc.r + p.r, g: acc.g + p.g, b: acc.b + p.b }),
          { r: 0, g: 0, b: 0 }
        )
        const newCentroid = {
          r: Math.round(sum.r / clusters[i].length),
          g: Math.round(sum.g / clusters[i].length),
          b: Math.round(sum.b / clusters[i].length),
        }

        // Check if centroid moved significantly
        const moved = Math.abs(newCentroid.r - centroids[i].r) +
          Math.abs(newCentroid.g - centroids[i].g) +
          Math.abs(newCentroid.b - centroids[i].b)
        if (moved > 1) converged = false

        centroids[i] = newCentroid
      }
    }

    if (converged) break
  }

  // Return colors with their weights (percentage of pixels)
  const totalPixels = pixels.length
  const results = centroids.map((color, i) => ({
    color,
    weight: clusters[i].length / totalPixels,
  }))

  // Sort by weight (most dominant first) and filter out tiny clusters
  return results
    .filter(r => r.weight > 0.02) // At least 2% of pixels
    .sort((a, b) => b.weight - a.weight)
}

// Find closest Pantone matches for a color using Delta E 2000
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
      distance: deltaE2000(colorLab, pantoneLab),
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

        if (dominantColors.length === 0) {
          results.push({
            colorId: color.id,
            colorName: color.name,
            matched: 0,
            error: 'Could not extract colors from image',
          })
          continue
        }

        // Find closest Pantone match for each of the top 3 dominant colors
        const matchedPantoneIds = new Set<string>()
        const matchedPantoneCodes: string[] = []

        // Limit to top 3 dominant colors (accounting for lighting/shadow variation)
        const topColors = dominantColors.slice(0, 3)

        for (const { color: dominantColor, weight } of topColors) {
          // Get the single best Pantone match for each dominant color
          const closestPantones = findClosestPantones(dominantColor, pantones, 1)

          if (closestPantones.length > 0) {
            const match = closestPantones[0]
            if (!matchedPantoneIds.has(match.id)) {
              matchedPantoneIds.add(match.id)
              matchedPantoneCodes.push(`${match.code} (ΔE=${match.distance.toFixed(1)}, ${(weight * 100).toFixed(0)}%)`)
            }
          }
        }

        // Update the color with matched Pantone chips
        // Remove existing associations
        await prisma.colorPantone.deleteMany({
          where: { colorId: color.id },
        })

        // Create new associations
        const pantoneIdsArray = Array.from(matchedPantoneIds)
        if (pantoneIdsArray.length > 0) {
          await prisma.colorPantone.createMany({
            data: pantoneIdsArray.map((pantoneId, index) => ({
              colorId: color.id,
              pantoneId,
              orderIndex: index,
            })),
          })
        }

        results.push({
          colorId: color.id,
          colorName: color.name,
          matched: matchedPantoneIds.size,
          pantones: matchedPantoneCodes,
        })
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
