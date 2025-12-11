'use client'

import { useState } from 'react'
import { X, Check, Trophy, BarChart3, Video, CalendarDays, Target, Loader2 } from 'lucide-react'
import { api } from '../lib/api'

interface SubscriptionModalProps {
  isOpen: boolean
  onClose: () => void
  driverName: string
  driverId: string
  onSubscribe?: () => void
}

export default function SubscriptionModal({ isOpen, onClose, driverName, driverId, onSubscribe }: SubscriptionModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleSubscribe = async () => {
    setIsLoading(true)
    setError(null)

    try {
      await api.subscribe(driverId)
      setIsSuccess(true)

      // Call the callback after a brief delay to show success state
      setTimeout(() => {
        onSubscribe?.()
        onClose()
        // Reset state for next time
        setIsSuccess(false)
      }, 1500)
    } catch (err: any) {
      setError(err.message || 'Failed to subscribe')
    } finally {
      setIsLoading(false)
    }
  }

  const benefits = [
    {
      icon: Trophy,
      title: 'Support Your Favorite Drivers',
      description: 'Directly support professional drivers in their racing careers'
    },
    {
      icon: BarChart3,
      title: 'Access to Reference Laps',
      description: 'Compare your telemetry data against their best laps in Analyst'
    },
    {
      icon: Video,
      title: 'Exclusive Racing Content',
      description: 'Get access to behind-the-scenes content, tutorials, and insights'
    },
    {
      icon: CalendarDays,
      title: 'Access to Events',
      description: 'Join exclusive online events, Q&A sessions, and live streams'
    },
    {
      icon: Target,
      title: 'Preferential Coaching Slots',
      description: 'Get priority access to coaching sessions via ThePaddock'
    }
  ]

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-forseti-bg-card border border-forseti-border rounded-xl max-w-2xl w-full mx-4 relative max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-forseti-bg-card border-b border-forseti-border p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-1">Subscribe to {driverName}</h2>
            <p className="text-forseti-text-secondary">Unlock exclusive pro driver benefits</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-forseti-bg-hover rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Benefits */}
        <div className="p-6 space-y-4">
          <h3 className="text-lg font-semibold mb-4">What You Get:</h3>
          {benefits.map((benefit, index) => {
            const Icon = benefit.icon
            return (
              <div key={index} className="flex gap-4 p-4 bg-forseti-bg-elevated rounded-lg border border-forseti-border">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-forseti-lime/10 rounded-lg flex items-center justify-center">
                    <Icon className="w-5 h-5 text-forseti-lime" />
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-1">{benefit.title}</h4>
                  <p className="text-sm text-forseti-text-secondary">{benefit.description}</p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Pricing & CTA */}
        <div className="p-6 border-t border-forseti-border bg-forseti-bg-elevated">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-forseti-text-secondary text-sm mb-1">Monthly Subscription</p>
              <p className="text-3xl font-bold">£5.99<span className="text-lg text-forseti-text-secondary font-normal">/month</span></p>
            </div>
            <div className="flex items-center gap-2 text-forseti-lime">
              <Check className="w-5 h-5" />
              <span className="text-sm font-medium">Cancel anytime</span>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleSubscribe}
            disabled={isLoading || isSuccess}
            className={`w-full px-6 py-3 font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 ${
              isSuccess
                ? 'bg-green-500 text-white'
                : 'bg-forseti-lime text-forseti-text-inverse hover:bg-forseti-lime-hover'
            } ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Processing...
              </>
            ) : isSuccess ? (
              <>
                <Check className="w-5 h-5" />
                Subscribed!
              </>
            ) : (
              'Set Up Payment'
            )}
          </button>

          <p className="text-xs text-forseti-text-secondary text-center mt-3">
            {isSuccess ? 'You now have access to pro driver content' : 'Demo mode - no payment required'}
          </p>
        </div>
      </div>
    </div>
  )
}
