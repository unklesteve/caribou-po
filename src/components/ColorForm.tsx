'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Image from 'next/image'

interface PantoneChip {
  id: string
  code: string
  name: string
  hexColor: string
}

interface ColorFormProps {
  initialData?: {
    id?: string
    name: string
    imageUrl: string
    description: string
    isActive: boolean
    pantoneIds: string[]
  }
}

const defaultData = {
  name: '',
  imageUrl: '',
  description: '',
  isActive: true,
  pantoneIds: [] as string[],
}

export function ColorForm({ initialData }: ColorFormProps) {
  const router = useRouter()
  const [formData, setFormData] = useState(initialData || defaultData)
  const [pantones, setPantones] = useState<PantoneChip[]>([])
  const [saving, setSaving] = useState(false)

  const isEditing = !!initialData?.id

  useEffect(() => {
    fetchPantones()
  }, [])

  async function fetchPantones() {
    const res = await fetch('/api/pantone')
    const data = await res.json()
    setPantones(data)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    const url = isEditing ? `/api/colors/${initialData.id}` : '/api/colors'
    const method = isEditing ? 'PUT' : 'POST'

    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    })

    router.push('/colors')
    router.refresh()
  }

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    const value =
      e.target.type === 'checkbox'
        ? (e.target as HTMLInputElement).checked
        : e.target.value
    setFormData({ ...formData, [e.target.name]: value })
  }

  function togglePantone(pantoneId: string) {
    const current = formData.pantoneIds
    if (current.includes(pantoneId)) {
      setFormData({
        ...formData,
        pantoneIds: current.filter((id) => id !== pantoneId),
      })
    } else {
      setFormData({
        ...formData,
        pantoneIds: [...current, pantoneId],
      })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Color Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Color Name *
            </label>
            <input
              type="text"
              name="name"
              required
              value={formData.name}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-caramel-600"
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              name="isActive"
              id="isActive"
              checked={formData.isActive}
              onChange={handleChange}
              className="h-4 w-4 text-maroon-800 focus:ring-caramel-600 border-gray-300 rounded"
            />
            <label htmlFor="isActive" className="ml-2 text-sm text-gray-700">
              Active (available for selection)
            </label>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Image URL
            </label>
            <input
              type="url"
              name="imageUrl"
              value={formData.imageUrl}
              onChange={handleChange}
              placeholder="https://example.com/image.jpg"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-caramel-600"
            />
            {formData.imageUrl && (
              <div className="mt-2 relative w-32 h-32 bg-gray-100 rounded-md overflow-hidden">
                <Image
                  src={formData.imageUrl}
                  alt="Preview"
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
            )}
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              name="description"
              rows={3}
              value={formData.description}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-caramel-600"
            />
          </div>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Pantone Colors</h2>
        {pantones.length === 0 ? (
          <p className="text-gray-500">
            No Pantone colors defined yet.{' '}
            <a href="/pantone/new" className="text-maroon-800 hover:text-maroon-900">
              Add Pantone colors
            </a>{' '}
            first.
          </p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {pantones.map((pantone) => {
              const isSelected = formData.pantoneIds.includes(pantone.id)
              return (
                <button
                  key={pantone.id}
                  type="button"
                  onClick={() => togglePantone(pantone.id)}
                  className={`p-2 rounded-md border-2 transition-all ${
                    isSelected
                      ? 'border-maroon-800 ring-2 ring-maroon-800/20'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div
                    className="w-full h-8 rounded-sm mb-1"
                    style={{ backgroundColor: pantone.hexColor }}
                  />
                  <div className="text-xs font-medium text-gray-900 truncate">
                    {pantone.code}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {pantone.name}
                  </div>
                </button>
              )
            })}
          </div>
        )}
        {formData.pantoneIds.length > 0 && (
          <div className="mt-4 p-3 bg-gray-50 rounded-md">
            <p className="text-sm text-gray-600">
              Selected order:{' '}
              {formData.pantoneIds
                .map((id) => pantones.find((p) => p.id === id)?.code)
                .join(' → ')}
            </p>
          </div>
        )}
      </div>

      <div className="flex justify-end space-x-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 bg-maroon-800 hover:bg-maroon-900 text-white rounded-md font-medium transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving...' : isEditing ? 'Update Color' : 'Add Color'}
        </button>
      </div>
    </form>
  )
}
