'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import ProtectedRoute from '../components/ProtectedRoute'

export default function ProfilePage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to dashboard
    router.push('/dashboard')
  }, [router])

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-forseti-bg-primary flex items-center justify-center">
        <p className="text-forseti-text-secondary">Redirecting...</p>
      </div>
    </ProtectedRoute>
  )
}
