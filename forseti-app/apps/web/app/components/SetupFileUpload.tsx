'use client'

import { useState, useRef } from 'react'
import { Upload, X, FileText, AlertCircle } from 'lucide-react'

export interface SetupFile {
  file: File
  name: string
}

interface SetupFileUploadProps {
  file: SetupFile | null
  onChange: (file: SetupFile | null) => void
}

// Accepted file extensions for sim racing setups
const ACCEPTED_EXTENSIONS = [
  '.sto',    // iRacing
  '.json',   // ACC, various sims
  '.ini',    // Various sims
  '.svm',    // rFactor 2
  '.veh',    // Vehicle files
  '.garage', // ACC garage files
]

export default function SetupFileUpload({
  file,
  onChange,
}: SetupFileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const validateFile = (selectedFile: File): boolean => {
    setError(null)

    // Check file extension
    const fileName = selectedFile.name.toLowerCase()
    const hasValidExtension = ACCEPTED_EXTENSIONS.some(ext => fileName.endsWith(ext))

    if (!hasValidExtension) {
      setError(`Invalid file type. Accepted: ${ACCEPTED_EXTENSIONS.join(', ')}`)
      return false
    }

    // Check file size (5MB max for setup files)
    if (selectedFile.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB')
      return false
    }

    return true
  }

  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return

    const selectedFile = files[0]

    if (validateFile(selectedFile)) {
      onChange({
        file: selectedFile,
        name: selectedFile.name
      })
    }
  }

  const removeFile = () => {
    onChange(null)
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
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
      <label className="block text-lg font-semibold">
        Car Setup File <span className="text-sm text-forseti-text-secondary font-normal">(optional)</span>
      </label>

      {!file ? (
        // Upload Area
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors
            ${isDragging
              ? 'border-forseti-lime bg-forseti-lime/10'
              : 'border-forseti-border hover:border-forseti-lime/50 hover:bg-forseti-bg-hover'
            }
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_EXTENSIONS.join(',')}
            onChange={(e) => handleFileSelect(e.target.files)}
            className="hidden"
          />
          <Upload className="w-6 h-6 mx-auto mb-2 text-forseti-text-secondary" />
          <p className="text-sm text-forseti-text-secondary">
            Drag & drop or click to upload
          </p>
          <p className="text-xs text-forseti-text-secondary mt-1">
            iRacing (.sto), ACC (.json), or other sim setup files
          </p>
        </div>
      ) : (
        // File Preview
        <div className="flex items-center gap-3 p-3 bg-forseti-bg-elevated rounded-lg border border-forseti-border">
          <FileText className="w-8 h-8 text-forseti-lime flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{file.name}</p>
            <p className="text-xs text-forseti-text-secondary">
              {(file.file.size / 1024).toFixed(1)} KB
            </p>
          </div>
          <button
            onClick={removeFile}
            className="p-1 hover:bg-forseti-bg-hover rounded transition-colors"
            title="Remove file"
          >
            <X className="w-5 h-5 text-forseti-text-secondary hover:text-red-400" />
          </button>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}
    </div>
  )
}
