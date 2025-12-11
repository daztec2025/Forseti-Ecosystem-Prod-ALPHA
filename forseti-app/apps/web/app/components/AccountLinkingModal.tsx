'use client'

import { useState } from 'react'

interface AccountLinkingModalProps {
  email: string
  provider: string
  linkToken: string
  onSuccess: (token: string) => void
  onCancel: () => void
}

export default function AccountLinkingModal({
  email,
  provider,
  linkToken,
  onSuccess,
  onCancel,
}: AccountLinkingModalProps) {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

  const providerName = provider.charAt(0).toUpperCase() + provider.slice(1)

  const handleLinkAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch(`${API_URL}/api/auth/oauth/link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ linkToken, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to link account')
        setLoading(false)
        return
      }

      onSuccess(data.token)
    } catch (err) {
      setError('Connection error. Please try again.')
      setLoading(false)
    }
  }

  const handleCreateNew = async () => {
    setLoading(true)
    setError('')

    try {
      const response = await fetch(`${API_URL}/api/auth/oauth/create-new`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ linkToken }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to create account')
        setLoading(false)
        return
      }

      onSuccess(data.token)
    } catch (err) {
      setError('Connection error. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-forseti-bg-primary flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-forseti-bg-card rounded-xl p-8 border border-forseti-border">
          <h2 className="text-2xl font-bold text-center mb-2">Account Found</h2>
          <p className="text-forseti-text-secondary text-center mb-6">
            An account with <span className="text-forseti-lime">{email}</span> already exists.
          </p>

          {error && (
            <div className="mb-4 p-3 bg-forseti-error/10 rounded-lg border border-forseti-error">
              <p className="text-sm text-forseti-error">{error}</p>
            </div>
          )}

          {/* Option 1: Link accounts */}
          <div className="mb-6 p-4 bg-forseti-bg-secondary rounded-lg border border-forseti-border">
            <h3 className="font-semibold mb-2">Link your {providerName} account</h3>
            <p className="text-sm text-forseti-text-secondary mb-4">
              Enter your password to link {providerName} to your existing account. You&apos;ll be able to sign in with either method.
            </p>
            <form onSubmit={handleLinkAccount}>
              <div className="mb-3">
                <label htmlFor="password" className="block text-sm font-medium text-forseti-text-secondary mb-2">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-forseti-bg-primary rounded-lg border border-forseti-border focus:border-forseti-lime focus:outline-none focus:ring-1 focus:ring-forseti-lime transition-colors"
                  placeholder="Enter your password"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading || !password}
                className="w-full py-3 bg-forseti-lime text-forseti-text-inverse font-semibold rounded-lg hover:bg-forseti-lime-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Linking...' : 'Link Accounts'}
              </button>
            </form>
          </div>

          {/* Option 2: Create new account */}
          <div className="mb-6 p-4 bg-forseti-bg-secondary rounded-lg border border-forseti-border">
            <h3 className="font-semibold mb-2">Create a new account</h3>
            <p className="text-sm text-forseti-text-secondary mb-4">
              Create a separate account using your {providerName} profile. This will be a new account unrelated to your existing one.
            </p>
            <button
              type="button"
              onClick={handleCreateNew}
              disabled={loading}
              className="w-full py-3 bg-forseti-bg-primary text-forseti-text-primary font-semibold rounded-lg border border-forseti-border hover:border-forseti-lime transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : 'Create New Account'}
            </button>
          </div>

          {/* Cancel button */}
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="w-full py-3 text-forseti-text-secondary hover:text-forseti-text-primary transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
