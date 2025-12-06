'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useState } from 'react'

function formatImageUrl(url: string | null): string | null {
  if (!url) return null
  if (url.includes('?')) return url.includes('ssl=') ? url : `${url}&ssl=1`
  return `${url}?ssl=1`
}

interface PantoneChip {
  pantone: {
    id: string
    code: string
    name: string
    hexColor: string
  }
}

interface YoyoColor {
  id: string
  name: string
  imageUrl: string | null
  description: string | null
  isActive: boolean
  pantoneChips: PantoneChip[]
}

export default function ColorsPage() {
  const [colors, setColors] = useState<YoyoColor[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)

  useEffect(() => {
    fetchColors()
  }, [search])

  async function fetchColors() {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    const res = await fetch(`/api/colors?${params}`)
    const data = await res.json()
    setColors(data)
    setLoading(false)
  }

  async function handleSeedColors() {
    if (!confirm('This will import all CLYW colors from the database. Continue?')) return
    setSeeding(true)
    const res = await fetch('/api/colors/seed', { method: 'POST' })
    const data = await res.json()
    alert(data.message)
    fetchColors()
    setSeeding(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this color?')) return
    await fetch(`/api/colors/${id}`, { method: 'DELETE' })
    fetchColors()
  }

  async function handleAnalyzeColors() {
    if (!confirm('Analyze all color images and auto-assign closest Pantone matches? This may take a few minutes.')) return
    setAnalyzing(true)
    try {
      const res = await fetch('/api/colors/analyze', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        alert(data.message)
        fetchColors()
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch (error) {
      alert('Failed to analyze colors')
    }
    setAnalyzing(false)
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Yo-Yo Colors</h1>
        <div className="flex gap-2">
          <button
            onClick={handleAnalyzeColors}
            disabled={analyzing}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium transition-colors disabled:opacity-50"
          >
            {analyzing ? 'Analyzing...' : 'Auto-Match Pantone'}
          </button>
          <button
            onClick={handleSeedColors}
            disabled={seeding}
            className="bg-caramel-600 hover:bg-caramel-700 text-white px-4 py-2 rounded-md font-medium transition-colors disabled:opacity-50"
          >
            {seeding ? 'Importing...' : 'Import CLYW Colors'}
          </button>
          <Link
            href="/colors/new"
            className="bg-maroon-800 hover:bg-maroon-900 text-white px-4 py-2 rounded-md font-medium transition-colors"
          >
            Add Color
          </Link>
        </div>
      </div>

      <div className="mb-6">
        <input
          type="text"
          placeholder="Search colors..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-caramel-600"
        />
      </div>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : colors.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500 mb-4">No colors found</p>
          <button
            onClick={handleSeedColors}
            disabled={seeding}
            className="text-maroon-800 hover:text-maroon-900 font-medium"
          >
            Import CLYW colors to get started
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {colors.map((color) => (
            <div
              key={color.id}
              className="bg-white rounded-lg shadow overflow-hidden group"
            >
              <div className="aspect-square relative bg-gray-100">
                {color.imageUrl ? (
                  <Image
                    src={formatImageUrl(color.imageUrl)!}
                    alt={color.name}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    No image
                  </div>
                )}
              </div>
              <div className="p-3">
                <h3 className="font-medium text-gray-900 text-sm truncate">
                  {color.name}
                </h3>
                {color.pantoneChips.length > 0 && (
                  <div className="flex gap-1 mt-2">
                    {color.pantoneChips.slice(0, 4).map((chip) => (
                      <div
                        key={chip.pantone.id}
                        className="w-4 h-4 rounded-sm border border-gray-300"
                        style={{ backgroundColor: chip.pantone.hexColor }}
                        title={`${chip.pantone.code} - ${chip.pantone.name}`}
                      />
                    ))}
                    {color.pantoneChips.length > 4 && (
                      <span className="text-xs text-gray-500">
                        +{color.pantoneChips.length - 4}
                      </span>
                    )}
                  </div>
                )}
                <div className="flex justify-between items-center mt-2">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      color.isActive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {color.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <Link
                      href={`/colors/${color.id}/edit`}
                      className="text-maroon-800 hover:text-maroon-900 text-xs mr-2"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => handleDelete(color.id)}
                      className="text-red-600 hover:text-red-900 text-xs"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
