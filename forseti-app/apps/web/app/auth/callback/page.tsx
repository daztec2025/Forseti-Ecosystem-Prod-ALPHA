'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '../../context/AuthContext'
import AccountLinkingModal from '../../components/AccountLinkingModal'
import OAuthCompleteProfile from '../../components/OAuthCompleteProfile'

function OAuthCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { handleOAuthCallback } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [showProfileCompletion, setShowProfileCompletion] = useState(false)
  const [linkData, setLinkData] = useState<{
    email: string
    provider: string
    linkToken: string
  } | null>(null)
  const [profileData, setProfileData] = useState<{
    profileToken: string
    email: string
    name: string
    avatar: string
    provider: string
  } | null>(null)

  useEffect(() => {
    const processCallback = async () => {
      // Check for token (successful OAuth)
      const token = searchParams.get('token')
      if (token) {
        try {
          await handleOAuthCallback(token)
          const isNewUser = searchParams.get('new_user') === 'true'
          if (isNewUser) {
            // New user - could redirect to onboarding or profile setup
            router.push('/dashboard?welcome=true')
          } else {
            router.push('/dashboard')
          }
          return
        } catch (err) {
          setError('Failed to complete authentication')
          return
        }
      }

      // Check for account linking prompt or profile completion
      const action = searchParams.get('action')
      if (action === 'link_prompt') {
        const email = searchParams.get('email')
        const provider = searchParams.get('provider')
        const linkToken = searchParams.get('link_token')

        if (email && provider && linkToken) {
          setLinkData({ email, provider, linkToken })
          setShowLinkModal(true)
          return
        }
      }

      if (action === 'complete_profile') {
        const profileToken = searchParams.get('profile_token')
        const email = searchParams.get('email') || ''
        const name = searchParams.get('name') || ''
        const avatar = searchParams.get('avatar') || ''
        const provider = searchParams.get('provider') || ''

        if (profileToken) {
          setProfileData({ profileToken, email, name, avatar, provider })
          setShowProfileCompletion(true)
          return
        }
      }

      // Check for error
      const errorParam = searchParams.get('error')
      if (errorParam) {
        const message = searchParams.get('message') || 'Authentication failed'
        setError(message)
        return
      }

      // No valid params - redirect to home
      setError('Invalid callback. Please try again.')
    }

    processCallback()
  }, [searchParams, handleOAuthCallback, router])

  const handleLinkSuccess = (token: string) => {
    // Token received from linking - complete the auth
    handleOAuthCallback(token).then(() => {
      router.push('/dashboard')
    })
  }

  const handleLinkCancel = () => {
    setShowLinkModal(false)
    router.push('/')
  }

  const handleProfileSuccess = (token: string) => {
    handleOAuthCallback(token).then(() => {
      router.push('/dashboard?welcome=true')
    })
  }

  const handleProfileCancel = () => {
    setShowProfileCompletion(false)
    router.push('/')
  }

  if (showProfileCompletion && profileData) {
    return (
      <OAuthCompleteProfile
        profileToken={profileData.profileToken}
        email={profileData.email}
        name={profileData.name}
        avatar={profileData.avatar}
        provider={profileData.provider}
        onSuccess={handleProfileSuccess}
        onCancel={handleProfileCancel}
      />
    )
  }

  if (showLinkModal && linkData) {
    return (
      <AccountLinkingModal
        email={linkData.email}
        provider={linkData.provider}
        linkToken={linkData.linkToken}
        onSuccess={handleLinkSuccess}
        onCancel={handleLinkCancel}
      />
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-forseti-bg-primary flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-forseti-bg-card rounded-xl p-8 border border-forseti-border text-center">
            <div className="mb-4 p-3 bg-forseti-error/10 rounded-lg border border-forseti-error">
              <p className="text-sm text-forseti-error">{error}</p>
            </div>
            <button
              onClick={() => router.push('/')}
              className="w-full py-3 bg-forseti-lime text-forseti-text-inverse font-semibold rounded-lg hover:bg-forseti-lime-hover transition-colors"
            >
              Return to Login
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Loading state
  return (
    <div className="min-h-screen bg-forseti-bg-primary flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-forseti-bg-card rounded-xl p-8 border border-forseti-border text-center">
          <div className="animate-pulse">
            <div className="h-8 bg-forseti-bg-secondary rounded w-3/4 mx-auto mb-4"></div>
            <div className="h-4 bg-forseti-bg-secondary rounded w-1/2 mx-auto"></div>
          </div>
          <p className="text-forseti-text-secondary mt-4">Completing sign in...</p>
        </div>
      </div>
    </div>
  )
}

// Loading fallback component
function LoadingFallback() {
  return (
    <div className="min-h-screen bg-forseti-bg-primary flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-forseti-bg-card rounded-xl p-8 border border-forseti-border text-center">
          <div className="animate-pulse">
            <div className="h-8 bg-forseti-bg-secondary rounded w-3/4 mx-auto mb-4"></div>
            <div className="h-4 bg-forseti-bg-secondary rounded w-1/2 mx-auto"></div>
          </div>
          <p className="text-forseti-text-secondary mt-4">Loading...</p>
        </div>
      </div>
    </div>
  )
}

export default function OAuthCallbackPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <OAuthCallbackContent />
    </Suspense>
  )
}
