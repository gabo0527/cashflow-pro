'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Send, Sparkles, RefreshCw, Download, Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface AIPageProps {
  companyId?: string
  theme?: 'light' | 'dark'
}

export default function AIPage({ companyId, theme = 'dark' }: AIPageProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState<number | null>(null)
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

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

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
          context: {}
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

  const copyMessage = async (index: number, content: string) => {
    await navigator.clipboard.writeText(content)
    setCopied(index)
    setTimeout(() => setCopied(null), 2000)
  }

  const suggestions = [
    'What is my total AR outstanding?',
    'Which project has the highest gross margin?',
    'Show me cash flow for last month',
    'What are my largest expenses?',
    'Create a summary of Q4 financials'
  ]

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className={cn('text-2xl font-semibold', textClass)}>AI Assistant</h1>
          <p className={cn('text-sm mt-1', textMutedClass)}>Ask questions and get insights about your financial data</p>
        </div>
        <button
          onClick={clearChat}
          className={cn('flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors', borderClass, 'border', textMutedClass, 'hover:bg-slate-800')}
        >
          <RefreshCw size={16} />
          Clear chat
        </button>
      </div>

      {/* Chat Area */}
      <div className={cn('flex-1 rounded-xl border overflow-hidden flex flex-col', bgClass, borderClass)}>
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 && (
            <div className={cn('text-center py-16', textMutedClass)}>
              <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center mx-auto mb-6">
                <Sparkles size={32} className="text-blue-500" />
              </div>
              <h2 className={cn('text-xl font-semibold mb-2', textClass)}>How can I help you today?</h2>
              <p className="text-sm max-w-md mx-auto mb-8">
                I can analyze your financial data, answer questions, and help you build reports.
              </p>
              
              <div className="max-w-2xl mx-auto">
                <p className="text-xs uppercase tracking-wider mb-3 font-medium">Suggestions</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {suggestions.map((suggestion, i) => (
                    <button
                      key={i}
                      onClick={() => setInput(suggestion)}
                      className={cn(
                        'text-sm px-4 py-2 rounded-lg border transition-colors text-left',
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
                'flex gap-4',
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              {msg.role === 'assistant' && (
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
                  <Sparkles size={16} className="text-white" />
                </div>
              )}
              <div className={cn('max-w-2xl', msg.role === 'user' ? 'order-first' : '')}>
                <div
                  className={cn(
                    'rounded-2xl px-4 py-3 text-sm',
                    msg.role === 'user' ? userMsgClass : assistantMsgClass,
                    msg.role === 'user' ? 'rounded-br-md' : 'rounded-bl-md'
                  )}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
                {msg.role === 'assistant' && (
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={() => copyMessage(i, msg.content)}
                      className={cn('p-1.5 rounded transition-colors', textMutedClass, 'hover:bg-slate-700')}
                      title="Copy message"
                    >
                      {copied === i ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                  </div>
                )}
              </div>
              {msg.role === 'user' && (
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-slate-600 flex items-center justify-center text-sm font-medium text-white">
                  U
                </div>
              )}
            </div>
          ))}
          
          {loading && (
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
                <Sparkles size={16} className="text-white" />
              </div>
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
          <div className={cn('flex items-end gap-3 rounded-xl p-3', inputBgClass)}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question about your financial data..."
              rows={1}
              className={cn(
                'flex-1 bg-transparent resize-none text-sm outline-none max-h-32 px-2 py-1',
                textClass,
                'placeholder:' + textMutedClass
              )}
              style={{ minHeight: '40px' }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              className={cn(
                'p-2.5 rounded-lg bg-blue-500 text-white transition-colors',
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
    </div>
  )
}
