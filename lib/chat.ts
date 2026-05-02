import { createServiceClient } from './supabase'
import { streamChat as providerStreamChat } from './provider'
import type { ChatMessage } from './types'

export async function streamChat(
  userMessage: string,
  history: Pick<ChatMessage, 'role' | 'content'>[]
): Promise<ReadableStream<Uint8Array>> {
  const db = createServiceClient()
  const currentYear = new Date().getFullYear()

  const [{ data: quarterData }, { data: recentDocs }] = await Promise.all([
    db.from('documents').select('context, quartal, year, typ, betrag, mwst, irpf, netto').eq('year', currentYear).order('quartal'),
    db.from('documents').select('id, context, datum, typ, vendor, betrag, mwst, irpf, kategorie, projekt, status, quartal, year').order('datum', { ascending: false }).limit(50),
  ])

  const stream = await providerStreamChat(userMessage, history, quarterData ?? [], recentDocs ?? [])

  const encoder = new TextEncoder()
  let fullResponse = ''

  const [streamForClient, streamForPersist] = stream.tee()

  const reader = streamForPersist.getReader()
  const decoder = new TextDecoder()
  ;(async () => {
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        fullResponse += decoder.decode(value, { stream: true })
      }
      await Promise.all([
        db.from('chat_messages').insert({ role: 'user', content: userMessage }),
        db.from('chat_messages').insert({ role: 'assistant', content: fullResponse }),
      ])
    } catch {}
  })()

  return streamForClient
}
