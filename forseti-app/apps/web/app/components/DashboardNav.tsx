'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useRouter, usePathname } from 'next/navigation'
import { Search } from 'lucide-react'
import UserMenu from './UserMenu'
import SearchModal from './SearchModal'
import NotificationsMenu from './NotificationsMenu'

export default function DashboardNav() {
  const router = useRouter()
  const pathname = usePathname()
  const [isSearchOpen, setIsSearchOpen] = useState(false)

  const navItems = [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Coaching', path: '/coaching' },
    { label: 'Challenges', path: '/challenges' },
    { label: 'Leaderboards', path: '/leaderboards' },
  ]

  return (
    <>
      <nav className="bg-forseti-bg-secondary border-b border-forseti-border px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-8">
            <button onClick={() => router.push('/dashboard')} className="relative w-32 h-8">
              <Image
                src="/forseti-logo.png"
                alt="Forseti"
                fill
                className="object-contain"
                priority
              />
            </button>

            {/* Search */}
            <button
              onClick={() => setIsSearchOpen(true)}
              className="p-2 hover:bg-forseti-bg-hover rounded-lg transition-colors"
            >
              <Search className="w-5 h-5 text-forseti-text-secondary" />
            </button>
          </div>

        {/* Navigation Links */}
        <div className="flex items-center gap-6">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              label={item.label}
              active={pathname === item.path}
              onClick={() => router.push(item.path)}
            />
          ))}
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-4">
          <NotificationsMenu />

          {/* User Menu */}
          <UserMenu />
        </div>
      </div>
    </nav>

      {/* Search Modal */}
      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </>
  )
}

function NavLink({ label, active = false, onClick }: { label: string; active?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`text-sm font-medium transition-colors ${
        active ? 'text-forseti-text-primary' : 'text-forseti-text-secondary hover:text-forseti-text-primary'
      }`}
    >
      {label}
    </button>
  )
}
