'use client'

import { useEffect, useState } from 'react'

export default function ElectronTitleBar() {
  const [isElectron, setIsElectron] = useState(false)

  useEffect(() => {
    // Check if running in Electron
    setIsElectron(typeof window !== 'undefined' && (window as any).electron?.isElectron)
  }, [])

  if (!isElectron) return null

  const handleMinimize = () => {
    if (typeof window !== 'undefined' && (window as any).electron) {
      (window as any).electron.send('window-minimize')
    }
  }

  const handleMaximize = () => {
    if (typeof window !== 'undefined' && (window as any).electron) {
      (window as any).electron.send('window-maximize')
    }
  }

  const handleClose = () => {
    if (typeof window !== 'undefined' && (window as any).electron) {
      (window as any).electron.send('window-close')
    }
  }

  return (
    <div className="h-8 bg-forseti-bg-secondary border-b border-forseti-border flex items-center justify-end px-4 select-none" style={{ WebkitAppRegion: 'drag' } as any}>
      {/* Window Controls */}
      <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as any}>
        <button
          onClick={handleMinimize}
          className="w-8 h-8 flex items-center justify-center hover:bg-forseti-bg-hover transition-colors rounded text-forseti-text-secondary text-xl leading-none"
          title="Minimize"
        >
          −
        </button>
        <button
          onClick={handleMaximize}
          className="w-8 h-8 flex items-center justify-center hover:bg-forseti-bg-hover transition-colors rounded text-forseti-text-secondary text-lg leading-none"
          title="Maximize"
        >
          □
        </button>
        <button
          onClick={handleClose}
          className="w-8 h-8 flex items-center justify-center hover:bg-forseti-error transition-colors rounded text-forseti-text-secondary hover:text-white text-xl leading-none"
          title="Close"
        >
          ×
        </button>
      </div>
    </div>
  )
}
