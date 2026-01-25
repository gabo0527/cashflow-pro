'use client'

import React, { useState, useRef, useEffect } from 'react'
import { X, Send, RefreshCw, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface ChatPanelProps {
  isOpen: boolean
  onClose: () => void
  theme: 'light' | 'dark'
  companyId: string | null
}

export default function ChatPanel({ isOpen, onClose, theme, companyId }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  
  const isDark = theme === 'dark'
  
  // Theme classes
  const bgClass = isDark ? 'bg-slate-900' : 'bg-white'
  const borderClass = isDark ? 'border-slate-700' : 'border-slate-200'
  const textClass = isDark ? 'text-slate-100' : 'text-slate-800'
  const textMutedClass = isDark ? 'text-slate-400' : 'text-slate-500'
  const inputBgClass = isDark ? 'bg-slate-800' : 'bg-slate-100'
  const userMsgClass = 'bg-blue-500 text-white'
  const assistantMsgClass = isDark ? 'bg-slate-800 text-slate-100' : 'bg-slate-100 text-slate-800'

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  const sendMessage = async () => {
    if (!input.trim() || loading) return
    
    const userMessage = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMessage, timestamp: new Date() }])
    setLoading(true)
    
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          companyId,
          context: {} // Will be enhanced with actual data
        })
      })
      
      if (!response.ok) throw new Error('Failed to get response')
      
      const data = await response.json()
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: data.message || 'Sorry, I could not process that request.', 
        timestamp: new Date() 
      }])
    } catch (error) {
      console.error('Chat error:', error)
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error. Please try again.', 
        timestamp: new Date() 
      }])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const clearChat = () => {
    setMessages([])
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />
      
      {/* Panel */}
      <div
        className={cn(
          'fixed right-0 top-0 h-full w-full max-w-md z-50 flex flex-col shadow-2xl',
          bgClass,
          'animate-in slide-in-from-right duration-300'
        )}
      >
        {/* Header */}
        <div className={cn('flex items-center justify-between px-4 h-16 border-b', borderClass)}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
              <Sparkles size={18} className="text-white" />
            </div>
            <div>
              <h2 className={cn('font-semibold', textClass)}>AI Assistant</h2>
              <p className={cn('text-xs', textMutedClass)}>Ask questions about your data</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={clearChat}
              className={cn('p-2 rounded-lg transition-colors', textMutedClass, 'hover:bg-slate-800')}
              title="Clear chat"
            >
              <RefreshCw size={18} />
            </button>
            <button
              onClick={onClose}
              className={cn('p-2 rounded-lg transition-colors', textMutedClass, 'hover:bg-slate-800')}
              title="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className={cn('text-center py-12', textMutedClass)}>
              <Sparkles size={32} className="mx-auto mb-4 opacity-50" />
              <p className="text-sm">Ask me anything about your financial data.</p>
              <div className="mt-4 space-y-2">
                <p className="text-xs">Try asking:</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {[
                    'What is my AR over 60 days?',
                    'Which project has the best margin?',
                    'Show me cash flow this month'
                  ].map((suggestion, i) => (
                    <button
                      key={i}
                      onClick={() => setInput(suggestion)}
                      className={cn(
                        'text-xs px-3 py-1.5 rounded-full border transition-colors',
                        borderClass,
                        'hover:bg-blue-500 hover:text-white hover:border-blue-500'
                      )}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          {messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                'flex',
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              <div
                className={cn(
                  'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm',
                  msg.role === 'user' ? userMsgClass : assistantMsgClass,
                  msg.role === 'user' ? 'rounded-br-md' : 'rounded-bl-md'
                )}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}
          
          {loading && (
            <div className="flex justify-start">
              <div className={cn('rounded-2xl rounded-bl-md px-4 py-3', assistantMsgClass)}>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className={cn('p-4 border-t', borderClass)}>
          <div className={cn('flex items-end gap-2 rounded-xl p-2', inputBgClass)}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question..."
              rows={1}
              className={cn(
                'flex-1 bg-transparent resize-none text-sm outline-none max-h-32 px-2 py-1',
                textClass,
                'placeholder:' + textMutedClass
              )}
              style={{ minHeight: '36px' }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              className={cn(
                'p-2 rounded-lg bg-blue-500 text-white transition-colors',
                'hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              <Send size={18} />
            </button>
          </div>
          <p className={cn('text-xs mt-2 text-center', textMutedClass)}>
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </div>
    </>
  )
}
