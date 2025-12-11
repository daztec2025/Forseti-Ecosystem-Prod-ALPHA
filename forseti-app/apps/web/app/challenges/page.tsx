'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ProtectedRoute from '../components/ProtectedRoute'
import DashboardNav from '../components/DashboardNav'
import { Trophy, Users, Clock, Star, ChevronRight, Zap, Target, Medal, Flag, User, Crown } from 'lucide-react'

// Mock featured challenge
const featuredChallenge = {
  id: 'featured-1',
  title: 'Founding Drivers Championship',
  description: 'Complete all 5 Founding Driver challenges to earn the exclusive Founding Member badge and prove you can compete with the best in sim racing.',
  participants: 2847,
  reward: '1000 XP + Founding Member Badge',
  endsIn: '30 days',
  difficulty: 'Expert'
}

// Driver challenges
const driverChallenges = [
  {
    id: 'driver-1',
    title: 'Gus Burton Challenge',
    description: "Beat Gus's time around Imola, Silverstone GP & Barcelona GP in the Porsche 911 Cup Car",
    driverName: 'Gus Burton',
    icon: Crown,
    participants: 1247,
    reward: '100 XP',
    difficulty: 'Hard',
    progress: 0,
    color: 'from-yellow-500 to-amber-600',
    isDriverChallenge: true
  },
  {
    id: 'driver-2',
    title: 'James Baldwin Challenge',
    description: "Match James's lap times at Spa, Monza & Brands Hatch in the McLaren 720S GT3",
    driverName: 'James Baldwin',
    icon: Crown,
    participants: 983,
    reward: '100 XP',
    difficulty: 'Hard',
    progress: 0,
    color: 'from-blue-500 to-indigo-600',
    isDriverChallenge: true
  },
  {
    id: 'driver-3',
    title: 'Cameron Das Challenge',
    description: "Beat Cameron's benchmark times at COTA, Road America & Watkins Glen in the Formula 3 car",
    driverName: 'Cameron Das',
    icon: Crown,
    participants: 756,
    reward: '100 XP',
    difficulty: 'Hard',
    progress: 0,
    color: 'from-red-500 to-rose-600',
    isDriverChallenge: true
  },
  {
    id: 'driver-4',
    title: 'SuperGT Challenge',
    description: "Complete Steve's Nurburgring Nordschleife challenge - survive 3 consecutive clean laps under 7:30",
    driverName: 'Steve Alvarez-Brown',
    icon: Crown,
    participants: 423,
    reward: '150 XP',
    difficulty: 'Expert',
    progress: 0,
    color: 'from-purple-500 to-violet-600',
    isDriverChallenge: true
  },
  {
    id: 'driver-5',
    title: 'Founding Drivers Gauntlet',
    description: 'Complete all 4 driver challenges within 30 days to prove your worth',
    driverName: 'All Founding Drivers',
    icon: Trophy,
    participants: 189,
    reward: '500 XP + Badge',
    difficulty: 'Expert',
    progress: 0,
    color: 'from-forseti-lime to-green-500',
    isDriverChallenge: true
  }
]

// Generic challenges
const genericChallenges = [
  {
    id: 'generic-1',
    title: 'Consistency King',
    description: 'Post 5 activities with 90%+ performance rating in a row',
    icon: Target,
    participants: 342,
    reward: '200 XP',
    difficulty: 'Medium',
    progress: 60,
    color: 'from-cyan-500 to-teal-500',
    isDriverChallenge: false
  },
  {
    id: 'generic-2',
    title: 'Track Master',
    description: 'Complete activities on 10 different tracks',
    icon: Flag,
    participants: 521,
    reward: '300 XP',
    difficulty: 'Medium',
    progress: 30,
    color: 'from-pink-500 to-fuchsia-500',
    isDriverChallenge: false
  },
  {
    id: 'generic-3',
    title: 'Speed Demon',
    description: 'Set a personal best lap time on any track',
    icon: Zap,
    participants: 892,
    reward: '150 XP',
    difficulty: 'Easy',
    progress: 0,
    color: 'from-orange-500 to-red-500',
    isDriverChallenge: false
  },
  {
    id: 'generic-4',
    title: 'Marathon Driver',
    description: 'Log 100 hours of total practice time',
    icon: Clock,
    participants: 156,
    reward: '500 XP',
    difficulty: 'Hard',
    progress: 45,
    color: 'from-emerald-500 to-green-600',
    isDriverChallenge: false
  }
]

const allChallenges = [...driverChallenges, ...genericChallenges]

