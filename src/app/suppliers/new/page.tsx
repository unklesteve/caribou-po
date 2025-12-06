import { SupplierForm } from '@/components/SupplierForm'
import Link from 'next/link'

export default function NewSupplierPage() {
  return (
    <div>
      <div className="mb-6">
        <Link
          href="/suppliers"
          className="text-maroon-800 hover:text-maroon-900 text-sm"
        >
          &larr; Back to Suppliers
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 mt-2">Add Supplier</h1>
      </div>
      <SupplierForm />
    </div>
  )
}
