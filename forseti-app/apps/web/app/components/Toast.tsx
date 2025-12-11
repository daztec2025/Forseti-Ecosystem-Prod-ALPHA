'use client'

import { useEffect } from 'react'

interface ToastProps {
  message: string
  open: boolean
  onClose: () => void
}

export default function Toast({ message, open, onClose }: ToastProps) {
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => onClose(), 2000)
      return () => clearTimeout(t)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed bottom-6 right-6 z-60">
      <div className="bg-forseti-bg-card border border-forseti-border px-4 py-2 rounded-lg shadow-md">
        <span className="text-sm text-forseti-text-primary">{message}</span>
      </div>
    </div>
  )
}
