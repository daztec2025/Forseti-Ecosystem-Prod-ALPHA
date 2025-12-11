'use client'

import { useState } from 'react'
import { X, AlertTriangle, Loader2 } from 'lucide-react'
import { api } from '../lib/api'

interface UnsubscribeModalProps {
  isOpen: boolean
  onClose: () => void
  driverName: string
  driverId: string
  onUnsubscribe?: () => void
}

export default function UnsubscribeModal({ isOpen, onClose, driverName, driverId, onUnsubscribe }: UnsubscribeModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleUnsubscribe = async () => {
    setIsLoading(true)
    setError(null)

    try {
      await api.unsubscribe(driverId)
      onUnsubscribe?.()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to unsubscribe')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-forseti-bg-card border border-forseti-border rounded-xl max-w-md w-full mx-4 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-500/10 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Unsubscribe</h2>
              <p className="text-forseti-text-secondary text-sm">from {driverName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-forseti-bg-hover rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 pb-4">
          <p className="text-forseti-text-secondary">
            Are you sure you want to unsubscribe from <span className="text-forseti-text-primary font-medium">{driverName}</span>?
          </p>
          <p className="text-forseti-text-secondary mt-3 text-sm">
            You will lose access to:
          </p>
          <ul className="mt-2 space-y-1 text-sm text-forseti-text-secondary">
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
              Their reference laps in Analyst
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
              Exclusive content and tutorials
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
              Priority coaching slots
            </li>
          </ul>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="p-6 border-t border-forseti-border flex gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 px-4 py-3 bg-forseti-bg-elevated rounded-lg font-semibold hover:bg-forseti-bg-hover transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleUnsubscribe}
            disabled={isLoading}
            className="flex-1 px-4 py-3 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Unsubscribing...
              </>
            ) : (
              'Unsubscribe'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
