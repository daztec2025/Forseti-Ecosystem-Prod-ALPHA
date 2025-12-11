'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, User, X, UserPlus, UserCheck } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useSocial } from '../context/SocialContext'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'

interface SearchResult {
  id: string
  name: string
  username?: string
  email: string
  avatar?: string
  type: 'profile' | 'team'
}

interface SearchModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const modalRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const { user } = useAuth()
  const { followUser, unfollowUser, isFollowing, areFriends } = useSocial()

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose])

  useEffect(() => {
    const searchUsers = async () => {
      if (searchQuery.trim().length >= 2) {
        try {
          const users = await api.searchUsers(searchQuery)
          setResults(users.map((user: any) => ({
            ...user,
            type: 'profile' as const
          })))
        } catch (error) {
          console.error('Search failed:', error)
          setResults([])
        }
      } else {
        setResults([])
      }
    }

    searchUsers()
  }, [searchQuery])

  const handleResultClick = (result: SearchResult) => {
    if (result.type === 'profile') {
      if (result.id === user?.id) {
        // Viewing your own profile should go to dashboard
        router.push('/dashboard')
      } else {
        // Prefer username route when available
        router.push(`/user/${result.username || result.id}`)
      }
    }
    onClose()
    setSearchQuery('')
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-20">
      <div
        ref={modalRef}
        className="bg-forseti-bg-card rounded-xl border border-forseti-border w-full max-w-2xl mx-4 overflow-hidden"
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 p-4 border-b border-forseti-border">
          <Search className="w-5 h-5 text-forseti-text-secondary" />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search for profiles, teams..."
            className="flex-1 bg-transparent border-none outline-none text-forseti-text-primary placeholder:text-forseti-text-secondary"
          />
          <button
            onClick={onClose}
            className="p-1 hover:bg-forseti-bg-hover rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-forseti-text-secondary" />
          </button>
        </div>

        {/* Search Results */}
        <div className="max-h-96 overflow-y-auto">
          {searchQuery.trim() === '' ? (
            <div className="p-8 text-center text-forseti-text-secondary">
              <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Start typing to search for profiles and teams</p>
            </div>
          ) : results.length === 0 ? (
            <div className="p-8 text-center text-forseti-text-secondary">
              <p>No results found for "{searchQuery}"</p>
            </div>
          ) : (
            <div className="py-2">
              {results.map((result) => (
                <div
                  key={result.id}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-forseti-bg-hover transition-colors"
                >
                  <button
                    onClick={() => handleResultClick(result)}
                    className="flex items-center gap-3 flex-1 text-left"
                  >
                    <div className="w-10 h-10 bg-forseti-bg-elevated rounded-full flex items-center justify-center overflow-hidden">
                      {result.avatar ? (
                        <img src={result.avatar} alt={result.name} className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-5 h-5 text-forseti-text-secondary" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-forseti-text-primary">{result.name}</p>
                      <p className="text-sm text-forseti-text-secondary">
                        {result.username ? `@${result.username}` : result.email}
                      </p>
                    </div>
                  </button>
                  {user?.id !== result.id && result.type === 'profile' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (isFollowing(result.id)) {
                          unfollowUser(result.id)
                        } else {
                          followUser(result.id, result.name)
                        }
                      }}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        areFriends(result.id)
                          ? 'bg-forseti-lime/20 text-forseti-lime hover:bg-forseti-lime/30'
                          : isFollowing(result.id)
                          ? 'bg-forseti-bg-elevated text-forseti-text-secondary hover:bg-forseti-bg-hover'
                          : 'bg-forseti-lime text-forseti-text-inverse hover:bg-forseti-lime-hover'
                      }`}
                    >
                      {areFriends(result.id) ? (
                        <span className="flex items-center gap-1">
                          <UserCheck className="w-4 h-4" />
                          Friends
                        </span>
                      ) : isFollowing(result.id) ? (
                        'Following'
                      ) : (
                        <span className="flex items-center gap-1">
                          <UserPlus className="w-4 h-4" />
                          Follow
                        </span>
                      )}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
