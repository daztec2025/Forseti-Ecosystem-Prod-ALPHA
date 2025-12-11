'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'

interface OAuthCompleteProfileProps {
  profileToken: string
  email: string
  name: string
  avatar: string
  provider: string
  onSuccess: (token: string) => void
  onCancel: () => void
}

export default function OAuthCompleteProfile({
  profileToken,
  email,
  name,
  avatar,
  provider,
  onSuccess,
  onCancel,
}: OAuthCompleteProfileProps) {
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle')
  const [checkTimeout, setCheckTimeout] = useState<NodeJS.Timeout | null>(null)

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
  const providerName = provider.charAt(0).toUpperCase() + provider.slice(1)

  // Check username availability with debounce
  const checkUsername = useCallback(async (value: string) => {
    if (!value || value.length < 3) {
      setUsernameStatus('idle')
      return
    }

    // Validate format first
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/
    if (!usernameRegex.test(value)) {
      setUsernameStatus('invalid')
      return
    }

    setUsernameStatus('checking')

    try {
      const response = await fetch(`${API_URL}/api/auth/oauth/check-username?username=${encodeURIComponent(value)}`)
      const data = await response.json()

      if (data.error) {
        setUsernameStatus('invalid')
      } else if (data.available) {
        setUsernameStatus('available')
      } else {
        setUsernameStatus('taken')
      }
    } catch {
      setUsernameStatus('idle')
    }
  }, [API_URL])

  // Debounced username check
  useEffect(() => {
    if (checkTimeout) {
      clearTimeout(checkTimeout)
    }

    if (username.length >= 3) {
      const timeout = setTimeout(() => {
        checkUsername(username)
      }, 300)
      setCheckTimeout(timeout)
    } else {
      setUsernameStatus('idle')
    }

    return () => {
      if (checkTimeout) {
        clearTimeout(checkTimeout)
      }
    }
  }, [username, checkUsername])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (usernameStatus !== 'available') {
      setError('Please choose a valid, available username')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch(`${API_URL}/api/auth/oauth/complete-profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ profileToken, username }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to complete profile')
        setLoading(false)
        return
      }

      onSuccess(data.token)
    } catch {
      setError('Connection error. Please try again.')
      setLoading(false)
    }
  }

  const getUsernameHelperText = () => {
    switch (usernameStatus) {
      case 'checking':
        return <span className="text-forseti-text-secondary">Checking availability...</span>
      case 'available':
        return <span className="text-green-500">Username is available!</span>
      case 'taken':
        return <span className="text-forseti-error">Username is already taken</span>
      case 'invalid':
        return <span className="text-forseti-error">3-20 characters, letters, numbers, and underscores only</span>
      default:
        return <span className="text-forseti-text-secondary">Choose a unique username</span>
    }
  }

  return (
    <div className="min-h-screen bg-forseti-bg-primary flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-forseti-bg-card rounded-xl p-8 border border-forseti-border">
          <h2 className="text-2xl font-bold text-center mb-2">Complete Your Profile</h2>
          <p className="text-forseti-text-secondary text-center mb-6">
            Welcome! Just one more step to finish setting up your account.
          </p>

          {/* Profile Preview */}
          <div className="flex items-center gap-4 mb-6 p-4 bg-forseti-bg-secondary rounded-lg border border-forseti-border">
            {avatar ? (
              <Image
                src={avatar}
                alt="Profile"
                width={64}
                height={64}
                className="rounded-full"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-forseti-lime/20 flex items-center justify-center">
                <span className="text-2xl font-bold text-forseti-lime">
                  {name?.charAt(0)?.toUpperCase() || '?'}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{name || 'New User'}</p>
              <p className="text-sm text-forseti-text-secondary truncate">{email}</p>
              <p className="text-xs text-forseti-text-secondary mt-1">
                via {providerName}
              </p>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-forseti-error/10 rounded-lg border border-forseti-error">
              <p className="text-sm text-forseti-error">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label htmlFor="username" className="block text-sm font-medium text-forseti-text-secondary mb-2">
                Choose your username
              </label>
              <div className="relative">
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  className={`w-full px-4 py-3 bg-forseti-bg-secondary rounded-lg border transition-colors focus:outline-none focus:ring-1 ${
                    usernameStatus === 'available'
                      ? 'border-green-500 focus:border-green-500 focus:ring-green-500'
                      : usernameStatus === 'taken' || usernameStatus === 'invalid'
                      ? 'border-forseti-error focus:border-forseti-error focus:ring-forseti-error'
                      : 'border-forseti-border focus:border-forseti-lime focus:ring-forseti-lime'
                  }`}
                  placeholder="Enter username"
                  maxLength={20}
                  required
                />
                {usernameStatus === 'checking' && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="w-5 h-5 border-2 border-forseti-lime border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
                {usernameStatus === 'available' && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
                {(usernameStatus === 'taken' || usernameStatus === 'invalid') && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-forseti-error">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                )}
              </div>
              <p className="mt-2 text-xs">{getUsernameHelperText()}</p>
            </div>

            <button
              type="submit"
              disabled={loading || usernameStatus !== 'available'}
              className="w-full py-3 bg-forseti-lime text-forseti-text-inverse font-semibold rounded-lg hover:bg-forseti-lime-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating Account...' : 'Complete Registration'}
            </button>
          </form>

          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="w-full mt-4 py-3 text-forseti-text-secondary hover:text-forseti-text-primary transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
