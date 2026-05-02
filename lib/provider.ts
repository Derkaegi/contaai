import { execSync, spawnSync, spawn } from 'child_process'
import { writeFileSync, unlinkSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import Anthropic from '@anthropic-ai/sdk'
import { coerceNumber, deriveQuarter, deriveYear, generateFilename, toSlug } from './utils'
import type { DocumentTyp } from './types'

const CLAUDE_BIN = process.env.HOME ? `${process.env.HOME}/.local/bin/claude` : '/usr/local/bin/claude'
const GWS_BIN = `${process.env.HOME}/.local/bin/gws`

export type Provider = 'cli' | 'api'

export function getProvider(): Provider {
  if (process.env.CLAUDE_PROVIDER === 'api') return 'api'
  if (process.env.CLAUDE_PROVIDER === 'cli') return 'cli'
  const hasBin = existsSync(CLAUDE_BIN)
  const hasKey = !!process.env.ANTHROPIC_API_KEY?.trim()
  return hasBin && !hasKey ? 'cli' : 'api'
}

export function isGwsAvailable(): boolean {
  return existsSync(GWS_BIN)
}

// ─── Extraction ───────────────────────────────────────────────

const EXTRACT_PROMPT = `You are an invoice analyst for a self-employed freelancer (autonomo) in Spain.
Extract the following fields from the file as a JSON object.
Respond ONLY with the JSON object, no markdown or explanations.

Fields:
- datum: invoice date YYYY-MM-DD (use current year if missing)
- typ: AUS=outgoing invoice, EIN=incoming invoice, BEH=official doc, BEL=receipt, expense=general expense, income=general income
- vendor: counterparty name as slug (lowercase, hyphens, no GmbH/S.L.)
- betrag: gross total as number (e.g. 145.50)
- mwst: VAT percentage as number (21 for Spain, 0 if none)
- netto: net amount as number
- irpf: IRPF withholding percentage (15 or 7 or 0)
- kategorie: one of: software, hosting, office, travel, fees, personnel, marketing, equipment, groceries, utilities, rent, healthcare, transport, dining, subscriptions, education, clothing, leisure, insurance, family, other
- projekt: project name or "general"
- status: always "offen"
- notizen: brief extraction note (max 80 chars)

If a value is unrecognizable, use null.`

type ExtractionResult = {
  datum: string | null
  typ: DocumentTyp
  vendor: string
  betrag: number
  mwst: number
  netto: number
  irpf: number
  kategorie: string
  projekt: string
  status: string
  quartal: string
  year: number
  filename: string
  notizen: string
  extraction_raw: Record<string, unknown>
}

function parseExtraction(jsonStr: string): ExtractionResult | { error: string; notizen: string } {
  try {
    const clean = jsonStr.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim()
    const data = JSON.parse(clean)
    const datum = data.datum ?? null
    const typ = (data.typ as DocumentTyp) ?? 'EIN'
    const vendor = data.vendor ? toSlug(data.vendor, 40) : 'unknown'
    const betrag = coerceNumber(data.betrag)
    const mwst = coerceNumber(data.mwst)
    const netto = coerceNumber(data.netto) || (mwst > 0 ? betrag / (1 + mwst / 100) : betrag)
    const irpf = coerceNumber(data.irpf)
    const quartal = datum ? deriveQuarter(datum) : 'Q1'
    const year = datum ? deriveYear(datum) : new Date().getFullYear()
    return {
      datum, typ, vendor, betrag, mwst, netto, irpf,
      kategorie: data.kategorie ?? 'other',
      projekt: data.projekt ?? 'general',
      status: 'offen',
      quartal, year,
      filename: generateFilename(datum, typ, vendor, betrag, data.projekt ?? 'general'),
      notizen: data.notizen ?? '',
      extraction_raw: data,
    }
  } catch {
    return { error: 'parse_failed', notizen: `PARSE_FAILED: ${jsonStr.slice(0, 60)}` }
  }
}

async function extractViaCLI(
  fileBuffer: ArrayBuffer,
  filename: string
): Promise<ExtractionResult | { error: string; notizen: string }> {
  const tmpPath = join(tmpdir(), `contaai_${Date.now()}_${filename.replace(/[^a-z0-9._-]/gi, '_')}`)
  writeFileSync(tmpPath, Buffer.from(fileBuffer))

  try {
    const prompt = `${EXTRACT_PROMPT}\n\nRead the file at: ${tmpPath}\n\nExtract the invoice data and return ONLY a JSON object.`
    const result = spawnSync(CLAUDE_BIN, [
      '--print', '--no-session-persistence', '--model', 'claude-haiku-4-5', '-p', prompt
    ], {
      env: { ...process.env, ANTHROPIC_API_KEY: '' },
      timeout: 90000,
      encoding: 'utf8',
      maxBuffer: 1024 * 1024,
    })

    if (result.error) throw result.error
    const output = result.stdout?.trim() ?? ''
    const jsonMatch = output.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return { error: 'no_json', notizen: `CLI_NO_JSON: ${output.slice(0, 60)}` }
    return parseExtraction(jsonMatch[0])
  } catch (err) {
    return { error: 'cli_failed', notizen: `CLI_FAILED: ${(err as Error).message.slice(0, 60)}` }
  } finally {
    try { unlinkSync(tmpPath) } catch {}
  }
}

async function extractViaAPI(
  fileBuffer: ArrayBuffer,
  filename: string
): Promise<ExtractionResult | { error: string; notizen: string }> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const base64Data = Buffer.from(fileBuffer).toString('base64')
  const ext = filename.toLowerCase().split('.').pop()
  const mediaTypeMap: Record<string, string> = {
    pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    png: 'image/png', gif: 'image/gif', webp: 'image/webp',
  }
  const mediaType = mediaTypeMap[ext ?? ''] ?? 'application/pdf'
  const isPdf = mediaType === 'application/pdf'

  try {
    const contentBlock = isPdf
      ? { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: base64Data } }
      : { type: 'image' as const, source: { type: 'base64' as const, media_type: mediaType as 'image/jpeg', data: base64Data } }

    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      system: [{ type: 'text', text: EXTRACT_PROMPT, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: [contentBlock, { type: 'text', text: 'Extract the invoice data as JSON.' }] }],
    })
    const raw = response.content.find((b) => b.type === 'text')?.text ?? ''
    return parseExtraction(raw)
  } catch (err) {
    return { error: 'api_failed', notizen: `API_FAILED: ${(err as Error).message.slice(0, 60)}` }
  }
}

