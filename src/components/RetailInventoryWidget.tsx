'use client'

import Link from 'next/link'
import { useState } from 'react'

interface RetailInventoryItem {
  id: string
  productId: string
  productName: string
  productSku: string
  productLastReleasedAt: string | null
  retailerId: string
  retailerName: string
  totalInventory: number | null
  variantData: string | null
  fetchedAt: string | null
}

interface RetailInventoryWidgetProps {
  retailInventory: RetailInventoryItem[]
}

interface VariantData {
  id: number
  title: string
  quantity: number
  available: boolean
}

export function RetailInventoryWidget({ retailInventory }: RetailInventoryWidgetProps) {
  const [refreshing, setRefreshing] = useState(false)
  const [inventory, setInventory] = useState(retailInventory)
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null)

  // Group inventory by product
  const productGroups = inventory.reduce((acc, item) => {
    if (!acc[item.productId]) {
      acc[item.productId] = {
        productId: item.productId,
        productName: item.productName,
        productSku: item.productSku,
        productLastReleasedAt: item.productLastReleasedAt,
        retailers: [],
      }
    }
    acc[item.productId].retailers.push(item)
    return acc
  }, {} as Record<string, { productId: string; productName: string; productSku: string; productLastReleasedAt: string | null; retailers: RetailInventoryItem[] }>)

  // Sort products by most recent release date (newest first), products without release date go to bottom
  const products = Object.values(productGroups).sort((a, b) => {
    if (!a.productLastReleasedAt && !b.productLastReleasedAt) return 0
    if (!a.productLastReleasedAt) return 1
    if (!b.productLastReleasedAt) return -1
    return new Date(b.productLastReleasedAt).getTime() - new Date(a.productLastReleasedAt).getTime()
  })

  async function handleRefreshAll() {
    setRefreshing(true)
    try {
      const res = await fetch('/api/retail-inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ retailProductIds: inventory.map(i => i.id) }),
      })

      const result = await res.json()
      if (result.results) {
        const updatedInventory = inventory.map(item => {
          const inventoryResult = result.results.find((r: { retailProductId: string }) => r.retailProductId === item.id)
          if (inventoryResult?.success) {
            return {
              ...item,
              totalInventory: inventoryResult.totalInventory,
              variantData: JSON.stringify(inventoryResult.variants),
              fetchedAt: new Date().toISOString(),
            }
          }
          return item
        })
        setInventory(updatedInventory)
      }
    } catch (error) {
      console.error('Failed to refresh inventory:', error)
    }
    setRefreshing(false)
  }

  function formatDate(dateString: string | null) {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  function getTotalForProduct(retailers: RetailInventoryItem[]): number {
    return retailers.reduce((sum, r) => sum + (r.totalInventory ?? 0), 0)
  }

  return (
    <div className="bg-white rounded-lg shadow mb-8">
      <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Retail Inventory</h2>
          <p className="text-sm text-gray-500">Track inventory levels at retail partners</p>
        </div>
        <button
          onClick={handleRefreshAll}
          disabled={refreshing}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-md font-medium transition-colors disabled:opacity-50"
        >
          {refreshing ? 'Refreshing...' : 'Refresh All'}
        </button>
      </div>

      <div className="divide-y divide-gray-100">
        {products.map((product) => {
          const totalUnits = getTotalForProduct(product.retailers)
          const isExpanded = expandedProduct === product.productId

          return (
            <div key={product.productId} className="px-6 py-4">
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setExpandedProduct(isExpanded ? null : product.productId)}
              >
                <div className="flex items-center gap-4">
                  <div>
                    <Link
                      href={`/products/${product.productId}/edit`}
                      className="font-medium text-gray-900 hover:text-maroon-800"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {product.productName}
                    </Link>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-gray-500">{product.productSku}</p>
                      {product.productLastReleasedAt && (
                        <span className="text-xs text-green-600">
                          Released {formatDate(product.productLastReleasedAt)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className={`text-lg font-semibold ${totalUnits > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {totalUnits} units
                    </div>
                    <p className="text-xs text-gray-500">
                      across {product.retailers.length} retailer{product.retailers.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <svg
                    className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {isExpanded && (
                <div className="mt-4 pl-4 border-l-2 border-gray-100 space-y-3">
                  {product.retailers.map((retailer) => {
                    const variants: VariantData[] = retailer.variantData ? JSON.parse(retailer.variantData) : []
                    const inStockVariants = variants.filter(v => v.quantity > 0).length
                    const totalVariants = variants.length

                    return (
                      <div key={retailer.id} className="bg-gray-50 rounded-lg p-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-medium text-gray-900">{retailer.retailerName}</span>
                            <span className={`ml-2 px-2 py-0.5 text-xs font-medium rounded-full ${
                              (retailer.totalInventory ?? 0) > 0
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {retailer.totalInventory ?? 0} units
                            </span>
                            {totalVariants > 0 && (
                              <span className="ml-2 text-xs text-gray-500">
                                ({inStockVariants}/{totalVariants} variants in stock)
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-gray-400">
                            Updated: {formatDate(retailer.fetchedAt)}
                          </span>
                        </div>

                        {variants.length > 0 && (
                          <div className="mt-2 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1">
                            {variants.map((v) => (
                              <div
                                key={v.id}
                                className={`text-xs px-2 py-1 rounded ${
                                  v.quantity > 0
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-gray-200 text-gray-500'
                                }`}
                              >
                                <span className="truncate">{v.title}</span>
                                <span className="ml-1 font-medium">({v.quantity})</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {products.length === 0 && (
        <div className="px-6 py-8 text-center text-gray-500">
          <p>No retail links configured yet.</p>
          <p className="text-sm mt-1">
            Add retail links to products to track inventory at your retail partners.
          </p>
        </div>
      )}
    </div>
  )
}
