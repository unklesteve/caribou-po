'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

interface PantoneChip {
  id: string
  code: string
  name: string
  hexColor: string
}

export default function PantonePage() {
  const [pantones, setPantones] = useState<PantoneChip[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPantones()
  }, [search])

  async function fetchPantones() {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    const res = await fetch(`/api/pantone?${params}`)
    const data = await res.json()
    setPantones(data)
    setLoading(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this Pantone color?')) return
    await fetch(`/api/pantone/${id}`, { method: 'DELETE' })
    fetchPantones()
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Pantone Colors</h1>
        <Link
          href="/pantone/new"
          className="bg-maroon-800 hover:bg-maroon-900 text-white px-4 py-2 rounded-md font-medium transition-colors"
        >
          Add Pantone
        </Link>
      </div>

      <div className="mb-6">
        <input
          type="text"
          placeholder="Search by code or name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-caramel-600"
        />
      </div>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : pantones.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500 mb-4">No Pantone colors found</p>
          <Link
            href="/pantone/new"
            className="text-maroon-800 hover:text-maroon-900 font-medium"
          >
            Add your first Pantone color
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
          {pantones.map((pantone) => (
            <div
              key={pantone.id}
              className="bg-white rounded-lg shadow overflow-hidden group"
            >
              <div
                className="h-20"
                style={{ backgroundColor: pantone.hexColor }}
              />
              <div className="p-3">
                <h3 className="font-medium text-gray-900 text-sm">
                  {pantone.code}
                </h3>
                <p className="text-xs text-gray-500 truncate">{pantone.name}</p>
                <p className="text-xs text-gray-400 font-mono mt-1">
                  {pantone.hexColor}
                </p>
                <div className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleDelete(pantone.id)}
                    className="text-red-600 hover:text-red-900 text-xs"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
