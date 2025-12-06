'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function ImportArchiveButton() {
  const router = useRouter()
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{
    success: boolean
    message: string
  } | null>(null)

  async function handleImport() {
    if (!confirm('Import archived purchase orders from Google Sheets? This will create 3 POs (Klondike, Beater, Swan) with their associated products and colors.')) {
      return
    }

    setImporting(true)
    setResult(null)

    try {
      const res = await fetch('/api/import-archive', { method: 'POST' })
      const data = await res.json()

      setResult({
        success: data.success,
        message: data.message || data.error,
      })

      if (data.success) {
        router.refresh()
      }
    } catch {
      setResult({
        success: false,
        message: 'Failed to import archive',
      })
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="inline-flex items-center gap-3">
      <button
        onClick={handleImport}
        disabled={importing}
        className="bg-caramel-600 hover:bg-caramel-600/90 text-white px-6 py-3 rounded-lg font-medium transition-colors shadow-sm disabled:opacity-50"
      >
        {importing ? 'Importing...' : 'Import Archive'}
      </button>
      {result && (
        <span
          className={`text-sm ${
            result.success ? 'text-green-600' : 'text-red-600'
          }`}
        >
          {result.message}
        </span>
      )}
    </div>
  )
}
