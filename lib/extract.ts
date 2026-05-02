import Anthropic from '@anthropic-ai/sdk'
import { coerceNumber, deriveQuarter, deriveYear, generateFilename, toSlug } from './utils'
import type { DocumentTyp } from './types'

const EXTRACT_SYSTEM = `You are an invoice analyst for a self-employed freelancer (autonomo) in Spain.
Extract the following fields from the attached invoice or document as a JSON object.
Respond ONLY with the JSON object, no markdown or explanations.

Fields:
- datum: invoice date in YYYY-MM-DD format (if year is missing, use current year)
- typ: document type - AUS=outgoing invoice (I am the issuer), EIN=incoming invoice (I am the recipient), BEH=official document, BEL=receipt/voucher, expense=general expense, income=general income
- vendor: name of the issuer or recipient (the other party), compact slug format (lowercase, hyphens instead of spaces, no GmbH/S.L. etc.)
- betrag: gross total amount as a number (e.g. 145.50)
- mwst: VAT percentage as a number (e.g. 21 for Spain, 19 for Germany, 0 if no VAT)
- netto: net amount as a number (betrag divided by (1 + mwst/100))
- irpf: IRPF withholding percentage as a number (15 for established autonomo, 7 for first 3 years of activity, 0 if not shown)
- kategorie: cost category - one of: software, hosting, office, travel, fees, personnel, marketing, equipment, communications, groceries, utilities, rent, healthcare, transport, dining, subscriptions, education, clothing, leisure, insurance, family, other
- projekt: project name if identifiable, otherwise "general"
- status: always "offen"
- notizen: brief extraction note or special circumstances (max 80 chars)

If a value is not recognizable, use null.`

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

type MediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' | 'application/pdf'

function detectMediaType(filename: string): MediaType {
  const ext = filename.toLowerCase().split('.').pop()
  const map: Record<string, MediaType> = {
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
  }
  return map[ext ?? ''] ?? 'application/pdf'
}

export async function extractDocument(
  fileBuffer: ArrayBuffer,
  filename: string
): Promise<ExtractionResult | { error: string; notizen: string }> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const base64Data = Buffer.from(fileBuffer).toString('base64')
  const mediaType = detectMediaType(filename)
  const isPdf = mediaType === 'application/pdf'

  let raw: string
  try {
    const contentBlock = isPdf
      ? {
          type: 'document' as const,
          source: {
            type: 'base64' as const,
            media_type: 'application/pdf' as const,
            data: base64Data,
          },
        }
      : {
          type: 'image' as const,
          source: {
            type: 'base64' as const,
            media_type: mediaType,
            data: base64Data,
          },
        }

    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      system: [
        {
          type: 'text',
          text: EXTRACT_SYSTEM,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: [
            contentBlock,
            { type: 'text', text: 'Extract the document data as a JSON object.' },
          ],
        },
      ],
    })

    raw = response.content.find((b) => b.type === 'text')?.text ?? ''
  } catch (err) {
    return {
      error: 'extraction_failed',
      notizen: `EXTRACTION_FAILED: ${(err as Error).message}`.slice(0, 80),
    }
  }

  try {
    const jsonStr = raw.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim()
    const data = JSON.parse(jsonStr)

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
      datum,
      typ,
      vendor,
      betrag,
      mwst,
      netto,
      irpf,
      kategorie: data.kategorie ?? 'other',
      projekt: data.projekt ?? 'general',
      status: 'offen',
      quartal,
      year,
      filename: generateFilename(datum, typ, vendor, betrag, data.projekt ?? 'general'),
      notizen: data.notizen ?? '',
      extraction_raw: data,
    }
  } catch {
    return {
      error: 'parse_failed',
      notizen: `PARSE_FAILED: ${raw.slice(0, 60)}`,
    }
  }
}
