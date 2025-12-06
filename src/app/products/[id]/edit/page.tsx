import { prisma } from '@/lib/prisma'
import { ProductForm } from '@/components/ProductForm'
import Link from 'next/link'
import { notFound } from 'next/navigation'

interface EditProductPageProps {
  params: { id: string }
}

export default async function EditProductPage({ params }: EditProductPageProps) {
  const product = await prisma.product.findUnique({
    where: { id: params.id },
    include: {
      engravingArt: {
        orderBy: { position: 'asc' },
      },
      quotes: {
        orderBy: { quoteDate: 'desc' },
      },
    },
  })

  if (!product) {
    notFound()
  }

  const formData = {
    id: product.id,
    sku: product.sku,
    name: product.name,
    description: product.description || '',
    imageUrl: product.imageUrl || '',
    unitPrice: product.unitPrice.toString(),
    unit: product.unit,
    category: product.category || '',
    material: product.material || '',
    isActive: product.isActive,
    engravingArt: product.engravingArt,
    quotes: product.quotes.map(q => ({
      id: q.id,
      quoteDate: q.quoteDate.toISOString(),
      unitPrice: q.unitPrice,
      notes: q.notes,
    })),
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/products"
          className="text-maroon-800 hover:text-maroon-900 text-sm"
        >
          &larr; Back to Products
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 mt-2">Edit Product</h1>
      </div>
      <ProductForm initialData={formData} />
    </div>
  )
}
