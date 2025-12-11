'use client'

import { useState, useRef, useEffect } from 'react'
import { User } from 'lucide-react'
import { api } from '../lib/api'

interface Friend {
  id: string
  name: string
  username: string
  avatar?: string
}

interface MentionInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit: (mentions: string[]) => void
  placeholder?: string
  className?: string
}

export default function MentionInput({
  value,
  onChange,
  onSubmit,
  placeholder = 'Write a comment...',
  className = '',
}: MentionInputProps) {
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestions, setSuggestions] = useState<Friend[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [mentionQuery, setMentionQuery] = useState('')
  const [cursorPosition, setCursorPosition] = useState(0)
  const [mentionedUsers, setMentionedUsers] = useState<Map<string, string>>(new Map()) // username -> userId
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)
  const [allFriends, setAllFriends] = useState<Friend[]>([])

  // Parse mentions from text
  const parseMentions = (text: string): string[] => {
    const mentionRegex = /@(\w+)/g
    const matches = text.matchAll(mentionRegex)
    return Array.from(matches, match => (match[1] as string)).filter(Boolean)
  }

  // Fetch all friends on mount for mapping
  useEffect(() => {
    const fetchAllFriends = async () => {
      try {
        const friends = await api.getFriends()
        setAllFriends(friends)
      } catch (error) {
        console.error('Failed to fetch all friends:', error)
      }
    }
    fetchAllFriends()
  }, [])

  // Fetch friends for suggestions
  useEffect(() => {
    const fetchFriends = async () => {
      if (mentionQuery.length > 0) {
        try {
          const friends = await api.getFriends(mentionQuery)
          setSuggestions(friends)
        } catch (error) {
          console.error('Failed to fetch friends:', error)
          setSuggestions([])
        }
      } else {
        setSuggestions([])
      }
    }

    fetchFriends()
  }, [mentionQuery])

  // Handle input change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    const newCursorPosition = e.target.selectionStart || 0

    onChange(newValue)
    setCursorPosition(newCursorPosition)

    // Check if we're typing a mention
    const textBeforeCursor = newValue.slice(0, newCursorPosition)
    const lastAtSymbol = textBeforeCursor.lastIndexOf('@')

    if (lastAtSymbol !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAtSymbol + 1)
      // Check if there's a space after the @, if so, don't show suggestions
      if (!textAfterAt.includes(' ')) {
        setMentionQuery(textAfterAt)
        setShowSuggestions(true)
        setSelectedIndex(0)
      } else {
        setShowSuggestions(false)
      }
    } else {
      setShowSuggestions(false)
    }
  }

  // Handle suggestion selection
  const selectSuggestion = (friend: Friend) => {
    const textBeforeCursor = value.slice(0, cursorPosition)
    const textAfterCursor = value.slice(cursorPosition)
    const lastAtSymbol = textBeforeCursor.lastIndexOf('@')

    if (lastAtSymbol !== -1) {
      const beforeAt = value.slice(0, lastAtSymbol)
      const newValue = `${beforeAt}@${friend.username} ${textAfterCursor}`
      onChange(newValue)

      // Track this mention
      setMentionedUsers(prev => {
        const newMap = new Map(prev)
        newMap.set(friend.username, friend.id)
        return newMap
      })
    }

    setShowSuggestions(false)
    setMentionQuery('')
    inputRef.current?.focus()
  }

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (showSuggestions && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev + 1) % suggestions.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (suggestions[selectedIndex]) selectSuggestion(suggestions[selectedIndex])
      } else if (e.key === 'Escape') {
        setShowSuggestions(false)
      }
      } else if (e.key === 'Enter') {
      e.preventDefault()
      const mentionedUsernames = parseMentions(value)

      // Convert usernames to user IDs using our tracked mentions and all friends
      const mentionedUserIds: string[] = []
        mentionedUsernames.forEach(username => {
        // First check tracked mentions
        if (mentionedUsers.has(username)) {
          mentionedUserIds.push(mentionedUsers.get(username)!)
        } else {
          // Fall back to all friends list
          const friend = allFriends.find(f => f.username === username)
          if (friend) {
            mentionedUserIds.push(friend.id)
          }
        }
      })

      onSubmit(mentionedUserIds)
    }
  }

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative w-full">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
      />

      {/* Mentions Suggestions Dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute bottom-full left-0 mb-2 w-72 bg-forseti-bg-card rounded-lg border border-forseti-border shadow-lg overflow-hidden z-50"
        >
          <div className="p-2 border-b border-forseti-border">
            <p className="text-xs text-forseti-text-secondary">Mention a friend</p>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {suggestions.map((friend, index) => (
              <button
                key={friend.id}
                onClick={() => selectSuggestion(friend)}
                className={`w-full px-3 py-2 flex items-center gap-3 hover:bg-forseti-bg-hover transition-colors ${
                  index === selectedIndex ? 'bg-forseti-bg-hover' : ''
                }`}
              >
                <div className="w-8 h-8 bg-forseti-bg-elevated rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
                  {friend.avatar ? (
                    <img src={friend.avatar} alt={friend.name} className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-4 h-4 text-forseti-text-secondary" />
                  )}
                </div>
                <div className="flex-1 text-left">
                  <p className="font-semibold text-sm text-forseti-text-primary">{friend.name}</p>
                  <p className="text-xs text-forseti-text-secondary">@{friend.username}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