export async function extractDocument(
  fileBuffer: ArrayBuffer,
  filename: string
): Promise<ExtractionResult | { error: string; notizen: string }> {
  const provider = getProvider()
  console.log(`[provider] extraction via ${provider}`)
  return provider === 'cli'
    ? extractViaCLI(fileBuffer, filename)
    : extractViaAPI(fileBuffer, filename)
}

// ─── Chat ─────────────────────────────────────────────────────

import type { ChatMessage } from './types'

function buildChatSystemPrompt(
  quarterData: Record<string, unknown>[],
  recentDocs: Record<string, unknown>[]
): string {
  return `You are ContaAI, an AI accounting assistant for a self-employed freelancer (autonomo) in Spain. You also track their personal and family finances.

QUARTERLY BUSINESS SUMMARY:
${JSON.stringify(quarterData, null, 2)}

RECENT DOCUMENTS (last 50):
${JSON.stringify(recentDocs.map((d) => ({
  id: d.id, context: d.context, datum: d.datum, typ: d.typ, vendor: d.vendor,
  betrag: d.betrag, mwst: d.mwst, irpf: d.irpf, kategorie: d.kategorie,
  projekt: d.projekt, status: d.status, quartal: d.quartal, year: d.year,
})), null, 2)}

SPANISH AUTONOMO TAX CONTEXT:
- IVA: 21% general, 10% reduced, 4% super-reduced
- IRPF: 15% standard autonomo, 7% first 3 years
- Quarters: Q1=Jan-Mar (due Apr 20), Q2=Apr-Jun (due Jul 20), Q3=Jul-Sep (due Oct 20), Q4=Oct-Dec (due Jan 30)
- Modelo 303: quarterly IVA (IVA repercutido minus IVA soportado)
- Modelo 130: quarterly IRPF advance (20% net income after deductions)

PERSONAL FINANCE: Track household, family, personal expenses separately.
Answer in the same language the user writes in (Spanish or English). Be concise, use numbers, format amounts in EUR.
Never give official tax advice — recommend consulting a gestor for filings.`
}

async function chatViaCLI(
  systemPrompt: string,
  userMessage: string,
  history: Pick<ChatMessage, 'role' | 'content'>[]
): Promise<ReadableStream<Uint8Array>> {
  const encoder = new TextEncoder()
  const historyText = history.map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n\n')
  const fullPrompt = `${systemPrompt}\n\n${historyText ? `CONVERSATION HISTORY:\n${historyText}\n\n` : ''}User message: ${userMessage}`

  return new ReadableStream({
    start(controller) {
      const proc = spawn(CLAUDE_BIN, [
        '--print', '--no-session-persistence', '--model', 'claude-sonnet-4-6', '-p', fullPrompt
      ], {
        env: { ...process.env, ANTHROPIC_API_KEY: '' }
      })

      proc.stdout.on('data', (chunk: Buffer) => {
        controller.enqueue(encoder.encode(chunk.toString()))
      })
      proc.stdout.on('end', () => controller.close())
      proc.stderr.on('data', (chunk: Buffer) => {
        const msg = chunk.toString()
        if (!msg.startsWith('Warning:') && !msg.includes('SECURITY')) {
          controller.enqueue(encoder.encode(`\n[Error: ${msg.slice(0, 80)}]`))
        }
      })
      proc.on('error', (err) => {
        controller.enqueue(encoder.encode(`\n[CLI error: ${err.message}]`))
        controller.close()
      })
    }
  })
}

async function chatViaAPI(
  systemPrompt: string,
  userMessage: string,
  history: Pick<ChatMessage, 'role' | 'content'>[]
): Promise<ReadableStream<Uint8Array>> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const encoder = new TextEncoder()
  const messages = [
    ...history.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user' as const, content: userMessage },
  ]

  return new ReadableStream({
    async start(controller) {
      const stream = client.messages.stream({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
        messages,
      })
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          controller.enqueue(encoder.encode(chunk.delta.text))
        }
      }
      controller.close()
    }
  })
}

export async function streamChat(
  userMessage: string,
  history: Pick<ChatMessage, 'role' | 'content'>[],
  quarterData: Record<string, unknown>[],
  recentDocs: Record<string, unknown>[]
): Promise<ReadableStream<Uint8Array>> {
  const provider = getProvider()
  console.log(`[provider] chat via ${provider}`)
  const systemPrompt = buildChatSystemPrompt(quarterData, recentDocs)
  return provider === 'cli'
    ? chatViaCLI(systemPrompt, userMessage, history)
    : chatViaAPI(systemPrompt, userMessage, history)
}
