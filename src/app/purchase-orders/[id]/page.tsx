'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

interface LineItem {
  id: string
  quantity: number
  unitPrice: number
  product: {
    sku: string
    name: string
    unit: string
  }
}

interface PurchaseOrder {
  id: string
  poNumber: string
  status: string
  notes: string | null
  shippingCost: number
  taxRate: number
  createdAt: string
  sentAt: string | null
  receivedAt: string | null
  supplier: {
    name: string
    email: string | null
    phone: string | null
    address: string | null
    city: string | null
    state: string | null
    zip: string | null
  }
  lineItems: LineItem[]
  subtotal: number
  tax: number
  total: number
}

const statusColors: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  SENT: 'bg-blue-100 text-blue-800',
  RECEIVED: 'bg-green-100 text-green-800',
}

export default function PurchaseOrderDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const router = useRouter()
  const [po, setPO] = useState<PurchaseOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    fetchPO()
  }, [params.id])

  async function fetchPO() {
    const res = await fetch(`/api/purchase-orders/${params.id}`)
    if (res.ok) {
      setPO(await res.json())
    }
    setLoading(false)
  }

  async function updateStatus(newStatus: string) {
    setUpdating(true)
    await fetch(`/api/purchase-orders/${params.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    fetchPO()
    setUpdating(false)
  }

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  function formatDate(dateString: string | null) {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  if (loading) {
    return <p className="text-gray-500">Loading...</p>
  }

  if (!po) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 mb-4">Purchase order not found</p>
        <Link href="/purchase-orders" className="text-maroon-800 hover:text-maroon-900">
          Back to Purchase Orders
        </Link>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/purchase-orders"
            className="text-maroon-800 hover:text-maroon-900 text-sm"
          >
            &larr; Back to Purchase Orders
          </Link>
          <div className="flex items-center gap-4 mt-2">
            <h1 className="text-3xl font-bold text-gray-900">{po.poNumber}</h1>
            <span
              className={`px-3 py-1 text-sm font-medium rounded-full ${
                statusColors[po.status] || 'bg-gray-100 text-gray-800'
              }`}
            >
              {po.status}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          {po.status === 'DRAFT' && (
            <>
              <Link
                href={`/purchase-orders/${po.id}/edit`}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Edit
              </Link>
              <button
                onClick={() => updateStatus('SENT')}
                disabled={updating}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium transition-colors disabled:opacity-50"
              >
                Mark as Sent
              </button>
            </>
          )}
          {po.status === 'SENT' && (
            <button
              onClick={() => updateStatus('RECEIVED')}
              disabled={updating}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md font-medium transition-colors disabled:opacity-50"
            >
              Mark as Received
            </button>
          )}
          <Link
            href={`/api/purchase-orders/${po.id}/pdf`}
            target="_blank"
            className="px-4 py-2 bg-maroon-800 hover:bg-maroon-900 text-white rounded-md font-medium transition-colors"
          >
            Download PDF
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Line Items</h2>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Product
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Qty
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Unit Price
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {po.lineItems.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">
                        {item.product.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {item.product.sku}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900">
                      {item.quantity} {item.product.unit}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900">
                      {formatCurrency(item.unitPrice)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {formatCurrency(item.quantity * item.unitPrice)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-right text-gray-600">
                    Subtotal:
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    {formatCurrency(po.subtotal)}
                  </td>
                </tr>
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-right text-gray-600">
                    Tax ({po.taxRate}%):
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    {formatCurrency(po.tax)}
                  </td>
                </tr>
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-right text-gray-600">
                    Shipping:
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    {formatCurrency(po.shippingCost)}
                  </td>
                </tr>
                <tr className="border-t-2">
                  <td colSpan={3} className="px-4 py-3 text-right text-lg font-medium">
                    Total:
                  </td>
                  <td className="px-4 py-3 text-right text-lg font-bold text-maroon-800">
                    {formatCurrency(po.total)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {po.notes && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-2">Notes</h2>
              <p className="text-gray-600">{po.notes}</p>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Supplier</h2>
            <div className="space-y-2">
              <p className="font-medium text-gray-900">{po.supplier.name}</p>
              {po.supplier.email && (
                <p className="text-gray-600">{po.supplier.email}</p>
              )}
              {po.supplier.phone && (
                <p className="text-gray-600">{po.supplier.phone}</p>
              )}
              {po.supplier.address && (
                <p className="text-gray-600">
                  {po.supplier.address}
                  <br />
                  {po.supplier.city}, {po.supplier.state} {po.supplier.zip}
                </p>
              )}
            </div>
          </div>

          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Timeline</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Created:</span>
                <span className="text-gray-900">{formatDate(po.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Sent:</span>
                <span className="text-gray-900">{formatDate(po.sentAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Received:</span>
                <span className="text-gray-900">{formatDate(po.receivedAt)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
