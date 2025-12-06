'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Image from 'next/image'

function formatImageUrl(url: string | null): string | null {
  if (!url) return null
  if (url.includes('?')) return url.includes('ssl=') ? url : `${url}&ssl=1`
  return `${url}?ssl=1`
}

interface PantoneChip {
  id: string
  code: string
  name: string
  hexColor: string
}

interface ColorTag {
  id: string
  name: string
}

interface ColorFormProps {
  initialData?: {
    id?: string
    name: string
    imageUrl: string
    description: string
    isActive: boolean
    pantoneLocked: boolean
    pantoneIds: string[]
    tagIds: string[]
  }
}

const defaultData = {
  name: '',
  imageUrl: '',
  description: '',
  isActive: true,
  pantoneLocked: false,
  pantoneIds: [] as string[],
  tagIds: [] as string[],
}

export function ColorForm({ initialData }: ColorFormProps) {
  const router = useRouter()
  const [formData, setFormData] = useState(initialData || defaultData)
  const [pantones, setPantones] = useState<PantoneChip[]>([])
  const [tags, setTags] = useState<ColorTag[]>([])
  const [saving, setSaving] = useState(false)
  const [pantoneSearch, setPantoneSearch] = useState('')
  const [uploading, setUploading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [imageUrl, setImageUrl] = useState('')
  const [fetchingUrl, setFetchingUrl] = useState(false)

  const isEditing = !!initialData?.id

  // Filter pantones based on search
  const filteredPantones = pantones.filter((pantone) => {
    if (!pantoneSearch.trim()) return true
    const search = pantoneSearch.toLowerCase()
    return (
      pantone.code.toLowerCase().includes(search) ||
      pantone.name.toLowerCase().includes(search) ||
      pantone.hexColor.toLowerCase().includes(search)
    )
  })

  useEffect(() => {
    fetchPantones()
    fetchTags()
  }, [])

  async function fetchPantones() {
    const res = await fetch('/api/pantone')
    const data = await res.json()
    setPantones(data)
  }

  async function fetchTags() {
    const res = await fetch('/api/tags')
    const data = await res.json()
    setTags(data)
  }

  function toggleTag(tagId: string) {
    const current = formData.tagIds
    if (current.includes(tagId)) {
      setFormData({
        ...formData,
        tagIds: current.filter((id) => id !== tagId),
      })
    } else {
      setFormData({
        ...formData,
        tagIds: [...current, tagId],
      })
    }
  }

  async function handleAutoMatchPantone() {
    if (!initialData?.id) return
    if (!formData.imageUrl) {
      alert('Please upload an image first')
      return
    }

    setAnalyzing(true)
    try {
      const res = await fetch(`/api/colors/${initialData.id}/analyze`, {
        method: 'POST',
      })
      const data = await res.json()

      if (data.success) {
        // Update the form with the matched Pantone IDs
        const matchedIds = data.matches.map((m: { id: string }) => m.id)
        setFormData({ ...formData, pantoneIds: matchedIds })

        const matchDetails = data.matches
          .map((m: { code: string; deltaE: string; weight: string }) =>
            `${m.code} (ΔE: ${m.deltaE}, ${m.weight})`
          )
          .join('\n')
        alert(`${data.message}\n\n${matchDetails}`)
      } else {
        alert(`Error: ${data.error}`)
      }
    } catch (error) {
      alert(`Failed to analyze: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
    setAnalyzing(false)
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

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const uploadData = new FormData()
      uploadData.append('file', file)
      uploadData.append('folder', 'colors')

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: uploadData,
      })

      const result = await res.json()
      if (result.success) {
        setFormData({ ...formData, imageUrl: result.url })
      } else {
        alert(`Upload failed: ${result.error}`)
      }
    } catch (error) {
      alert('Upload failed')
    }
    setUploading(false)
  }

  async function handleFetchFromUrl() {
    if (!imageUrl.trim()) {
      alert('Please enter a URL')
      return
    }

    setFetchingUrl(true)
    try {
      const res = await fetch('/api/upload/from-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: imageUrl, folder: 'colors' }),
      })

      const result = await res.json()
      if (result.success) {
        setFormData({ ...formData, imageUrl: result.url })
        setImageUrl('')
      } else {
        alert(`Failed to fetch image: ${result.error}`)
      }
    } catch (error) {
      alert('Failed to fetch image from URL')
    }
    setFetchingUrl(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {isEditing && (
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-maroon-800 hover:bg-maroon-900 text-white rounded-md font-medium transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      )}
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

          <div className="flex flex-col gap-3">
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
            <div className="flex items-center">
              <input
                type="checkbox"
                name="pantoneLocked"
                id="pantoneLocked"
                checked={formData.pantoneLocked}
                onChange={handleChange}
                className="h-4 w-4 text-maroon-800 focus:ring-caramel-600 border-gray-300 rounded"
              />
              <label htmlFor="pantoneLocked" className="ml-2 text-sm text-gray-700">
                Lock Pantone selection (exclude from Auto-Match)
              </label>
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Color Type Tags
            </label>
            {tags.length === 0 ? (
              <p className="text-gray-500 text-sm">No tags available. Seed tags first.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => {
                  const isSelected = formData.tagIds.includes(tag.id)
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                        isSelected
                          ? 'bg-maroon-800 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {tag.name}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Color Image
            </label>
            <div className="flex items-start gap-4">
              {formData.imageUrl && (
                <div className="relative w-32 h-32 bg-gray-100 rounded-md overflow-hidden flex-shrink-0">
                  <Image
                    src={formatImageUrl(formData.imageUrl)!}
                    alt="Preview"
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>
              )}
              <div className="flex-1 space-y-2">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-caramel-600 file:mr-4 file:py-1 file:px-4 file:rounded-md file:border-0 file:bg-maroon-800 file:text-white file:cursor-pointer disabled:opacity-50"
                />
                {uploading && (
                  <p className="text-sm text-gray-500">Uploading...</p>
                )}
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Or paste image URL here..."
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-caramel-600"
                  />
                  <button
                    type="button"
                    onClick={handleFetchFromUrl}
                    disabled={fetchingUrl || !imageUrl.trim()}
                    className="px-3 py-1.5 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded-md font-medium transition-colors disabled:opacity-50"
                  >
                    {fetchingUrl ? 'Fetching...' : 'Fetch'}
                  </button>
                </div>
                {formData.imageUrl && (
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, imageUrl: '' })}
                      className="text-sm text-red-600 hover:text-red-800"
                    >
                      Remove image
                    </button>
                    {isEditing && (
                      <button
                        type="button"
                        onClick={handleAutoMatchPantone}
                        disabled={analyzing || formData.pantoneLocked}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md font-medium transition-colors disabled:opacity-50"
                        title={formData.pantoneLocked ? 'Pantone is locked' : 'Analyze image and auto-match Pantone colors'}
                      >
                        {analyzing ? 'Analyzing...' : 'Auto-Match Pantone'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
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

          {formData.pantoneIds.length > 0 && (
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Selected Pantone Colors
              </label>
              <div className="flex flex-wrap gap-2">
                {formData.pantoneIds.map((id) => {
                  const pantone = pantones.find((p) => p.id === id)
                  if (!pantone) return null
                  return (
                    <div
                      key={id}
                      className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-md"
                    >
                      <div
                        className="w-6 h-6 rounded-sm border border-gray-300"
                        style={{ backgroundColor: pantone.hexColor }}
                      />
                      <span className="text-sm font-medium text-gray-700">
                        {pantone.code}
                      </span>
                      <button
                        type="button"
                        onClick={() => togglePantone(id)}
                        className="text-gray-400 hover:text-red-600 ml-1"
                        title="Remove"
                      >
                        ×
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-900">Pantone Colors</h2>
          {pantones.length > 0 && (
            <span className="text-sm text-gray-500">
              {filteredPantones.length} of {pantones.length} colors
            </span>
          )}
        </div>
        {pantones.length === 0 ? (
          <p className="text-gray-500">
            No Pantone colors defined yet.{' '}
            <a href="/pantone/new" className="text-maroon-800 hover:text-maroon-900">
              Add Pantone colors
            </a>{' '}
            first.
          </p>
        ) : (
          <>
            <div className="mb-4">
              <input
                type="text"
                placeholder="Search Pantone colors by code, name, or hex..."
                value={pantoneSearch}
                onChange={(e) => setPantoneSearch(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-caramel-600"
              />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 max-h-96 overflow-y-auto">
              {filteredPantones.map((pantone) => {
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
            {filteredPantones.length === 0 && pantoneSearch && (
              <p className="text-gray-500 text-center py-4">
                No Pantone colors match &quot;{pantoneSearch}&quot;
              </p>
            )}
          </>
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
