"use client"

import React, { useState } from 'react'
import Toast from './Toast'

interface ShareModalProps {
  isOpen: boolean
  url?: string
  onClose: () => void
}

export default function ShareModal({ isOpen, url, onClose }: ShareModalProps) {
  const [copied, setCopied] = useState(false)
  if (!isOpen) return null

  const copy = async () => {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => {
        setCopied(false)
        onClose()
      }, 1000)
    } catch (e) {
      console.error('Copy failed', e)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        <div className="relative w-full max-w-sm mx-4 bg-forseti-bg-card border border-forseti-border rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold mb-2">Share Activity</h3>
          <p className="text-sm text-forseti-text-secondary mb-4">Share this activity with others. Copy the link below or use your system share dialog.</p>
          <div className="mb-4">
            <input readOnly value={url || ''} className="w-full px-3 py-2 bg-forseti-bg-elevated border border-forseti-border rounded-lg text-sm" />
          </div>
          <div className="flex justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 rounded-lg bg-forseti-bg-elevated border border-forseti-border hover:bg-forseti-bg-hover transition-colors">Close</button>
            <button onClick={copy} className="px-4 py-2 rounded-lg bg-forseti-lime text-forseti-text-inverse hover:bg-forseti-lime-hover transition-colors">Copy Link</button>
          </div>
        </div>
      </div>
      <Toast open={copied} message="Link copied" onClose={() => setCopied(false)} />
    </>
  )
}
