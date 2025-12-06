import { ProductForm } from '@/components/ProductForm'
import Link from 'next/link'

export default function NewProductPage() {
  return (
    <div>
      <div className="mb-6">
        <Link
          href="/products"
          className="text-maroon-800 hover:text-maroon-900 text-sm"
        >
          &larr; Back to Products
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 mt-2">Add Product</h1>
      </div>
      <ProductForm />
    </div>
  )
}
