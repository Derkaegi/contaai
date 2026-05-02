'use client'

import { useRef } from 'react'

interface ChatInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  disabled: boolean
}

export default function ChatInput({ value, onChange, onSubmit, disabled }: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      onSubmit()
    }
  }

  return (
    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
      <textarea
        ref={textareaRef}
        className="ca-input"
        rows={3}
        placeholder="Ask about your finances... (Cmd+Enter to send)"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        style={{ resize: 'vertical', minHeight: '80px' }}
      />
      <button
        className="btn-primary"
        onClick={onSubmit}
        disabled={disabled || !value.trim()}
        style={{ flexShrink: 0, alignSelf: 'flex-end' }}
      >
        {disabled ? '...' : 'Send'}
      </button>
    </div>
  )
}
