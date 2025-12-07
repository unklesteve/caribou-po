import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { url, folder = 'colors' } = body

    if (!url) {
      return NextResponse.json(
        { success: false, error: 'No URL provided' },
        { status: 400 }
      )
    }

    // Fetch the image
    let fetchUrl = url
    if (!fetchUrl.includes('ssl=')) {
      fetchUrl = fetchUrl.includes('?') ? `${fetchUrl}&ssl=1` : `${fetchUrl}?ssl=1`
    }

    const response = await fetch(fetchUrl)

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: `Failed to fetch image: ${response.status} ${response.statusText}` },
        { status: 400 }
      )
    }

    const contentType = response.headers.get('content-type') || ''

    // Determine file extension from content type or URL
    let ext = '.png'
    if (contentType.includes('jpeg') || contentType.includes('jpg')) {
      ext = '.jpg'
    } else if (contentType.includes('gif')) {
      ext = '.gif'
    } else if (contentType.includes('webp')) {
      ext = '.webp'
    } else if (contentType.includes('png')) {
      ext = '.png'
    } else {
      // Try to get extension from URL
      const urlExt = url.match(/\.(jpe?g|png|gif|webp)/i)?.[0]
      if (urlExt) {
        ext = urlExt.toLowerCase()
      }
    }

    // Generate unique filename
    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substring(2, 8)
    const filename = `${folder}/url-image-${timestamp}-${randomStr}${ext}`

    // Upload to Vercel Blob
    const arrayBuffer = await response.arrayBuffer()
    const blob = await put(filename, arrayBuffer, {
      access: 'public',
      contentType: contentType || 'image/png',
    })

    return NextResponse.json({
      success: true,
      url: blob.url,
      filename: blob.pathname,
      originalUrl: url,
    })
  } catch (error) {
    console.error('URL fetch error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { success: false, error: `Failed to fetch image: ${errorMessage}` },
      { status: 500 }
    )
  }
}
