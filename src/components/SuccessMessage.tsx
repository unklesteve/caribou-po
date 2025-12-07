'use client'

import { useEffect, useState } from 'react'

interface SuccessMessageProps {
  message: string | null
  onClear: () => void
  duration?: number
}

export function SuccessMessage({ message, onClear, duration = 3000 }: SuccessMessageProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (message) {
      setVisible(true)
      const timer = setTimeout(() => {
        setVisible(false)
        setTimeout(onClear, 300) // Wait for fade animation
      }, duration)
      return () => clearTimeout(timer)
    }
  }, [message, duration, onClear])

  if (!message) return null

  return (
    <div
      className={`fixed top-4 right-4 z-50 transition-all duration-300 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
      }`}
    >
      <div className="bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        <span className="font-medium">{message}</span>
        <button
          onClick={() => {
            setVisible(false)
            setTimeout(onClear, 300)
          }}
          className="ml-2 hover:bg-green-700 rounded p-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}
