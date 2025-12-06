import { prisma } from '@/lib/prisma'
import { PurchaseOrderForm } from '@/components/PurchaseOrderForm'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

interface EditPurchaseOrderPageProps {
  params: { id: string }
}

export default async function EditPurchaseOrderPage({
  params,
}: EditPurchaseOrderPageProps) {
  const po = await prisma.purchaseOrder.findUnique({
    where: { id: params.id },
    include: {
      lineItems: { include: { product: true } },
    },
  })

  if (!po) {
    notFound()
  }

  // Only allow editing draft POs
  if (po.status !== 'DRAFT') {
    redirect(`/purchase-orders/${po.id}`)
  }

  const formData = {
    id: po.id,
    supplierId: po.supplierId,
    notes: po.notes || '',
    shippingCost: po.shippingCost,
    taxRate: po.taxRate,
    lineItems: po.lineItems.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      product: item.product,
    })),
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          href={`/purchase-orders/${po.id}`}
          className="text-maroon-800 hover:text-maroon-900 text-sm"
        >
          &larr; Back to {po.poNumber}
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 mt-2">
          Edit {po.poNumber}
        </h1>
      </div>
      <PurchaseOrderForm initialData={formData} />
    </div>
  )
}
