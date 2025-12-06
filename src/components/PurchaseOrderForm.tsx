'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

interface Supplier {
  id: string
  name: string
}

interface Product {
  id: string
  sku: string
  name: string
  unitPrice: number
  unit: string
}

interface LineItem {
  productId: string
  quantity: number
  unitPrice: number
  product?: Product
}

interface PurchaseOrderFormProps {
  initialData?: {
    id: string
    supplierId: string
    notes: string
    shippingCost: number
    taxRate: number
    lineItems: LineItem[]
  }
}

export function PurchaseOrderForm({ initialData }: PurchaseOrderFormProps) {
  const router = useRouter()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [saving, setSaving] = useState(false)

  const [supplierId, setSupplierId] = useState(initialData?.supplierId || '')
  const [notes, setNotes] = useState(initialData?.notes || '')
  const [shippingCost, setShippingCost] = useState(
    initialData?.shippingCost?.toString() || '0'
  )
  const [taxRate, setTaxRate] = useState(
    initialData?.taxRate?.toString() || '0'
  )
  const [lineItems, setLineItems] = useState<LineItem[]>(
    initialData?.lineItems || []
  )

  const isEditing = !!initialData?.id

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    const [suppliersRes, productsRes] = await Promise.all([
      fetch('/api/suppliers'),
      fetch('/api/products?activeOnly=true'),
    ])
    setSuppliers(await suppliersRes.json())
    setProducts(await productsRes.json())
  }

  function addLineItem() {
    if (products.length === 0) return
    const product = products[0]
    setLineItems([
      ...lineItems,
      {
        productId: product.id,
        quantity: 1,
        unitPrice: product.unitPrice,
        product,
      },
    ])
  }

  function updateLineItem(index: number, field: string, value: string | number) {
    const updated = [...lineItems]
    if (field === 'productId') {
      const product = products.find((p) => p.id === value)
      if (product) {
        updated[index] = {
          ...updated[index],
          productId: value as string,
          unitPrice: product.unitPrice,
          product,
        }
      }
    } else if (field === 'quantity') {
      updated[index] = { ...updated[index], quantity: parseInt(value as string) || 1 }
    } else if (field === 'unitPrice') {
      updated[index] = { ...updated[index], unitPrice: parseFloat(value as string) || 0 }
    }
    setLineItems(updated)
  }

  function removeLineItem(index: number) {
    setLineItems(lineItems.filter((_, i) => i !== index))
  }

  function calculateSubtotal() {
    return lineItems.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0
    )
  }

  function calculateTax() {
    return calculateSubtotal() * (parseFloat(taxRate) / 100)
  }

  function calculateTotal() {
    return calculateSubtotal() + calculateTax() + (parseFloat(shippingCost) || 0)
  }

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!supplierId) {
      alert('Please select a supplier')
      return
    }
    if (lineItems.length === 0) {
      alert('Please add at least one line item')
      return
    }

    setSaving(true)

    const data = {
      supplierId,
      notes,
      shippingCost,
      taxRate,
      lineItems: lineItems.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
    }

    const url = isEditing
      ? `/api/purchase-orders/${initialData.id}`
      : '/api/purchase-orders'
    const method = isEditing ? 'PUT' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    const po = await res.json()
    router.push(`/purchase-orders/${po.id}`)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Order Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Supplier *
            </label>
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-caramel-600"
            >
              <option value="">Select a supplier</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes for this order"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-caramel-600"
            />
          </div>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-medium text-gray-900">Line Items</h2>
          <button
            type="button"
            onClick={addLineItem}
            disabled={products.length === 0}
            className="bg-maroon-800 hover:bg-maroon-900 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
          >
            Add Item
          </button>
        </div>

        {lineItems.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            No items added yet. Click &quot;Add Item&quot; to begin.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Product
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-28">
                    Quantity
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-32">
                    Unit Price
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase w-28">
                    Total
                  </th>
                  <th className="px-4 py-3 w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {lineItems.map((item, index) => (
                  <tr key={index}>
                    <td className="px-4 py-3">
                      <select
                        value={item.productId}
                        onChange={(e) =>
                          updateLineItem(index, 'productId', e.target.value)
                        }
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-caramel-600 text-sm"
                      >
                        {products.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.sku} - {product.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) =>
                          updateLineItem(index, 'quantity', e.target.value)
                        }
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-caramel-600 text-sm"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="relative">
                        <span className="absolute left-2 top-1.5 text-gray-500 text-sm">
                          $
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(e) =>
                            updateLineItem(index, 'unitPrice', e.target.value)
                          }
                          className="w-full pl-6 pr-3 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-caramel-600 text-sm"
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {formatCurrency(item.quantity * item.unitPrice)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => removeLineItem(index)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Order Summary</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tax Rate (%)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={taxRate}
              onChange={(e) => setTaxRate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-caramel-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Shipping Cost
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-gray-500">$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={shippingCost}
                onChange={(e) => setShippingCost(e.target.value)}
                className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-caramel-600"
              />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Subtotal:</span>
              <span className="font-medium">{formatCurrency(calculateSubtotal())}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Tax:</span>
              <span className="font-medium">{formatCurrency(calculateTax())}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Shipping:</span>
              <span className="font-medium">
                {formatCurrency(parseFloat(shippingCost) || 0)}
              </span>
            </div>
            <div className="flex justify-between text-lg border-t pt-2">
              <span className="font-medium">Total:</span>
              <span className="font-bold text-maroon-800">
                {formatCurrency(calculateTotal())}
              </span>
            </div>
          </div>
        </div>
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
          className="px-6 py-2 bg-maroon-800 hover:bg-maroon-900 text-white rounded-md font-medium transition-colors disabled:opacity-50"
        >
          {saving
            ? 'Saving...'
            : isEditing
            ? 'Update Purchase Order'
            : 'Create Purchase Order'}
        </button>
      </div>
    </form>
  )
}
