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
    if (!confirm('Import 2,310 TCX + 1,341 Coated Pantone colors? This may take a few minutes.')) {
      return
    }

    setLoading(true)
    setResult(null)

    try {
      // Import TCX colors first
      const tcxResponse = await fetch('/api/pantone/seed', {
        method: 'POST',
      })
      const tcxData = await tcxResponse.json()

      // Then import Coated colors
      const coatedResponse = await fetch('/api/pantone/seed-coated', {
        method: 'POST',
      })
      const coatedData = await coatedResponse.json()

      if (tcxData.success && coatedData.success) {
        setResult({
          success: true,
          message: `TCX: ${tcxData.created} imported. Coated: ${coatedData.created} imported.`
        })
        router.refresh()
      } else {
        const errors = []
        if (!tcxData.success) errors.push(`TCX: ${tcxData.error}`)
        if (!coatedData.success) errors.push(`Coated: ${coatedData.error}`)
        setResult({ success: false, message: errors.join(' | ') })
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
