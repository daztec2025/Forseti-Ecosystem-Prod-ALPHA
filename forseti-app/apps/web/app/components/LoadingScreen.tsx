'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'

interface LoadingScreenProps {
  duration?: number
}

export default function LoadingScreen({ duration = 2000 }: LoadingScreenProps) {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false)
    }, duration)

    return () => clearTimeout(timer)
  }, [duration])

  if (!isVisible) return null

  return (
    <div className="fixed inset-0 bg-forseti-bg-primary z-[100] flex flex-col items-center justify-center">
      {/* Logo */}
      <div className="relative w-64 h-16 mb-8 animate-pulse">
        <Image
          src="/forseti-logo.png"
          alt="Forseti"
          fill
          className="object-contain"
          priority
        />
      </div>

      {/* Slogan */}
      <p className="text-xl text-forseti-lime font-light mb-8">
        Changing the race, one lap at a time
      </p>

      {/* Loading Bar */}
      <div className="w-64 h-1 bg-forseti-bg-elevated rounded-full overflow-hidden">
        <div
          className="h-full bg-forseti-lime rounded-full"
          style={{
            animation: 'loading-bar 1.5s ease-in-out infinite'
          }}
        />
      </div>

      <style jsx>{`
        @keyframes loading-bar {
          0% {
            width: 0%;
            margin-left: 0%;
          }
          50% {
            width: 50%;
            margin-left: 25%;
          }
          100% {
            width: 0%;
            margin-left: 100%;
          }
        }
      `}</style>
    </div>
  )
}
