import { NextRequest, NextResponse } from 'next/server'
import { mkdir } from 'fs/promises'
import path from 'path'
import { existsSync } from 'fs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const sharp = (await import('sharp')).default

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const folder = (formData.get('folder') as string) || 'colors'

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid file type. Use JPEG, PNG, GIF, or WebP.' },
        { status: 400 }
      )
    }

    // Generate unique filename
    const timestamp = Date.now()
    const safeName = file.name
      .replace(/\.[^/.]+$/, '') // Remove extension
      .replace(/[^a-zA-Z0-9-_]/g, '-') // Replace special chars
      .substring(0, 50) // Limit length

    // Always save as high-quality PNG for best clarity
    const filename = `${safeName}-${timestamp}.png`

    // Ensure upload directory exists
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', folder)
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
    }

    // Process image with sharp - high quality settings
    const bytes = await file.arrayBuffer()
    const inputBuffer = Buffer.from(bytes)

    const outputBuffer = await sharp(inputBuffer)
      .resize(800, 800, {
        fit: 'inside',
        withoutEnlargement: true, // Don't upscale small images
      })
      .png({
        quality: 100,
        compressionLevel: 1, // Minimal compression for best quality
      })
      .toBuffer()

    const filepath = path.join(uploadDir, filename)
    const { writeFile } = await import('fs/promises')
    await writeFile(filepath, outputBuffer)

    // Return the public URL
    const url = `/uploads/${folder}/${filename}`

    return NextResponse.json({
      success: true,
      url,
      filename,
    })
  } catch (error) {
    console.error('Upload error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { success: false, error: `Upload failed: ${errorMessage}` },
      { status: 500 }
    )
  }
}
