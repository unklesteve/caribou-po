import { prisma } from '@/lib/prisma'
import { ColorForm } from '@/components/ColorForm'
import Link from 'next/link'
import { notFound } from 'next/navigation'

interface EditColorPageProps {
  params: { id: string }
}

export default async function EditColorPage({ params }: EditColorPageProps) {
  const color = await prisma.yoyoColor.findUnique({
    where: { id: params.id },
    include: {
      pantoneChips: {
        include: { pantone: true },
        orderBy: { orderIndex: 'asc' },
      },
      tags: true,
    },
  })

  if (!color) {
    notFound()
  }

  const formData = {
    id: color.id,
    name: color.name,
    imageUrl: color.imageUrl || '',
    description: color.description || '',
    isActive: color.isActive,
    pantoneLocked: color.pantoneLocked,
    pantoneIds: color.pantoneChips.map((cp) => cp.pantoneId),
    tagIds: color.tags.map((t) => t.id),
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/colors"
          className="text-maroon-800 hover:text-maroon-900 text-sm"
        >
          &larr; Back to Colors
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 mt-2">Edit Color</h1>
      </div>
      <ColorForm initialData={formData} />
    </div>
  )
}
