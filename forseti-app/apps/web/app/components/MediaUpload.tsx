'use client'

import { useState, useRef } from 'react'
import { Upload, X, Image as ImageIcon, Video, AlertCircle } from 'lucide-react'

interface MediaFile {
  file: File
  preview: string
  type: 'image' | 'video'
  duration?: number
}

interface MediaUploadProps {
  files: MediaFile[]
  onChange: (files: MediaFile[]) => void
  maxFiles?: number
  maxVideoSeconds?: number
}

export default function MediaUpload({
  files,
  onChange,
  maxFiles = 5,
  maxVideoSeconds = 30
}: MediaUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const handleFileSelect = async (selectedFiles: FileList | null) => {
    if (!selectedFiles) return
    setError(null)

    const newFiles: MediaFile[] = []
    const remainingSlots = maxFiles - files.length

    if (selectedFiles.length > remainingSlots) {
      setError(`You can only add ${remainingSlots} more file${remainingSlots === 1 ? '' : 's'}`)
      return
    }

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i]

      // Validate file type
      const isImage = file.type.startsWith('image/')
      const isVideo = file.type.startsWith('video/')

      if (!isImage && !isVideo) {
        setError('Invalid file type. Please upload images or videos.')
        continue
      }

      // Validate file size (50MB max)
      if (file.size > 50 * 1024 * 1024) {
        setError('File size must be less than 50MB')
        continue
      }

      // Create preview
      const preview = URL.createObjectURL(file)

      if (isVideo) {
        // Get video duration
        const duration = await getVideoDuration(file)

        if (duration > maxVideoSeconds) {
          setError(`Videos must be ${maxVideoSeconds} seconds or less`)
          URL.revokeObjectURL(preview)
          continue
        }

        newFiles.push({
          file,
          preview,
          type: 'video',
          duration: Math.round(duration)
        })
      } else {
        newFiles.push({
          file,
          preview,
          type: 'image'
        })
      }
    }

    if (newFiles.length > 0) {
      onChange([...files, ...newFiles])
    }
  }

  const getVideoDuration = (file: File): Promise<number> => {
    return new Promise((resolve) => {
      const video = document.createElement('video')
      video.preload = 'metadata'
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(video.src)
        resolve(video.duration)
      }
      video.onerror = () => {
        resolve(0)
      }
      video.src = URL.createObjectURL(file)
    })
  }

  const removeFile = (index: number) => {
    const newFiles = [...files]
    URL.revokeObjectURL(newFiles[index].preview)
    newFiles.splice(index, 1)
    onChange(newFiles)
    setError(null)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    handleFileSelect(e.dataTransfer.files)
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-forseti-text-secondary">
        Media (Optional)
      </label>

      {/* Upload Area */}
      {files.length < maxFiles && (
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
            ${isDragging
              ? 'border-forseti-lime bg-forseti-lime/10'
              : 'border-forseti-border hover:border-forseti-lime/50 hover:bg-forseti-bg-hover'
            }
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,video/mp4,video/quicktime,video/webm"
            multiple
            onChange={(e) => handleFileSelect(e.target.files)}
            className="hidden"
          />
          <Upload className="w-8 h-8 mx-auto mb-2 text-forseti-text-secondary" />
          <p className="text-sm text-forseti-text-secondary">
            Drag & drop or click to upload
          </p>
          <p className="text-xs text-forseti-text-secondary mt-1">
            Images & videos up to {maxVideoSeconds}s • Max {maxFiles} files
          </p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Preview Grid */}
      {files.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {files.map((mediaFile, index) => (
            <div key={index} className="relative group aspect-square">
              {mediaFile.type === 'image' ? (
                <img
                  src={mediaFile.preview}
                  alt={`Upload ${index + 1}`}
                  className="w-full h-full object-cover rounded-lg"
                />
              ) : (
                <div className="relative w-full h-full">
                  <video
                    src={mediaFile.preview}
                    className="w-full h-full object-cover rounded-lg"
                  />
                  <div className="absolute bottom-1 right-1 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                    {mediaFile.duration}s
                  </div>
                  <Video className="absolute top-1 left-1 w-4 h-4 text-white drop-shadow" />
                </div>
              )}

              {/* Remove Button */}
              <button
                onClick={() => removeFile(index)}
                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-4 h-4 text-white" />
              </button>

              {/* Type Icon */}
              {mediaFile.type === 'image' && (
                <ImageIcon className="absolute top-1 left-1 w-4 h-4 text-white drop-shadow" />
              )}
            </div>
          ))}
        </div>
      )}

      {/* File Count */}
      {files.length > 0 && (
        <p className="text-xs text-forseti-text-secondary">
          {files.length} of {maxFiles} files selected
        </p>
      )}
    </div>
  )
}

export type { MediaFile }
