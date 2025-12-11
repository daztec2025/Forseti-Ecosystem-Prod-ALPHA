'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight, X, Play, Video } from 'lucide-react'
import { ActivityMedia } from '../types/api'

interface MediaGalleryProps {
  media: ActivityMedia[]
  apiUrl?: string
  layout?: 'carousel' | 'grid'
}

export default function MediaGallery({ media, apiUrl, layout = 'carousel' }: MediaGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showLightbox, setShowLightbox] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)

  // Use environment variable or fallback to localhost
  const baseUrl = apiUrl || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

  if (!media || media.length === 0) return null

  const getMediaUrl = (item: ActivityMedia) => {
    // If item.url exists and is a relative path, prepend the API URL
    if (item.url) {
      // Check if it's already an absolute URL
      if (item.url.startsWith('http://') || item.url.startsWith('https://')) {
        return item.url
      }
      // It's a relative URL, prepend the base URL
      return `${baseUrl}${item.url}`
    }
    // Fallback to constructing URL from filename
    return `${baseUrl}/uploads/media/${item.filename}`
  }

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation()
    setCurrentIndex((prev) => (prev === 0 ? media.length - 1 : prev - 1))
    setIsPlaying(false)
  }

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation()
    setCurrentIndex((prev) => (prev === media.length - 1 ? 0 : prev + 1))
    setIsPlaying(false)
  }

  const currentMedia = media[currentIndex]

  // Grid layout - smaller thumbnails
  if (layout === 'grid') {
    return (
      <>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-4">
          {media.map((item, index) => (
            <button
              key={item.id || index}
              onClick={() => {
                setCurrentIndex(index)
                setShowLightbox(true)
              }}
              className="relative aspect-square rounded-lg overflow-hidden bg-forseti-bg-elevated hover:opacity-80 transition-opacity"
            >
              {item.type === 'image' ? (
                <img
                  src={getMediaUrl(item)}
                  alt="Activity media"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="relative w-full h-full">
                  <video
                    src={getMediaUrl(item)}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <div className="w-8 h-8 bg-white/90 rounded-full flex items-center justify-center">
                      <Play className="w-4 h-4 text-forseti-bg-primary ml-0.5" />
                    </div>
                  </div>
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Lightbox Modal */}
        {showLightbox && (
          <div
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
            onClick={() => {
              setShowLightbox(false)
              setIsPlaying(false)
            }}
          >
            {/* Close Button */}
            <button
              onClick={() => {
                setShowLightbox(false)
                setIsPlaying(false)
              }}
              className="absolute top-4 right-4 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors"
            >
              <X className="w-6 h-6 text-white" />
            </button>

            {/* Media Content */}
            <div
              className="max-w-4xl max-h-[90vh] w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              {currentMedia.type === 'image' ? (
                <img
                  src={getMediaUrl(currentMedia)}
                  alt="Activity media"
                  className="w-full h-full object-contain"
                />
              ) : (
                <video
                  src={getMediaUrl(currentMedia)}
                  className="w-full h-full object-contain"
                  controls
                  autoPlay
                />
              )}
            </div>

            {/* Navigation Arrows (if multiple media) */}
            {media.length > 1 && (
              <>
                <button
                  onClick={handlePrev}
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors"
                >
                  <ChevronLeft className="w-6 h-6 text-white" />
                </button>
                <button
                  onClick={handleNext}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors"
                >
                  <ChevronRight className="w-6 h-6 text-white" />
                </button>
              </>
            )}

            {/* Counter */}
            {media.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white px-4 py-2 rounded-full text-sm">
                {currentIndex + 1} / {media.length}
              </div>
            )}
          </div>
        )}
      </>
    )
  }

  // Carousel layout (default)
  return (
    <>
      {/* Gallery Preview */}
      <div className="relative mb-4 rounded-lg overflow-hidden bg-forseti-bg-elevated">
        {/* Main Media Display */}
        <div
          className="aspect-video cursor-pointer"
          onClick={() => setShowLightbox(true)}
        >
          {currentMedia.type === 'image' ? (
            <img
              src={getMediaUrl(currentMedia)}
              alt="Activity media"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="relative w-full h-full">
              <video
                src={getMediaUrl(currentMedia)}
                className="w-full h-full object-cover"
                controls={false}
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <div className="w-16 h-16 bg-white/90 rounded-full flex items-center justify-center">
                  <Play className="w-8 h-8 text-forseti-bg-primary ml-1" />
                </div>
              </div>
              {currentMedia.duration && (
                <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                  {currentMedia.duration}s
                </div>
              )}
            </div>
          )}
        </div>

        {/* Navigation Arrows (if multiple media) */}
        {media.length > 1 && (
          <>
            <button
              onClick={handlePrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-white" />
            </button>
            <button
              onClick={handleNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-white" />
            </button>
          </>
        )}

        {/* Dots Indicator */}
        {media.length > 1 && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
            {media.map((_, index) => (
              <button
                key={index}
                onClick={(e) => {
                  e.stopPropagation()
                  setCurrentIndex(index)
                  setIsPlaying(false)
                }}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index === currentIndex ? 'bg-white' : 'bg-white/50'
                }`}
              />
            ))}
          </div>
        )}

        {/* Media Type Indicator */}
        <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/50 px-2 py-1 rounded text-xs text-white">
          {currentMedia.type === 'video' ? (
            <Video className="w-3 h-3" />
          ) : null}
          {media.length > 1 && `${currentIndex + 1}/${media.length}`}
        </div>
      </div>

      {/* Lightbox Modal */}
      {showLightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => {
            setShowLightbox(false)
            setIsPlaying(false)
          }}
        >
          {/* Close Button */}
          <button
            onClick={() => {
              setShowLightbox(false)
              setIsPlaying(false)
            }}
            className="absolute top-4 right-4 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors"
          >
            <X className="w-6 h-6 text-white" />
          </button>

          {/* Media Content */}
          <div
            className="max-w-4xl max-h-[90vh] w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            {currentMedia.type === 'image' ? (
              <img
                src={getMediaUrl(currentMedia)}
                alt="Activity media"
                className="w-full h-full object-contain"
              />
            ) : (
              <video
                src={getMediaUrl(currentMedia)}
                className="w-full h-full object-contain"
                controls
                autoPlay
              />
            )}
          </div>

          {/* Navigation Arrows (if multiple media) */}
          {media.length > 1 && (
            <>
              <button
                onClick={handlePrev}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors"
              >
                <ChevronLeft className="w-6 h-6 text-white" />
              </button>
              <button
                onClick={handleNext}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors"
              >
                <ChevronRight className="w-6 h-6 text-white" />
              </button>
            </>
          )}

          {/* Counter */}
          {media.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/50 text-white px-4 py-2 rounded-full text-sm">
              {currentIndex + 1} / {media.length}
            </div>
          )}
        </div>
      )}
    </>
  )
}
