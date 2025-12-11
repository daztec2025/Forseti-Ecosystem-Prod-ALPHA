'use client'

import { useState, useRef, useEffect } from 'react'
import { User, Settings, LogOut, UserCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useRouter } from 'next/navigation'

export default function UserMenu() {
  const [isOpen, setIsOpen] = useState(false)
  const { user, logout } = useAuth()
  const menuRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleViewProfile = () => {
    setIsOpen(false)
    router.push('/profile')
  }

  const handleEditProfile = () => {
    setIsOpen(false)
    router.push('/profile/edit')
  }

  const handleLogout = () => {
    setIsOpen(false)
    logout()
  }

  return (
    <div className="relative" ref={menuRef}>
      {/* Profile Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 hover:bg-forseti-bg-hover rounded-full transition-colors"
      >
        <div className="w-8 h-8 bg-forseti-bg-elevated rounded-full flex items-center justify-center overflow-hidden">
          {user?.avatar ? (
            <img src={user.avatar} alt="Profile" className="w-full h-full object-cover" />
          ) : (
            <User className="w-5 h-5 text-forseti-text-secondary" />
          )}
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-forseti-bg-card rounded-lg border border-forseti-border shadow-lg overflow-hidden z-50">
          {/* User Info */}
          <div className="p-4 border-b border-forseti-border">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-forseti-bg-elevated rounded-full flex items-center justify-center overflow-hidden">
                {user?.avatar ? (
                  <img src={user.avatar} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-6 h-6 text-forseti-text-secondary" />
                )}
              </div>
              <div>
                <p className="font-semibold text-forseti-text-primary">{user?.name}</p>
                <p className="text-sm text-forseti-text-secondary">{user?.email}</p>
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <div className="py-2">
            <button
              onClick={handleViewProfile}
              className="w-full px-4 py-3 flex items-center gap-3 hover:bg-forseti-bg-hover transition-colors text-left"
            >
              <UserCircle className="w-5 h-5 text-forseti-text-secondary" />
              <span className="text-sm">View Profile</span>
            </button>

            <button
              onClick={handleEditProfile}
              className="w-full px-4 py-3 flex items-center gap-3 hover:bg-forseti-bg-hover transition-colors text-left"
            >
              <Settings className="w-5 h-5 text-forseti-text-secondary" />
              <span className="text-sm">Edit Profile</span>
            </button>
          </div>

          {/* Logout */}
          <div className="border-t border-forseti-border py-2">
            <button
              onClick={handleLogout}
              className="w-full px-4 py-3 flex items-center gap-3 hover:bg-forseti-bg-hover transition-colors text-left text-forseti-error"
            >
              <LogOut className="w-5 h-5" />
              <span className="text-sm">Logout</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
