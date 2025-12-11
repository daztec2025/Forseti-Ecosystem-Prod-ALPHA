'use client'

import { useState, useEffect, Suspense } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useRouter, useSearchParams } from 'next/navigation'
import ProtectedRoute from '../../components/ProtectedRoute'
import DashboardNav from '../../components/DashboardNav'
import { User, Save, X, Upload, Link2, Unlink } from 'lucide-react'

interface LinkedAccount {
  id: string
  provider: string
  email: string | null
  createdAt: string
}

// Component that handles OAuth callback params
function OAuthCallbackHandler({
  onMessage,
  onRefreshAccounts
}: {
  onMessage: (msg: { type: 'success' | 'error', text: string } | null) => void
  onRefreshAccounts: () => void
}) {
  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    const linked = searchParams.get('linked')
    const success = searchParams.get('success')
    const error = searchParams.get('error')
    const message = searchParams.get('message')

    if (linked && success === 'true') {
      onMessage({ type: 'success', text: `${linked.charAt(0).toUpperCase() + linked.slice(1)} account linked successfully!` })
      onRefreshAccounts()
      router.replace('/profile/edit')
    } else if (error) {
      onMessage({ type: 'error', text: message || 'Failed to link account' })
      router.replace('/profile/edit')
    }
  }, [searchParams, router, onMessage, onRefreshAccounts])

  return null
}

