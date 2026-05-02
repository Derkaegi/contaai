import type { ChatMessage as ChatMessageType } from '@/lib/types'

export default function ChatMessage({ message }: { message: Pick<ChatMessageType, 'role' | 'content'> }) {
  const isUser = message.role === 'user'

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        marginBottom: '12px',
      }}
    >
      <div className={isUser ? 'chat-bubble-user' : 'chat-bubble-assistant'}>
        <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
          {message.content}
        </div>
      </div>
    </div>
  )
}
