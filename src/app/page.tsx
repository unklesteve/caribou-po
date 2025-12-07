import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { ImportPOButton } from '@/components/ImportPOButton'

export const dynamic = 'force-dynamic'

async function getStats() {
  const [
    totalPOs,
    draftPOs,
    orderedPOs,
    inProductionPOs,
    receivedPOs,
    totalSuppliers,
    totalProducts,
    recentPOs,
  ] = await Promise.all([
    prisma.purchaseOrder.count(),
    prisma.purchaseOrder.count({ where: { status: 'DRAFT' } }),
    prisma.purchaseOrder.count({ where: { status: 'ORDERED' } }),
    prisma.purchaseOrder.count({ where: { status: 'IN_PRODUCTION' } }),
    prisma.purchaseOrder.count({ where: { status: 'RECEIVED' } }),
    prisma.supplier.count(),
    prisma.product.count(),
    prisma.purchaseOrder.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        supplier: true,
        lineItems: true,
      },
    }),
  ])

  return {
    totalPOs,
    draftPOs,
    orderedPOs,
    inProductionPOs,
    receivedPOs,
    totalSuppliers,
    totalProducts,
    recentPOs,
  }
}

function formatDate(date: Date) {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

const statusColors: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  ORDERED: 'bg-blue-100 text-blue-800',
  IN_PRODUCTION: 'bg-yellow-100 text-yellow-800',
  RECEIVED: 'bg-green-100 text-green-800',
}

const statusLabels: Record<string, string> = {
  DRAFT: 'Draft',
  ORDERED: 'Ordered',
  IN_PRODUCTION: 'In Production',
  RECEIVED: 'Received',
}

export default async function DashboardPage() {
  const stats = await getStats()

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">
          Welcome to Caribou Lodge Purchase Order Generator
        </p>
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <div className="flex flex-wrap gap-4">
          <Link
            href="/purchase-orders/new"
            className="bg-maroon-800 hover:bg-maroon-900 text-white px-6 py-3 rounded-lg font-medium transition-colors shadow-sm"
          >
            Create New PO
          </Link>
          <Link
            href="/suppliers/new"
            className="bg-white hover:bg-gray-50 text-gray-700 px-6 py-3 rounded-lg font-medium transition-colors shadow-sm border border-gray-300"
          >
            Add Supplier
          </Link>
          <Link
            href="/products/new"
            className="bg-white hover:bg-gray-50 text-gray-700 px-6 py-3 rounded-lg font-medium transition-colors shadow-sm border border-gray-300"
          >
            Add Product
          </Link>
          <ImportPOButton />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-gray-500">Total POs</div>
          <div className="text-3xl font-bold text-gray-900 mt-1">
            {stats.totalPOs}
          </div>
          <Link
            href="/purchase-orders"
            className="text-maroon-800 hover:text-maroon-900 text-sm mt-2 inline-block"
          >
            View all &rarr;
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-gray-500">By Status</div>
          <div className="mt-2 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Draft:</span>
              <span className="font-medium">{stats.draftPOs}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-blue-600">Ordered:</span>
              <span className="font-medium">{stats.orderedPOs}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-yellow-600">In Production:</span>
              <span className="font-medium">{stats.inProductionPOs}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-green-600">Received:</span>
              <span className="font-medium">{stats.receivedPOs}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-gray-500">Suppliers</div>
          <div className="text-3xl font-bold text-gray-900 mt-1">
            {stats.totalSuppliers}
          </div>
          <Link
            href="/suppliers"
            className="text-maroon-800 hover:text-maroon-900 text-sm mt-2 inline-block"
          >
            Manage &rarr;
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm font-medium text-gray-500">Products</div>
          <div className="text-3xl font-bold text-gray-900 mt-1">
            {stats.totalProducts}
          </div>
          <Link
            href="/products"
            className="text-maroon-800 hover:text-maroon-900 text-sm mt-2 inline-block"
          >
            Manage &rarr;
          </Link>
        </div>
      </div>

      {/* Recent POs */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">
            Recent Purchase Orders
          </h2>
        </div>
        {stats.recentPOs.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-gray-500 mb-4">No purchase orders yet</p>
            <Link
              href="/purchase-orders/new"
              className="text-maroon-800 hover:text-maroon-900 font-medium"
            >
              Create your first purchase order
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {stats.recentPOs.map((po) => (
              <Link
                key={po.id}
                href={`/purchase-orders/${po.id}`}
                className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div>
                    <div className="font-medium text-gray-900">{po.poNumber}</div>
                    <div className="text-sm text-gray-500">
                      {po.supplier.name}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${
                      statusColors[po.status]
                    }`}
                  >
                    {statusLabels[po.status] || po.status}
                  </span>
                  <div className="text-sm text-gray-500">
                    {formatDate(po.createdAt)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
        {stats.totalPOs > 5 && (
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
            <Link
              href="/purchase-orders"
              className="text-maroon-800 hover:text-maroon-900 text-sm font-medium"
            >
              View all purchase orders &rarr;
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
