'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function NavigationHandler() {
  const router = useRouter()

  useEffect(() => {
    // Check if we're running in Electron
    if (typeof window !== 'undefined' && (window as any).electron) {
      // Listen for navigation events from Electron main process
      (window as any).electron.receive('navigate', (path: string) => {
        console.log('Navigation event received:', path)
        router.push(path)
      })

      // Listen for full iRacing session payloads (sent separately to avoid huge URLs)
      // Prefer file-based session payload for very large telemetry payloads
      if ((window as any).electronAPI && (window as any).electronAPI.onIRacingSessionFile && (window as any).electronAPI.invokeReadFile) {
        (window as any).electronAPI.onIRacingSessionFile(async (filePath: string) => {
          try {
            const content = await (window as any).electronAPI.invokeReadFile(filePath)
            if (content) {
              sessionStorage.setItem('iracing_session_payload', content)
              console.log('Stored iRacing session payload from file in sessionStorage (size:', content.length, ')')
            }
          } catch (e) {
            console.warn('Failed to read/store iRacing session file:', e)
          }
        })
      }

      // Fallback: direct in-memory IPC payload (smaller payloads)
      if ((window as any).electronAPI && (window as any).electronAPI.onIRacingSession) {
        (window as any).electronAPI.onIRacingSession((session: any) => {
          try {
            // Store raw session under a namespaced key; Activities page will read and clear it.
            sessionStorage.setItem('iracing_session_payload', JSON.stringify(session))
            console.log('Stored iRacing session payload in sessionStorage (size:', JSON.stringify(session).length, ')')
          } catch (e) {
            console.warn('Failed to store iRacing session payload:', e)
          }
        })
      }
    }
  }, [router])

  return null
}
