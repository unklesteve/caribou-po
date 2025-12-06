'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function SeedPantoneButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{
    success: boolean
    message: string
  } | null>(null)

  async function handleSeed() {
    if (!confirm('Import 1,449 Pantone colors? This may take a moment.')) {
      return
    }

    setLoading(true)
    setResult(null)

    try {
      const response = await fetch('/api/pantone/seed', {
        method: 'POST',
      })
      const data = await response.json()

      if (data.success) {
        setResult({ success: true, message: data.message })
        router.refresh()
      } else {
        setResult({ success: false, message: data.error || 'Import failed' })
      }
    } catch (error) {
      setResult({ success: false, message: 'Network error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="inline-flex items-center gap-2">
      <button
        onClick={handleSeed}
        disabled={loading}
        className="bg-white hover:bg-gray-50 text-gray-700 px-6 py-3 rounded-lg font-medium transition-colors shadow-sm border border-gray-300 disabled:opacity-50"
      >
        {loading ? 'Importing...' : 'Seed Pantone Colors'}
      </button>
      {result && (
        <span
          className={`text-sm ${result.success ? 'text-green-600' : 'text-red-600'}`}
        >
          {result.message}
        </span>
      )}
    </div>
  )
}