function EditProfileContent() {
  const { user, updateProfile } = useAuth()
  const router = useRouter()
  const [formData, setFormData] = useState({
    name: user?.name || '',
    username: user?.username || '',
    email: user?.email || '',
    bio: user?.bio || '',
  })
  const [previewImage, setPreviewImage] = useState<string | undefined>(user?.avatar)
  const [saving, setSaving] = useState(false)
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccount[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState(true)
  const [linkingProvider, setLinkingProvider] = useState<string | null>(null)
  const [unlinkingProvider, setUnlinkingProvider] = useState<string | null>(null)
  const [accountMessage, setAccountMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

  // Function to refresh linked accounts
  const refreshLinkedAccounts = async () => {
    const token = localStorage.getItem('forseti_token')
    if (!token) return

    try {
      const response = await fetch(`${API_URL}/api/auth/oauth/linked-accounts`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (response.ok) {
        const data = await response.json()
        setLinkedAccounts(data.accounts)
      }
    } catch (error) {
      console.error('Failed to fetch linked accounts:', error)
    } finally {
      setLoadingAccounts(false)
    }
  }

  // Fetch linked accounts on mount
  useEffect(() => {
    refreshLinkedAccounts()
  }, [API_URL])

  const isProviderLinked = (provider: string) => {
    return linkedAccounts.some(a => a.provider === provider)
  }

  const handleLinkAccount = (provider: string) => {
    setLinkingProvider(provider)
    const token = localStorage.getItem('forseti_token')
    const redirectUri = `${window.location.origin}/profile/edit`
    // Redirect to OAuth link endpoint with token in URL (since we can't send headers in a redirect)
    window.location.href = `${API_URL}/api/auth/oauth/link-account/${provider}?redirect_uri=${encodeURIComponent(redirectUri)}&token=${token}`
  }

  const handleUnlinkAccount = async (provider: string) => {
    if (!confirm(`Are you sure you want to unlink your ${provider.charAt(0).toUpperCase() + provider.slice(1)} account?`)) {
      return
    }

    setUnlinkingProvider(provider)
    setAccountMessage(null)

    try {
      const token = localStorage.getItem('forseti_token')
      const response = await fetch(`${API_URL}/api/auth/oauth/unlink/${provider}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })

      const data = await response.json()

      if (response.ok) {
        setLinkedAccounts(prev => prev.filter(a => a.provider !== provider))
        setAccountMessage({ type: 'success', text: `${provider.charAt(0).toUpperCase() + provider.slice(1)} account unlinked successfully` })
      } else {
        setAccountMessage({ type: 'error', text: data.message || data.error || 'Failed to unlink account' })
      }
    } catch (error) {
      setAccountMessage({ type: 'error', text: 'Failed to unlink account' })
    } finally {
      setUnlinkingProvider(null)
    }
  }

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file')
        return
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('Image size must be less than 5MB')
        return
      }

      // Create preview and convert to base64
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64String = reader.result as string
        setPreviewImage(base64String)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateProfile({
        name: formData.name,
        username: formData.username,
        bio: formData.bio,
        avatar: previewImage,
      })
      router.push('/profile')
    } catch (error) {
      console.error('Failed to update profile:', error)
      alert('Failed to update profile. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-forseti-bg-primary">
        <DashboardNav />

        {/* Handle OAuth callback params */}
        <Suspense fallback={null}>
          <OAuthCallbackHandler
            onMessage={setAccountMessage}
            onRefreshAccounts={refreshLinkedAccounts}
          />
        </Suspense>

        <div className="max-w-4xl mx-auto p-6">
          <div className="bg-forseti-bg-card rounded-xl p-8 border border-forseti-border">
            <h1 className="text-2xl font-bold mb-6">Edit Profile</h1>

            {/* Profile Picture */}
            <div className="mb-8">
              <label className="block text-sm font-medium text-forseti-text-secondary mb-4">
                Profile Picture
              </label>
              <div className="flex items-center gap-6">
                <div className="w-24 h-24 bg-forseti-bg-elevated rounded-full flex items-center justify-center overflow-hidden">
                  {previewImage ? (
                    <img src={previewImage} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-12 h-12 text-forseti-text-secondary" />
                  )}
                </div>
                <div>
                  <input
                    type="file"
                    id="photo-upload"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                  <label
                    htmlFor="photo-upload"
                    className="px-4 py-2 bg-forseti-bg-elevated rounded-lg border border-forseti-border hover:border-forseti-lime transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <Upload className="w-4 h-4" />
                    Upload Photo
                  </label>
                  <p className="text-xs text-forseti-text-secondary mt-2">
                    Max size: 5MB. Formats: JPG, PNG, GIF
                  </p>
                </div>
              </div>
            </div>

            {/* Full Name */}
            <div className="mb-6">
              <label htmlFor="name" className="block text-sm font-medium text-forseti-text-secondary mb-2">
                Full Name
              </label>
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 bg-forseti-bg-secondary rounded-lg border border-forseti-border focus:border-forseti-lime focus:outline-none focus:ring-1 focus:ring-forseti-lime transition-colors"
                placeholder="Enter your full name"
              />
            </div>

            {/* Username */}
            <div className="mb-6">
              <label htmlFor="username" className="block text-sm font-medium text-forseti-text-secondary mb-2">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="w-full px-4 py-3 bg-forseti-bg-secondary rounded-lg border border-forseti-border focus:border-forseti-lime focus:outline-none focus:ring-1 focus:ring-forseti-lime transition-colors"
                placeholder="Choose a username"
              />
            </div>

            {/* Email */}
            <div className="mb-6">
              <label htmlFor="email" className="block text-sm font-medium text-forseti-text-secondary mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={formData.email}
                disabled
                className="w-full px-4 py-3 bg-forseti-bg-secondary rounded-lg border border-forseti-border opacity-50 cursor-not-allowed"
                placeholder="Enter your email"
              />
            </div>

            {/* Bio */}
            <div className="mb-8">
              <label htmlFor="bio" className="block text-sm font-medium text-forseti-text-secondary mb-2">
                Bio
              </label>
              <textarea
                id="bio"
                rows={4}
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                className="w-full px-4 py-3 bg-forseti-bg-secondary rounded-lg border border-forseti-border focus:border-forseti-lime focus:outline-none focus:ring-1 focus:ring-forseti-lime transition-colors resize-none"
                placeholder="Tell us about yourself..."
              />
            </div>

            {/* Connected Accounts */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold mb-4">Connected Accounts</h2>
              <p className="text-sm text-forseti-text-secondary mb-4">
                Link your social accounts for easier sign-in and to display on your profile.
              </p>

              {accountMessage && (
                <div className={`mb-4 p-3 rounded-lg border ${
                  accountMessage.type === 'success'
                    ? 'bg-green-500/10 border-green-500 text-green-500'
                    : 'bg-forseti-error/10 border-forseti-error text-forseti-error'
                }`}>
                  <p className="text-sm">{accountMessage.text}</p>
                </div>
              )}

              <div className="space-y-3">
                {/* Google Account */}
                <div className="flex items-center justify-between p-4 bg-forseti-bg-secondary rounded-lg border border-forseti-border">
                  <div className="flex items-center gap-3">
                    <svg className="w-6 h-6" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    <div>
                      <p className="font-medium">Google</p>
                      {isProviderLinked('google') && (
                        <p className="text-xs text-forseti-text-secondary">
                          {linkedAccounts.find(a => a.provider === 'google')?.email || 'Connected'}
                        </p>
                      )}
                    </div>
                  </div>
                  {loadingAccounts ? (
                    <div className="w-5 h-5 border-2 border-forseti-lime border-t-transparent rounded-full animate-spin" />
                  ) : isProviderLinked('google') ? (
                    <button
                      onClick={() => handleUnlinkAccount('google')}
                      disabled={unlinkingProvider === 'google'}
                      className="px-4 py-2 text-sm bg-forseti-bg-primary rounded-lg border border-forseti-border hover:border-forseti-error hover:text-forseti-error transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                      <Unlink className="w-4 h-4" />
                      {unlinkingProvider === 'google' ? 'Unlinking...' : 'Unlink'}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleLinkAccount('google')}
                      disabled={linkingProvider === 'google'}
                      className="px-4 py-2 text-sm bg-forseti-lime text-forseti-text-inverse rounded-lg hover:bg-forseti-lime-hover transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                      <Link2 className="w-4 h-4" />
                      {linkingProvider === 'google' ? 'Linking...' : 'Link'}
                    </button>
                  )}
                </div>

                {/* Discord Account */}
                <div className="flex items-center justify-between p-4 bg-forseti-bg-secondary rounded-lg border border-forseti-border">
                  <div className="flex items-center gap-3">
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="#5865F2">
                      <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"/>
                    </svg>
                    <div>
                      <p className="font-medium">Discord</p>
                      {isProviderLinked('discord') && (
                        <p className="text-xs text-forseti-text-secondary">
                          {linkedAccounts.find(a => a.provider === 'discord')?.email || 'Connected'}
                        </p>
                      )}
                    </div>
                  </div>
                  {loadingAccounts ? (
                    <div className="w-5 h-5 border-2 border-forseti-lime border-t-transparent rounded-full animate-spin" />
                  ) : isProviderLinked('discord') ? (
                    <button
                      onClick={() => handleUnlinkAccount('discord')}
                      disabled={unlinkingProvider === 'discord'}
                      className="px-4 py-2 text-sm bg-forseti-bg-primary rounded-lg border border-forseti-border hover:border-forseti-error hover:text-forseti-error transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                      <Unlink className="w-4 h-4" />
                      {unlinkingProvider === 'discord' ? 'Unlinking...' : 'Unlink'}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleLinkAccount('discord')}
                      disabled={linkingProvider === 'discord'}
                      className="px-4 py-2 text-sm bg-forseti-lime text-forseti-text-inverse rounded-lg hover:bg-forseti-lime-hover transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                      <Link2 className="w-4 h-4" />
                      {linkingProvider === 'discord' ? 'Linking...' : 'Link'}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-4 mb-6">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-3 bg-forseti-lime text-forseti-text-inverse font-semibold rounded-lg hover:bg-forseti-lime-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>

              <button
                onClick={() => router.push('/profile')}
                className="px-6 py-3 bg-forseti-bg-elevated rounded-lg border border-forseti-border hover:border-forseti-error hover:text-forseti-error transition-colors flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}

// Default export wraps the content
export default function EditProfilePage() {
  return <EditProfileContent />
}
