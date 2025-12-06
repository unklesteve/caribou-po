'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

export function ImportPOButton() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [supplier, setSupplier] = useState('')
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([])
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [result, setResult] = useState<{
    success: boolean
    message: string
  } | null>(null)

  async function openModal() {
    setShowModal(true)
    setResult(null)
    setCsvFile(null)
    setSupplier('')

    // Fetch suppliers
    const res = await fetch('/api/suppliers')
    const data = await res.json()
    setSuppliers(data)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      setCsvFile(file)
    }
  }

  async function handleImport() {
    if (!supplier) {
      setResult({ success: false, message: 'Please select a supplier' })
      return
    }
    if (!csvFile) {
      setResult({ success: false, message: 'Please select a CSV file' })
      return
    }

    setImporting(true)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('file', csvFile)
      formData.append('supplierId', supplier)

      const res = await fetch('/api/import-po', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()

      setResult({
        success: data.success,
        message: data.message || data.error,
      })

      if (data.success && data.poId) {
        setTimeout(() => {
          setShowModal(false)
          router.push(`/purchase-orders/${data.poId}`)
          router.refresh()
        }, 1000)
      }
    } catch {
      setResult({
        success: false,
        message: 'Failed to import PO',
      })
    } finally {
      setImporting(false)
    }
  }

  return (
    <>
      <button
        onClick={openModal}
        className="bg-caramel-600 hover:bg-caramel-600/90 text-white px-6 py-3 rounded-lg font-medium transition-colors shadow-sm"
      >
        Import PO
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Import Purchase Order</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Supplier *
                </label>
                <select
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-caramel-600"
                >
                  <option value="">Select a supplier</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CSV File *
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-caramel-600"
                />
                {csvFile && (
                  <p className="text-sm text-gray-600 mt-1">
                    Selected: {csvFile.name}
                  </p>
                )}
              </div>

              <div className="bg-gray-50 rounded-md p-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Supported Format:</p>
                <p className="text-xs text-gray-600">
                  Standard Caribou Lodge PO format with Product, Color, and QTY columns.
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Products are matched by name or SKU. Colors will be created if not found.
                </p>
              </div>

              {result && (
                <div
                  className={`p-3 rounded-md ${
                    result.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
                  }`}
                >
                  {result.message}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={importing}
                className="px-4 py-2 bg-maroon-800 hover:bg-maroon-900 text-white rounded-md font-medium transition-colors disabled:opacity-50"
              >
                {importing ? 'Importing...' : 'Import'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