const getDifficultyColor = (difficulty: string) => {
  switch (difficulty) {
    case 'Easy':
      return 'text-green-400 bg-green-400/10'
    case 'Medium':
      return 'text-yellow-400 bg-yellow-400/10'
    case 'Hard':
      return 'text-orange-400 bg-orange-400/10'
    case 'Expert':
      return 'text-red-400 bg-red-400/10'
    default:
      return 'text-forseti-text-secondary bg-forseti-bg-elevated'
  }
}

export default function ChallengesPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('challenges')

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-forseti-bg-primary">
        <DashboardNav />

        <div className="max-w-7xl mx-auto p-6">
          {/* Hero Banner */}
          <div className="relative rounded-2xl overflow-hidden mb-8 border border-forseti-lime/30">
            {/* Background Image */}
            <div className="absolute inset-0">
              <img
                src="/assets/challenges_banner.png"
                alt=""
                className="w-full h-full object-cover"
              />
              {/* Dark overlay for text readability */}
              <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-black/30" />
            </div>

            <div className="relative p-8 md:p-12">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-forseti-lime text-sm font-semibold flex items-center gap-1.5">
                    <Crown className="w-3.5 h-3.5" />
                    Featured Challenge
                  </span>
                  <span className={`text-sm font-medium ${featuredChallenge.difficulty === 'Expert' ? 'text-red-400' : 'text-forseti-text-secondary'}`}>
                    {featuredChallenge.difficulty}
                  </span>
                </div>

                <h1 className="text-3xl md:text-4xl font-bold mb-3">
                  {featuredChallenge.title}
                </h1>

                <p className="text-forseti-text-secondary text-lg mb-6 max-w-2xl">
                  {featuredChallenge.description}
                </p>

                <div className="flex flex-wrap items-center gap-4 mb-6">
                  <div className="flex items-center gap-2 text-forseti-text-secondary">
                    <Users className="w-4 h-4" />
                    <span>{featuredChallenge.participants.toLocaleString()} participants</span>
                  </div>
                  <div className="flex items-center gap-2 text-forseti-text-secondary">
                    <Clock className="w-4 h-4" />
                    <span>Ends in {featuredChallenge.endsIn}</span>
                  </div>
                  <div className="flex items-center gap-2 text-forseti-lime">
                    <Star className="w-4 h-4" />
                    <span className="font-semibold">{featuredChallenge.reward}</span>
                  </div>
                </div>

                <button className="px-6 py-3 bg-forseti-lime text-forseti-text-inverse font-semibold rounded-lg hover:bg-forseti-lime-hover transition-colors flex items-center gap-2">
                  Join Championship
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center gap-2 mb-6 border-b border-forseti-border">
            <button
              onClick={() => setActiveTab('challenges')}
              className={`px-4 py-3 font-medium transition-colors relative ${
                activeTab === 'challenges'
                  ? 'text-forseti-lime'
                  : 'text-forseti-text-secondary hover:text-white'
              }`}
            >
              Active Challenges
              {activeTab === 'challenges' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-forseti-lime" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              className={`px-4 py-3 font-medium transition-colors relative ${
                activeTab === 'completed'
                  ? 'text-forseti-lime'
                  : 'text-forseti-text-secondary hover:text-white'
              }`}
            >
              Completed
              {activeTab === 'completed' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-forseti-lime" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('upcoming')}
              className={`px-4 py-3 font-medium transition-colors relative ${
                activeTab === 'upcoming'
                  ? 'text-forseti-lime'
                  : 'text-forseti-text-secondary hover:text-white'
              }`}
            >
              Upcoming
              {activeTab === 'upcoming' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-forseti-lime" />
              )}
            </button>
          </div>

          {activeTab === 'challenges' && (
            <>
              {/* Driver Challenges Section */}
              <div className="mb-8">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Crown className="w-5 h-5 text-forseti-lime" />
                  Founding Driver Challenges
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {driverChallenges.map((challenge) => {
                    const Icon = challenge.icon
                    return (
                      <div
                        key={challenge.id}
                        className="bg-forseti-bg-card rounded-xl border border-forseti-lime/30 overflow-hidden hover:border-forseti-lime/60 transition-colors group cursor-pointer"
                      >
                        {/* Card Header with Gradient */}
                        <div className={`h-2 bg-gradient-to-r ${challenge.color}`} />

                        <div className="p-6">
                          {/* Icon and Difficulty */}
                          <div className="flex items-start justify-between mb-4">
                            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${challenge.color} flex items-center justify-center`}>
                              <Icon className="w-6 h-6 text-white" />
                            </div>
                            <span className={`px-2 py-1 text-xs font-medium rounded ${getDifficultyColor(challenge.difficulty)}`}>
                              {challenge.difficulty}
                            </span>
                          </div>

                          {/* Title and Description */}
                          <h3 className="text-lg font-bold mb-1 group-hover:text-forseti-lime transition-colors">
                            {challenge.title}
                          </h3>
                          <p className="text-forseti-text-secondary text-xs mb-3">
                            by {challenge.driverName}
                          </p>
                          <p className="text-forseti-text-secondary text-sm mb-4 line-clamp-2">
                            {challenge.description}
                          </p>

                          {/* Progress Bar */}
                          {challenge.progress > 0 && (
                            <div className="mb-4">
                              <div className="flex items-center justify-between text-xs mb-1">
                                <span className="text-forseti-text-secondary">Progress</span>
                                <span className="text-forseti-lime font-medium">{challenge.progress}%</span>
                              </div>
                              <div className="h-1.5 bg-forseti-bg-elevated rounded-full overflow-hidden">
                                <div
                                  className={`h-full bg-gradient-to-r ${challenge.color} rounded-full transition-all`}
                                  style={{ width: `${challenge.progress}%` }}
                                />
                              </div>
                            </div>
                          )}

                          {/* Stats */}
                          <div className="flex items-center justify-between pt-4 border-t border-forseti-border">
                            <div className="flex items-center gap-1.5 text-forseti-text-secondary text-sm">
                              <Users className="w-4 h-4" />
                              <span>{challenge.participants}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-forseti-lime text-sm font-medium">
                              <Star className="w-4 h-4" />
                              <span>{challenge.reward}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Generic Challenges Section */}
              <div>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Target className="w-5 h-5 text-forseti-text-secondary" />
                  Community Challenges
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {genericChallenges.map((challenge) => {
                    const Icon = challenge.icon
                    return (
                      <div
                        key={challenge.id}
                        className="bg-forseti-bg-card rounded-xl border border-forseti-border overflow-hidden hover:border-forseti-lime/50 transition-colors group cursor-pointer"
                      >
                        {/* Card Header with Gradient */}
                        <div className={`h-2 bg-gradient-to-r ${challenge.color}`} />

                        <div className="p-6">
                          {/* Icon and Difficulty */}
                          <div className="flex items-start justify-between mb-4">
                            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${challenge.color} flex items-center justify-center`}>
                              <Icon className="w-6 h-6 text-white" />
                            </div>
                            <span className={`px-2 py-1 text-xs font-medium rounded ${getDifficultyColor(challenge.difficulty)}`}>
                              {challenge.difficulty}
                            </span>
                          </div>

                          {/* Title and Description */}
                          <h3 className="text-lg font-bold mb-2 group-hover:text-forseti-lime transition-colors">
                            {challenge.title}
                          </h3>
                          <p className="text-forseti-text-secondary text-sm mb-4 line-clamp-2">
                            {challenge.description}
                          </p>

                          {/* Progress Bar */}
                          {challenge.progress > 0 && (
                            <div className="mb-4">
                              <div className="flex items-center justify-between text-xs mb-1">
                                <span className="text-forseti-text-secondary">Progress</span>
                                <span className="text-forseti-lime font-medium">{challenge.progress}%</span>
                              </div>
                              <div className="h-1.5 bg-forseti-bg-elevated rounded-full overflow-hidden">
                                <div
                                  className={`h-full bg-gradient-to-r ${challenge.color} rounded-full transition-all`}
                                  style={{ width: `${challenge.progress}%` }}
                                />
                              </div>
                            </div>
                          )}

                          {/* Stats */}
                          <div className="flex items-center justify-between pt-4 border-t border-forseti-border">
                            <div className="flex items-center gap-1.5 text-forseti-text-secondary text-sm">
                              <Users className="w-4 h-4" />
                              <span>{challenge.participants}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-forseti-lime text-sm font-medium">
                              <Star className="w-4 h-4" />
                              <span>{challenge.reward}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}

          {/* Empty State for other tabs */}
          {activeTab !== 'challenges' && (
            <div className="text-center py-12">
              <Trophy className="w-12 h-12 text-forseti-text-secondary mx-auto mb-4 opacity-50" />
              <p className="text-forseti-text-secondary">
                {activeTab === 'completed'
                  ? 'No completed challenges yet. Keep working on your goals!'
                  : 'New challenges coming soon. Stay tuned!'}
              </p>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  )
}
