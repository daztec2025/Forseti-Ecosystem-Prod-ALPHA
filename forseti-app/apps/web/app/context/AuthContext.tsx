/**
 * @fileoverview Authentication Context Provider
 *
 * Provides centralized authentication state management for the Forseti application.
 * Handles user login, registration, logout, profile updates, and token persistence.
 *
 * @module context/AuthContext
 *
 * @example
 * // Wrap your app with AuthProvider in layout.tsx
 * import { AuthProvider } from './context/AuthContext'
 *
 * export default function RootLayout({ children }) {
 *   return (
 *     <AuthProvider>
 *       {children}
 *     </AuthProvider>
 *   )
 * }
 *
 * @example
 * // Use auth state in components
 * import { useAuth } from '../context/AuthContext'
 *
 * function ProfilePage() {
 *   const { user, logout } = useAuth()
 *   return <div>Welcome, {user?.name}</div>
 * }
 */

'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '../lib/api'

/**
 * User profile data structure
 *
 * @interface User
 * @property {string} id - Unique user identifier (UUID)
 * @property {string} email - User's email address
 * @property {string} username - Unique username for mentions and URLs
 * @property {string} name - Display name
 * @property {string} [avatar] - URL to user's avatar image
 * @property {string} [bio] - User's bio/description
 * @property {boolean} [isPro] - Whether user has Pro status
 * @property {string} [engagementLevel] - Current rank level (bronze/silver/gold/platinum)
 * @property {number} [engagementPoints] - Total engagement points earned
 */
interface User {
  id: string
  email: string
  username: string
  name: string
  avatar?: string
  bio?: string
  isPro?: boolean
  isFoundingDriver?: boolean
  engagementLevel?: string
  engagementPoints?: number
}

/**
 * Authentication context type definition
 *
 * @interface AuthContextType
 * @property {User | null} user - Current authenticated user or null
 * @property {Function} login - Authenticate user with email/password
 * @property {Function} register - Create new user account
 * @property {Function} logout - Sign out and clear session
 * @property {Function} updateProfile - Update user profile data
 * @property {boolean} isLoading - Whether auth state is being determined
 */
interface AuthContextType {
  user: User | null
  login: (email: string, password: string, rememberMe?: boolean) => Promise<boolean>
  register: (email: string, password: string, name: string, username: string) => Promise<boolean>
  logout: () => void
  updateProfile: (data: Partial<User>) => Promise<void>
  handleOAuthCallback: (token: string) => Promise<void>
  isLoading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

/**
 * Authentication Provider Component
 *
 * Wraps the application with authentication state management.
 * On mount, checks for existing auth token and restores user session.
 *
 * @component
 * @param {Object} props - Component props
 * @param {ReactNode} props.children - Child components to wrap
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    // Check if user has a token and fetch their profile
    const token = localStorage.getItem('forseti_token')
    if (token) {
      api.getProfile()
        .then(setUser)
        .catch(() => {
          localStorage.removeItem('forseti_token')
        })
        .finally(() => setIsLoading(false))
    } else {
      setIsLoading(false)
    }
  }, [])

  const login = async (email: string, password: string, rememberMe: boolean = false): Promise<boolean> => {
    try {
      const user = await api.login(email, password, rememberMe)
      setUser(user)
      router.push('/dashboard')
      return true
    } catch (error) {
      console.error('Login failed:', error)
      return false
    }
  }

  const register = async (email: string, password: string, name: string, username: string): Promise<boolean> => {
    try {
      const user = await api.register(email, password, name, username)
      setUser(user)
      router.push('/dashboard')
      return true
    } catch (error) {
      console.error('Registration failed:', error)
      return false
    }
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('forseti_token')
    router.push('/')
  }

  const updateProfile = async (data: Partial<User>) => {
    if (!user) return

    try {
      const updatedUser = await api.updateProfile(data)
      setUser(updatedUser)
    } catch (error) {
      console.error('Update profile failed:', error)
      throw error
    }
  }

  const handleOAuthCallback = async (token: string) => {
    // Store the token and fetch the user profile
    localStorage.setItem('forseti_token', token)
    try {
      const profile = await api.getProfile()
      setUser(profile)
    } catch (error) {
      localStorage.removeItem('forseti_token')
      throw error
    }
  }

  return (
    <AuthContext.Provider value={{ user, login, register, logout, updateProfile, handleOAuthCallback, isLoading }}>
      {children}
    </AuthContext.Provider>
  )
}

/**
 * Custom hook to access authentication context
 *
 * Provides access to the current user, auth methods, and loading state.
 * Must be used within a component wrapped by AuthProvider.
 *
 * @hook
 * @returns {AuthContextType} Authentication context value
 * @throws {Error} When used outside of AuthProvider
 *
 * @example
 * function MyComponent() {
 *   const { user, logout, isLoading } = useAuth()
 *
 *   if (isLoading) return <Spinner />
 *   if (!user) return <Redirect to="/" />
 *
 *   return (
 *     <div>
 *       <h1>Hello, {user.name}</h1>
 *       <button onClick={logout}>Sign Out</button>
 *     </div>
 *   )
 * }
 */
export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
