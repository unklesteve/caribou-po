'use client'

import { useRouter } from 'next/navigation'
import { useState, useCallback } from 'react'
import Image from 'next/image'
import { SuccessMessage } from './SuccessMessage'

interface EngravingArt {
  id: string
  name: string
  imageUrl: string
  position: string
  isActive: boolean
}

interface ProductQuote {
  id: string
  quoteDate: string
  quoteType: string
  unitPrice: number
  notes: string | null
}

interface ProductFormProps {
  initialData?: {
    id?: string
    sku: string
    name: string
    description: string
    imageUrl: string
    unitPrice: string
    unit: string
    category: string
    material: string
    isActive: boolean
    engravingArt?: EngravingArt[]
    quotes?: ProductQuote[]
  }
}

const defaultData = {
  sku: '',
  name: '',
  description: '',
  imageUrl: '',
  unitPrice: '',
  unit: 'each',
  category: '',
  material: '',
  isActive: true,
}

const MATERIALS = [
  '6061 Aluminum',
  '7075 Aluminum',
  '6061 Aluminum + Steel',
  '7075 Aluminum + Steel',
  'Wood',
]

const POSITIONS = ['Side 1', 'Side 2', 'Both Sides', 'Rim']

export function ProductForm({ initialData }: ProductFormProps) {
  const router = useRouter()
  const [formData, setFormData] = useState(initialData || defaultData)
  const [engravingArt, setEngravingArt] = useState<EngravingArt[]>(initialData?.engravingArt || [])
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [imageUrl, setImageUrl] = useState('')
  const [fetchingUrl, setFetchingUrl] = useState(false)

  // New engraving form state
  const [showEngravingForm, setShowEngravingForm] = useState(false)
  const [newEngraving, setNewEngraving] = useState({ name: '', imageUrl: '', position: 'Side 1' })
  const [engravingImageUrl, setEngravingImageUrl] = useState('')
  const [uploadingEngraving, setUploadingEngraving] = useState(false)
  const [fetchingEngravingUrl, setFetchingEngravingUrl] = useState(false)
  const [savingEngraving, setSavingEngraving] = useState(false)

  // Quote history state
  const [quotes, setQuotes] = useState<ProductQuote[]>(initialData?.quotes || [])
  const [showQuoteForm, setShowQuoteForm] = useState(false)
  const [newQuote, setNewQuote] = useState({ quoteDate: new Date().toISOString().split('T')[0], unitPrice: '', notes: '' })
  const [savingQuote, setSavingQuote] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const isEditing = !!initialData?.id
  const clearSuccessMessage = useCallback(() => setSuccessMessage(null), [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    const url = isEditing ? `/api/products/${initialData.id}` : '/api/products'
    const method = isEditing ? 'PUT' : 'POST'

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to save product')
      }

      if (isEditing) {
        setSaving(false)
        setSuccessMessage('Product saved successfully!')
        router.refresh()
      } else {
        const data = await res.json()
        router.push(`/products/${data.id}/edit`)
        router.refresh()
      }
    } catch (error) {
      setSaving(false)
      alert(error instanceof Error ? error.message : 'Failed to save product')
    }
  }

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) {
    const value =
      e.target.type === 'checkbox'
        ? (e.target as HTMLInputElement).checked
        : e.target.value
    setFormData({ ...formData, [e.target.name]: value })
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const uploadData = new FormData()
      uploadData.append('file', file)
      uploadData.append('folder', 'products')

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: uploadData,
      })

      const result = await res.json()
      if (result.success) {
        setFormData({ ...formData, imageUrl: result.url })
        setSuccessMessage('Image uploaded successfully!')
      } else {
        alert(`Upload failed: ${result.error}`)
      }
    } catch {
      alert('Upload failed')
    }
    setUploading(false)
  }

  async function handleFetchFromUrl() {
    if (!imageUrl.trim()) return

    setFetchingUrl(true)
    try {
      const res = await fetch('/api/upload/from-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: imageUrl, folder: 'products' }),
      })

      const result = await res.json()
      if (result.success) {
        setFormData({ ...formData, imageUrl: result.url })
        setImageUrl('')
        setSuccessMessage('Image fetched successfully!')
      } else {
        alert(`Failed to fetch image: ${result.error}`)
      }
    } catch {
      alert('Failed to fetch image from URL')
    }
    setFetchingUrl(false)
  }

  // Engraving art functions
  async function handleEngravingFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingEngraving(true)
    try {
      const uploadData = new FormData()
      uploadData.append('file', file)
      uploadData.append('folder', 'engravings')

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: uploadData,
      })

      const result = await res.json()
      if (result.success) {
        setNewEngraving({ ...newEngraving, imageUrl: result.url })
      } else {
        alert(`Upload failed: ${result.error}`)
      }
    } catch {
      alert('Upload failed')
    }
    setUploadingEngraving(false)
  }

  async function handleFetchEngravingFromUrl() {
    if (!engravingImageUrl.trim()) return

    setFetchingEngravingUrl(true)
    try {
      const res = await fetch('/api/upload/from-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: engravingImageUrl, folder: 'engravings' }),
      })

      const result = await res.json()
      if (result.success) {
        setNewEngraving({ ...newEngraving, imageUrl: result.url })
        setEngravingImageUrl('')
      } else {
        alert(`Failed to fetch image: ${result.error}`)
      }
    } catch {
      alert('Failed to fetch image from URL')
    }
    setFetchingEngravingUrl(false)
  }

  async function handleAddEngraving() {
    if (!newEngraving.name || !newEngraving.imageUrl) {
      alert('Please provide a name and image for the engraving')
      return
    }

    setSavingEngraving(true)
    try {
      const res = await fetch(`/api/products/${initialData?.id}/engraving-art`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEngraving),
      })

      const result = await res.json()
      if (result.id) {
        setEngravingArt([...engravingArt, result])
        setNewEngraving({ name: '', imageUrl: '', position: 'Side 1' })
        setShowEngravingForm(false)
        setSuccessMessage('Engraving art added successfully!')
      } else {
        alert('Failed to add engraving')
      }
    } catch {
      alert('Failed to add engraving')
    }
    setSavingEngraving(false)
  }

  async function handleDeleteEngraving(artId: string) {
    if (!confirm('Delete this engraving art?')) return

    try {
      await fetch(`/api/products/${initialData?.id}/engraving-art/${artId}`, {
        method: 'DELETE',
      })
      setEngravingArt(engravingArt.filter(a => a.id !== artId))
    } catch {
      alert('Failed to delete engraving')
    }
  }

  // Quote functions
  async function handleAddQuote() {
    if (!newQuote.unitPrice) {
      alert('Please provide a unit price')
      return
    }

    setSavingQuote(true)
    try {
      const res = await fetch(`/api/products/${initialData?.id}/quotes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newQuote),
      })

      const result = await res.json()
      if (result.id) {
        // Add to quotes list and sort by date desc
        const updatedQuotes = [...quotes, result].sort(
          (a, b) => new Date(b.quoteDate).getTime() - new Date(a.quoteDate).getTime()
        )
        setQuotes(updatedQuotes)
        // Update form's unitPrice to reflect newest quote
        if (updatedQuotes.length > 0) {
          setFormData({ ...formData, unitPrice: updatedQuotes[0].unitPrice.toString() })
        }
        setNewQuote({ quoteDate: new Date().toISOString().split('T')[0], unitPrice: '', notes: '' })
        setShowQuoteForm(false)
        setSuccessMessage('Quote added successfully!')
      } else {
        alert('Failed to add quote')
      }
    } catch {
      alert('Failed to add quote')
    }
    setSavingQuote(false)
  }

  async function handleDeleteQuote(quoteId: string) {
    if (!confirm('Delete this quote?')) return

    try {
      await fetch(`/api/products/${initialData?.id}/quotes/${quoteId}`, {
        method: 'DELETE',
      })
      const updatedQuotes = quotes.filter(q => q.id !== quoteId)
      setQuotes(updatedQuotes)
      // Update form's unitPrice to reflect newest remaining quote
      if (updatedQuotes.length > 0) {
        setFormData({ ...formData, unitPrice: updatedQuotes[0].unitPrice.toString() })
      }
    } catch {
      alert('Failed to delete quote')
    }
  }

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  // Filter quotes by type
  const productionQuotes = quotes.filter(q => q.quoteType === 'production')
  const prototypeQuotes = quotes.filter(q => q.quoteType === 'prototype')

  // Calculate price change percentage between most recent and previous production quote
  function getProductionPriceChange() {
    if (productionQuotes.length < 2) return null
    const newest = productionQuotes[0].unitPrice
    const previous = productionQuotes[1].unitPrice
    if (previous === 0) return null
    const change = ((newest - previous) / previous) * 100
    return change
  }

  return (
    <>
    <SuccessMessage message={successMessage} onClear={clearSuccessMessage} />
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
        <h2 className="text-lg font-medium text-gray-900 mb-4">Product Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              SKU *
            </label>
            <input
              type="text"
              name="sku"
              required
              value={formData.sku}
              onChange={handleChange}
              placeholder="e.g., YY-PEAK-001"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-caramel-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Product Name *
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

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Product Image
            </label>
            <div className="flex items-start gap-4">
              {formData.imageUrl && (
                <div className="relative w-32 h-32 bg-gray-100 rounded-md overflow-hidden flex-shrink-0">
                  <Image
                    src={formData.imageUrl}
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
                {uploading && <p className="text-sm text-gray-500">Uploading...</p>}
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
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, imageUrl: '' })}
                    className="text-sm text-red-600 hover:text-red-800"
                  >
                    Remove image
                  </button>
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Unit Price
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-gray-500">$</span>
              <input
                type="number"
                name="unitPrice"
                min="0"
                step="0.01"
                value={formData.unitPrice}
                onChange={handleChange}
                placeholder="0.00"
                className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-caramel-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Unit
            </label>
            <select
              name="unit"
              value={formData.unit}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-caramel-600"
            >
              <option value="each">Each</option>
              <option value="pack">Pack</option>
              <option value="box">Box</option>
              <option value="case">Case</option>
              <option value="set">Set</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <input
              type="text"
              name="category"
              value={formData.category}
              onChange={handleChange}
              placeholder="e.g., Yo-Yos, Parts, Accessories"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-caramel-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Material
            </label>
            <select
              name="material"
              value={formData.material}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-caramel-600"
            >
              <option value="">Select material</option>
              {MATERIALS.map((mat) => (
                <option key={mat} value={mat}>{mat}</option>
              ))}
            </select>
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
              Active (available for purchase orders)
            </label>
          </div>
        </div>
      </div>

      {/* Engraving Art Section - Only show when editing */}
      {isEditing && (
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium text-gray-900">Engraving Art</h2>
            <button
              type="button"
              onClick={() => setShowEngravingForm(!showEngravingForm)}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md font-medium transition-colors"
            >
              {showEngravingForm ? 'Cancel' : 'Add Engraving'}
            </button>
          </div>

          {showEngravingForm && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={newEngraving.name}
                    onChange={(e) => setNewEngraving({ ...newEngraving, name: e.target.value })}
                    placeholder="e.g., Logo Design A"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-caramel-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Position *
                  </label>
                  <select
                    value={newEngraving.position}
                    onChange={(e) => setNewEngraving({ ...newEngraving, position: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-caramel-600"
                  >
                    {POSITIONS.map((pos) => (
                      <option key={pos} value={pos}>{pos}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Image *
                </label>
                <div className="flex items-start gap-4">
                  {newEngraving.imageUrl && (
                    <div className="relative w-24 h-24 bg-gray-100 rounded-md overflow-hidden flex-shrink-0">
                      <Image
                        src={newEngraving.imageUrl}
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
                      onChange={handleEngravingFileUpload}
                      disabled={uploadingEngraving}
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-caramel-600 file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:bg-maroon-800 file:text-white file:cursor-pointer disabled:opacity-50"
                    />
                    {uploadingEngraving && <p className="text-sm text-gray-500">Uploading...</p>}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Or paste image URL..."
                        value={engravingImageUrl}
                        onChange={(e) => setEngravingImageUrl(e.target.value)}
                        className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-caramel-600"
                      />
                      <button
                        type="button"
                        onClick={handleFetchEngravingFromUrl}
                        disabled={fetchingEngravingUrl || !engravingImageUrl.trim()}
                        className="px-3 py-1.5 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded-md font-medium transition-colors disabled:opacity-50"
                      >
                        {fetchingEngravingUrl ? 'Fetching...' : 'Fetch'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleAddEngraving}
                  disabled={savingEngraving || !newEngraving.name || !newEngraving.imageUrl}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md font-medium transition-colors disabled:opacity-50"
                >
                  {savingEngraving ? 'Saving...' : 'Save Engraving'}
                </button>
              </div>
            </div>
          )}

          {engravingArt.length === 0 ? (
            <p className="text-gray-500 text-sm">No engraving art added yet.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {engravingArt.map((art) => (
                <div key={art.id} className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="aspect-square relative bg-gray-100">
                    <Image
                      src={art.imageUrl}
                      alt={art.name}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                  <div className="p-2">
                    <p className="text-sm font-medium text-gray-900 truncate">{art.name}</p>
                    <p className="text-xs text-gray-500">{art.position}</p>
                    <button
                      type="button"
                      onClick={() => handleDeleteEngraving(art.id)}
                      className="mt-1 text-xs text-red-600 hover:text-red-800"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Quote History Section - Only show when editing */}
      {isEditing && (
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-lg font-medium text-gray-900">Cost Quote History</h2>
              {productionQuotes.length > 0 && (
                <p className="text-sm text-gray-500">
                  Current production cost: {formatCurrency(productionQuotes[0].unitPrice)}
                  {getProductionPriceChange() !== null && (
                    <span className={`ml-2 ${getProductionPriceChange()! >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                      ({getProductionPriceChange()! >= 0 ? '+' : ''}{getProductionPriceChange()!.toFixed(1)}% from previous)
                    </span>
                  )}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowQuoteForm(!showQuoteForm)}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md font-medium transition-colors"
            >
              {showQuoteForm ? 'Cancel' : 'Add Quote'}
            </button>
          </div>

          {showQuoteForm && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Quote Date *
                  </label>
                  <input
                    type="date"
                    value={newQuote.quoteDate}
                    onChange={(e) => setNewQuote({ ...newQuote, quoteDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-caramel-600"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Unit Cost *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-gray-500">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={newQuote.unitPrice}
                      onChange={(e) => setNewQuote({ ...newQuote, unitPrice: e.target.value })}
                      placeholder="0.00"
                      className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-caramel-600"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Notes
                  </label>
                  <input
                    type="text"
                    value={newQuote.notes}
                    onChange={(e) => setNewQuote({ ...newQuote, notes: e.target.value })}
                    placeholder="Optional notes"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-caramel-600"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleAddQuote}
                  disabled={savingQuote || !newQuote.unitPrice}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md font-medium transition-colors disabled:opacity-50"
                >
                  {savingQuote ? 'Saving...' : 'Save Quote'}
                </button>
              </div>
            </div>
          )}

          {/* Price History Chart - Production quotes only */}
          {productionQuotes.length > 1 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Production Cost Trend</h3>
              <div className="h-32 flex items-end gap-1 bg-gray-50 rounded-lg p-4">
                {[...productionQuotes].reverse().map((quote, index, arr) => {
                  const prices = arr.map(q => q.unitPrice)
                  const maxPrice = Math.max(...prices)
                  const minPrice = Math.min(...prices)
                  const range = maxPrice - minPrice || 1
                  const height = ((quote.unitPrice - minPrice) / range) * 100
                  const isNewest = index === arr.length - 1

                  return (
                    <div
                      key={quote.id}
                      className="flex-1 flex flex-col items-center group relative"
                    >
                      <div
                        className={`w-full rounded-t transition-all ${isNewest ? 'bg-maroon-600' : 'bg-caramel-500'} hover:opacity-80`}
                        style={{ height: `${Math.max(height, 10)}%`, minHeight: '8px' }}
                      />
                      <div className="absolute bottom-full mb-1 hidden group-hover:block bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                        {formatDate(quote.quoteDate)}: {formatCurrency(quote.unitPrice)}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>{productionQuotes.length > 0 && formatDate(productionQuotes[productionQuotes.length - 1].quoteDate)}</span>
                <span>{productionQuotes.length > 0 && formatDate(productionQuotes[0].quoteDate)}</span>
              </div>
            </div>
          )}

          {/* Quote List */}
          {quotes.length === 0 ? (
            <p className="text-gray-500 text-sm">No price quotes recorded yet.</p>
          ) : (
            <div className="overflow-hidden border border-gray-200 rounded-lg">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Cost</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Change</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {quotes.map((quote, index) => {
                    // For production quotes, calculate change from previous production quote
                    // For prototype quotes, don't show change
                    let change: number | null = null
                    if (quote.quoteType === 'production') {
                      const productionIndex = productionQuotes.findIndex(q => q.id === quote.id)
                      const prevProductionQuote = productionQuotes[productionIndex + 1]
                      if (prevProductionQuote) {
                        change = ((quote.unitPrice - prevProductionQuote.unitPrice) / prevProductionQuote.unitPrice) * 100
                      }
                    }
                    const isCurrentProduction = quote.quoteType === 'production' && productionQuotes[0]?.id === quote.id
                    return (
                      <tr key={quote.id} className={isCurrentProduction ? 'bg-maroon-50' : ''}>
                        <td className="px-4 py-2 text-sm text-gray-900">
                          {formatDate(quote.quoteDate)}
                          {isCurrentProduction && <span className="ml-2 text-xs text-maroon-600 font-medium">(Current)</span>}
                        </td>
                        <td className="px-4 py-2">
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                            quote.quoteType === 'prototype'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {quote.quoteType}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-900 text-right font-medium">
                          {formatCurrency(quote.unitPrice)}
                        </td>
                        <td className="px-4 py-2 text-sm text-right">
                          {change !== null ? (
                            <span className={change >= 0 ? 'text-red-600' : 'text-green-600'}>
                              {change >= 0 ? '+' : ''}{change.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-500">
                          {quote.notes || '-'}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteQuote(quote.id)}
                            className="text-xs text-red-600 hover:text-red-800"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

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
          {saving ? 'Saving...' : isEditing ? 'Update Product' : 'Add Product'}
        </button>
      </div>
    </form>
    </>
  )
}
