'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, X, Minimize2, Maximize2 } from 'lucide-react'
import Image from 'next/image'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface RaceEngineerChatProps {
  sessionContext: {
    track?: string
    car?: string
    fastestLap?: string
    selectedLap?: number
    referenceLap?: number
    isProDriverReference?: boolean
    proDriverName?: string
    lapCount?: number
    improvementAreas?: number
  }
  onSendMessage: (message: string, history: Message[]) => Promise<string>
}

export default function RaceEngineerChat({ sessionContext, onSendMessage }: RaceEngineerChatProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: `Hi! I'm your Forseti Race Engineer. I'm here to help you analyze your session${sessionContext.track ? ` at ${sessionContext.track}` : ''}. Ask me anything about your lap times, telemetry, or how to improve!`,
      timestamp: new Date()
    }
  ])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (isOpen && !isMinimized) {
      inputRef.current?.focus()
    }
  }, [isOpen, isMinimized])

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return

    const userMessage: Message = {
      role: 'user',
      content: inputValue,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)

    try {
      const response = await onSendMessage(inputValue, messages)

      const assistantMessage: Message = {
        role: 'assistant',
        content: response,
        timestamp: new Date()
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      console.error('Race Engineer error:', error)
      const errorMessage: Message = {
        role: 'assistant',
        content: "Sorry, I'm having trouble responding right now. Please try again.",
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-6 py-4 bg-forseti-bg-card hover:bg-forseti-bg-hover rounded-lg border border-forseti-border shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5 font-semibold group"
      >
        <Image
          src="/assets/level-badges/Platinum.png"
          alt="Platinum"
          width={28}
          height={28}
          className="group-hover:scale-110 transition-transform"
        />
        <span className="text-base text-forseti-lime">Race Engineer</span>
      </button>
    )
  }

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 bg-forseti-bg-card border border-forseti-border rounded-lg shadow-2xl transition-all ${
        isMinimized ? 'w-80 h-14' : 'w-96 h-[600px]'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-forseti-border">
        <div className="flex items-center gap-3">
          <Image
            src="/assets/level-badges/Platinum.png"
            alt="Platinum"
            width={24}
            height={24}
          />
          <div>
            <h3 className="font-semibold text-forseti-lime">Race Engineer</h3>
            {sessionContext.track && (
              <p className="text-xs text-forseti-text-secondary">
                {sessionContext.track} • {sessionContext.car || 'Unknown Car'}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 hover:bg-forseti-bg-hover rounded transition-colors"
            title={isMinimized ? 'Maximize' : 'Minimize'}
          >
            {isMinimized ? (
              <Maximize2 className="w-4 h-4 text-forseti-text-secondary" />
            ) : (
              <Minimize2 className="w-4 h-4 text-forseti-text-secondary" />
            )}
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 hover:bg-forseti-bg-hover rounded transition-colors"
            title="Close"
          >
            <X className="w-4 h-4 text-forseti-text-secondary" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 h-[calc(600px-140px)]">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    message.role === 'user'
                      ? 'bg-forseti-lime text-forseti-bg-card'
                      : 'bg-forseti-bg-hover text-forseti-text-primary'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  <p
                    className={`text-xs mt-1 ${
                      message.role === 'user'
                        ? 'text-forseti-bg-card/70'
                        : 'text-forseti-text-secondary'
                    }`}
                  >
                    {formatTime(message.timestamp)}
                  </p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-lg p-3 bg-forseti-bg-hover text-forseti-text-primary">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-forseti-lime rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-forseti-lime rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-forseti-lime rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="text-xs text-forseti-text-secondary">Analyzing...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-forseti-border">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask about your session..."
                disabled={isLoading}
                className="flex-1 px-3 py-2 bg-forseti-bg-hover border border-forseti-border rounded-lg text-forseti-text-primary placeholder-forseti-text-secondary focus:outline-none focus:border-forseti-lime transition-colors disabled:opacity-50 text-sm"
              />
              <button
                onClick={handleSend}
                disabled={!inputValue.trim() || isLoading}
                className="px-4 py-2 bg-forseti-lime text-forseti-bg-card rounded-lg hover:bg-forseti-lime hover:shadow-[0_0_15px_rgba(190,242,100,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-semibold group"
              >
                <Send className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
            <p className="text-xs text-forseti-text-secondary mt-2">
              AI-powered race engineer • Powered by Claude
            </p>
          </div>
        </>
      )}
    </div>
  )
}
