import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from './supabase'
import type { ChatMessage } from './types'

function buildSystemPrompt(
  quarterData: Record<string, unknown>[],
  recentDocs: Record<string, unknown>[]
): string {
  return `You are ContaAI, an AI accounting assistant for a self-employed freelancer (autonomo) in Spain. You also track their personal and family finances.

You have access to their complete financial records.

QUARTERLY BUSINESS SUMMARY:
${JSON.stringify(quarterData, null, 2)}

RECENT DOCUMENTS (last 50, both business and personal):
${JSON.stringify(recentDocs.map((d) => ({
  id: d.id,
  context: d.context,
  datum: d.datum,
  typ: d.typ,
  vendor: d.vendor,
  betrag: d.betrag,
  mwst: d.mwst,
  irpf: d.irpf,
  kategorie: d.kategorie,
  projekt: d.projekt,
  status: d.status,
  quartal: d.quartal,
  year: d.year,
})), null, 2)}

SPANISH AUTONOMO TAX CONTEXT:
- IVA rates: 21% general, 10% reduced, 4% super-reduced
- IRPF withholding: 15% standard autonomo (after 3 years), 7% for first 3 years
- Tax quarters: Q1=Jan-Mar (deadline Apr 20), Q2=Apr-Jun (deadline Jul 20), Q3=Jul-Sep (deadline Oct 20), Q4=Oct-Dec (deadline Jan 30 next year)
- Modelo 303: quarterly IVA declaration (IVA repercutido - IVA soportado)
- Modelo 130: quarterly IRPF advance payment (20% of net income after deductions)
- IVA a pagar = sum of IVA on AUS invoices minus sum of IVA on EIN invoices
- IRPF retenido = sum of IRPF withheld on AUS invoices (reduces your Modelo 130 obligation)

PERSONAL FINANCE CONTEXT:
- Track household, family, and personal expenses separately from business
- Categories: groceries, utilities, rent, healthcare, transport, dining, subscriptions, education, clothing, leisure, insurance, family

INSTRUCTIONS:
- Answer in the same language the user writes in (Spanish or English)
- Be concise. Use numbers. Format amounts in EUR with 2 decimal places
- For business questions, reference the quarterly data above
- For personal questions, reference the personal context documents
- Never give official tax advice; recommend consulting a gestor for official filings
- If asked to compare business vs personal, summarize both clearly`
}

export async function streamChat(
  userMessage: string,
  history: Pick<ChatMessage, 'role' | 'content'>[]
): Promise<ReadableStream<Uint8Array>> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const db = createServiceClient()

  const currentYear = new Date().getFullYear()

  const [{ data: quarterData }, { data: recentDocs }] = await Promise.all([
    db
      .from('documents')
      .select('context, quartal, year, typ, betrag, mwst, irpf, netto')
      .eq('year', currentYear)
      .order('quartal'),
    db
      .from('documents')
      .select('id, context, datum, typ, vendor, betrag, mwst, irpf, kategorie, projekt, status, quartal, year')
      .order('datum', { ascending: false })
      .limit(50),
  ])

  const systemPrompt = buildSystemPrompt(quarterData ?? [], recentDocs ?? [])

  const messages = [
    ...history.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user' as const, content: userMessage },
  ]

  const encoder = new TextEncoder()

  return new ReadableStream({
    async start(controller) {
      let fullResponse = ''
      try {
        const stream = client.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 2048,
          system: [
            {
              type: 'text',
              text: systemPrompt,
              cache_control: { type: 'ephemeral' },
            },
          ],
          messages,
        })

        for await (const chunk of stream) {
          if (
            chunk.type === 'content_block_delta' &&
            chunk.delta.type === 'text_delta'
          ) {
            fullResponse += chunk.delta.text
            controller.enqueue(encoder.encode(chunk.delta.text))
          }
        }

        await Promise.all([
          db.from('chat_messages').insert({ role: 'user', content: userMessage }),
          db.from('chat_messages').insert({ role: 'assistant', content: fullResponse }),
        ])
      } finally {
        controller.close()
      }
    },
  })
}
