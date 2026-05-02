'use client'

import { useState, useEffect, useRef } from 'react'
import ChatMessage from '@/components/chat/ChatMessage'
import ChatInput from '@/components/chat/ChatInput'
import type { ChatMessage as ChatMessageType } from '@/lib/types'

export default function ChatPage() {
  const [messages, setMessages] = useState<Pick<ChatMessageType, 'role' | 'content'>[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/documents?limit=0')
    fetch('/chat/api/history').catch(() => {})
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = async () => {
    const message = input.trim()
    if (!message || streaming) return

    setInput('')
    const newMessages = [...messages, { role: 'user' as const, content: message }]
    setMessages(newMessages)
    setStreaming(true)

    const assistantIndex = newMessages.length
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }])

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, history: messages }),
      })

      if (!res.ok || !res.body) throw new Error('Request failed')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        setMessages((prev) => {
          const updated = [...prev]
          updated[assistantIndex] = {
            role: 'assistant',
            content: updated[assistantIndex].content + chunk,
          }
          return updated
        })
      }
    } catch {
      setMessages((prev) => {
        const updated = [...prev]
        updated[assistantIndex] = {
          role: 'assistant',
          content: 'Sorry, something went wrong. Please try again.',
        }
        return updated
      })
    } finally {
      setStreaming(false)
    }
  }

  return (
    <div style={{ maxWidth: '800px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ marginBottom: '4px' }}>AI Chat</h1>
        <p style={{ color: 'var(--text-muted)', margin: 0 }}>
          Ask about your business expenses, taxes, or personal spending.
        </p>
      </div>

      {messages.length === 0 && (
        <div className="ca-card" style={{ marginBottom: '20px' }}>
          <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.875rem' }}>
            Try asking:
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
            {[
              'How much IVA do I owe for Q1?',
              'What are my biggest expenses this year?',
              'How much did I spend on groceries last month?',
              'Compare business vs personal spending',
              'What invoices are still open?',
            ].map((q) => (
              <button
                key={q}
                className="btn-secondary"
                style={{ fontSize: '0.8125rem', padding: '6px 14px', minHeight: '32px' }}
                onClick={() => { setInput(q) }}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      <div
        style={{
          minHeight: '300px',
          maxHeight: '500px',
          overflowY: 'auto',
          padding: '16px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          marginBottom: '16px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {messages.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            Start a conversation above
          </div>
        ) : (
          messages.map((msg, i) => (
            <ChatMessage key={i} message={msg} />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <ChatInput
        value={input}
        onChange={setInput}
        onSubmit={handleSubmit}
        disabled={streaming}
      />

      <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '8px' }}>
        Cmd/Ctrl+Enter to send. ContaAI is not a licensed tax advisor.
      </p>
    </div>
  )
}
