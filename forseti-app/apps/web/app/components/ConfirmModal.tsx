'use client'

import React from 'react'

interface ConfirmModalProps {
  isOpen: boolean
  title?: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmModal({ isOpen, title, description, confirmLabel = 'Confirm', cancelLabel = 'Cancel', onConfirm, onCancel }: ConfirmModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-md mx-4 bg-forseti-bg-card border border-forseti-border rounded-lg shadow-lg p-6">
        {title && <h3 className="text-lg font-semibold mb-2">{title}</h3>}
        {description && <p className="text-sm text-forseti-text-secondary mb-4">{description}</p>}
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg bg-forseti-bg-elevated border border-forseti-border hover:bg-forseti-bg-hover transition-colors">{cancelLabel}</button>
          <button onClick={onConfirm} className="px-4 py-2 rounded-lg bg-forseti-lime text-forseti-text-inverse hover:bg-forseti-lime-hover transition-colors">{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
