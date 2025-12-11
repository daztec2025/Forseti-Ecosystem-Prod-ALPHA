'use client'

import { AuthProvider } from './context/AuthContext'
import { SocialProvider } from './context/SocialContext'
import NavigationHandler from './components/NavigationHandler'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <SocialProvider>
        <NavigationHandler />
        {children}
      </SocialProvider>
    </AuthProvider>
  )
}
