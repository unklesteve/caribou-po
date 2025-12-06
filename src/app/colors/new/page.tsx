import { ColorForm } from '@/components/ColorForm'
import Link from 'next/link'

export default function NewColorPage() {
  return (
    <div>
      <div className="mb-6">
        <Link
          href="/colors"
          className="text-maroon-800 hover:text-maroon-900 text-sm"
        >
          &larr; Back to Colors
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 mt-2">Add Color</h1>
      </div>
      <ColorForm />
    </div>
  )
}
