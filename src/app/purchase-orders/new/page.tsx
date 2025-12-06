import { PurchaseOrderForm } from '@/components/PurchaseOrderForm'
import Link from 'next/link'

export default function NewPurchaseOrderPage() {
  return (
    <div>
      <div className="mb-6">
        <Link
          href="/purchase-orders"
          className="text-maroon-800 hover:text-maroon-900 text-sm"
        >
          &larr; Back to Purchase Orders
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 mt-2">
          Create Purchase Order
        </h1>
      </div>
      <PurchaseOrderForm />
    </div>
  )
}
