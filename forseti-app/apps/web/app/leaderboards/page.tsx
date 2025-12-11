'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import ProtectedRoute from '../components/ProtectedRoute'
import DashboardNav from '../components/DashboardNav'
import { useAuth } from '../context/AuthContext'
import { api } from '../lib/api'
import { LeaderboardEntry } from '../types/api'
import { User, Trophy, Clock, Activity, Star } from 'lucide-react'

export default function LeaderboardsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const data = await api.getLeaderboard()
        setLeaderboard(data)
      } catch (err: any) {
        console.error('Failed to fetch leaderboard:', err)
        setError(err.message || 'Failed to load leaderboard')
      } finally {
        setLoading(false)
      }
    }

    fetchLeaderboard()
  }, [])

  const getRankStyle = (rank: number) => {
    switch (rank) {
      case 1:
        return 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30'
      case 2:
        return 'bg-gray-300/20 text-gray-300 border-gray-300/30'
      case 3:
        return 'bg-amber-600/20 text-amber-600 border-amber-600/30'
      default:
        return 'bg-forseti-bg-elevated text-forseti-text-secondary border-forseti-border'
    }
  }

  const getRankIcon = (rank: number) => {
    if (rank <= 3) {
      return <Trophy className={`w-4 h-4 ${rank === 1 ? 'text-yellow-500' : rank === 2 ? 'text-gray-300' : 'text-amber-600'}`} />
    }
    return null
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-forseti-bg-primary">
        <DashboardNav />

        <div className="max-w-7xl mx-auto p-6">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Leaderboards</h1>
            <p className="text-forseti-text-secondary">
              Top 10 drivers ranked by combined score (activities, practice hours, and performance)
            </p>
          </div>

          {/* Leaderboard Content */}
          <div className="bg-forseti-bg-card rounded-xl border border-forseti-border overflow-hidden">
            {loading ? (
              <div className="p-12 text-center">
                <div className="animate-spin w-8 h-8 border-2 border-forseti-lime border-t-transparent rounded-full mx-auto mb-4" />
                <p className="text-forseti-text-secondary">Loading leaderboard...</p>
              </div>
            ) : error ? (
              <div className="p-12 text-center">
                <p className="text-red-500 mb-2">Error loading leaderboard</p>
                <p className="text-forseti-text-secondary text-sm">{error}</p>
              </div>
            ) : leaderboard.length === 0 ? (
              <div className="p-12 text-center">
                <Trophy className="w-12 h-12 text-forseti-text-secondary mx-auto mb-4 opacity-50" />
                <p className="text-forseti-text-secondary">
                  No drivers on the leaderboard yet. Start logging activities to appear here!
                </p>
              </div>
            ) : (
              <>
                {/* Table Header */}
                <div className="grid grid-cols-12 gap-2 px-6 py-4 border-b border-forseti-border bg-forseti-bg-elevated text-sm font-medium text-forseti-text-secondary">
                  <div className="col-span-1">Rank</div>
                  <div className="col-span-4">Driver</div>
                  <div className="col-span-2 text-center">Activities</div>
                  <div className="col-span-2 text-center">Hours</div>
                  <div className="col-span-1 text-center">Perf</div>
                  <div className="col-span-2 text-center">Score</div>
                </div>

                {/* Leaderboard Rows */}
                {leaderboard.map((entry, index) => {
                  const rank = index + 1
                  return (
                    <button
                      key={entry.id}
                      onClick={() => {
                        // Don't navigate if clicking own profile
                        if (entry.id === user?.id) return
                        router.push(`/user/${entry.username}`)
                      }}
                      className={`w-full grid grid-cols-12 gap-2 px-6 py-4 border-b border-forseti-border last:border-b-0 transition-colors text-left ${
                        entry.id === user?.id ? 'cursor-default' : 'hover:bg-forseti-bg-hover cursor-pointer'
                      }`}
                    >
                      {/* Rank */}
                      <div className="col-span-1 flex items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center border ${getRankStyle(rank)}`}>
                          {getRankIcon(rank) || <span className="text-sm font-bold">{rank}</span>}
                        </div>
                      </div>

                      {/* Driver Info */}
                      <div className="col-span-4 flex items-center gap-3">
                        {/* Avatar with Rank Ring */}
                        <div className={`w-14 h-14 rounded-full flex-shrink-0 overflow-hidden border-2 ${
                          rank === 1 ? 'border-yellow-500' :
                          rank === 2 ? 'border-gray-300' :
                          rank === 3 ? 'border-amber-600' :
                          'border-forseti-border'
                        }`}>
                          {entry.avatar ? (
                            <img src={entry.avatar} alt={entry.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-forseti-bg-elevated flex items-center justify-center">
                              <User className="w-6 h-6 text-forseti-text-secondary" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold truncate">{entry.name}</span>
                            {entry.isPro && (
                              <span className="bg-forseti-lime/20 text-forseti-lime text-xs px-1.5 py-0.5 rounded font-medium">
                                PRO
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-forseti-text-secondary truncate">@{entry.username}</span>
                            <img
                              src={`/assets/level-badges/${entry.engagementLevel.charAt(0).toUpperCase() + entry.engagementLevel.slice(1)}.png`}
                              alt={`${entry.engagementLevel} rank`}
                              className="w-5 h-5 object-contain"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Activities */}
                      <div className="col-span-2 flex items-center justify-center gap-1.5">
                        <Activity className="w-4 h-4 text-forseti-text-secondary" />
                        <span className="font-medium">{entry.stats.activities}</span>
                      </div>

                      {/* Hours */}
                      <div className="col-span-2 flex items-center justify-center gap-1.5">
                        <Clock className="w-4 h-4 text-forseti-text-secondary" />
                        <span className="font-medium">{entry.stats.hours}h</span>
                      </div>

                      {/* Average Performance */}
                      <div className="col-span-1 flex items-center justify-center">
                        <span className="font-medium">{entry.stats.avgPerformance}%</span>
                      </div>

                      {/* Combined Score */}
                      <div className="col-span-2 flex items-center justify-center">
                        <div className="flex items-center gap-1.5 bg-forseti-lime/10 px-3 py-1.5 rounded-full">
                          <Star className="w-4 h-4 text-forseti-lime" />
                          <span className="font-bold text-forseti-lime">{entry.stats.combinedScore}</span>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </>
            )}
          </div>

          {/* Score Explanation */}
          <div className="mt-6 p-4 bg-forseti-bg-card rounded-lg border border-forseti-border">
            <h3 className="font-semibold mb-2 text-sm">How the score is calculated</h3>
            <p className="text-forseti-text-secondary text-sm">
              Combined score = 30% activity count (normalized) + 30% practice hours (normalized) + 40% average performance
            </p>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}
