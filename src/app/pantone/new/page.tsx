'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Link from 'next/link'

export default function NewPantonePage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    hexColor: '#000000',
  })
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    await fetch('/api/pantone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    })

    router.push('/pantone')
    router.refresh()
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/pantone"
          className="text-maroon-800 hover:text-maroon-900 text-sm"
        >
          &larr; Back to Pantone Colors
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 mt-2">Add Pantone Color</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white shadow rounded-lg p-6 max-w-lg">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Pantone Code *
            </label>
            <input
              type="text"
              name="code"
              required
              value={formData.code}
              onChange={handleChange}
              placeholder="e.g., PMS 185 C"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-caramel-600"
            />
          </div>

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
              placeholder="e.g., Red"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-caramel-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Hex Color *
            </label>
            <div className="flex gap-3">
              <input
                type="color"
                name="hexColor"
                value={formData.hexColor}
                onChange={handleChange}
                className="h-10 w-20 rounded-md border border-gray-300 cursor-pointer"
              />
              <input
                type="text"
                name="hexColor"
                required
                value={formData.hexColor}
                onChange={handleChange}
                pattern="^#[0-9A-Fa-f]{6}$"
                placeholder="#000000"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-caramel-600 font-mono"
              />
            </div>
          </div>

          <div
            className="h-24 rounded-md border border-gray-300"
            style={{ backgroundColor: formData.hexColor }}
          />
        </div>

        <div className="mt-6 flex justify-end space-x-3">
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
            {saving ? 'Saving...' : 'Add Pantone'}
          </button>
        </div>
      </form>
    </div>
  )
}
