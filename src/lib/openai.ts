// ============================================================
// Provider-agnostic AI client (OpenAI-compatible API format)
//
// Default provider: Groq free tier (llama-3.3-70b-versatile)
//   - 30 RPM, 14 400 RPD, 131 072 tokens/min
//   - Get a free key: https://console.groq.com/keys
//
// To switch provider, set AI_BASE_URL to any OpenAI-compatible
// endpoint (Together AI, OpenRouter, local Ollama, etc.).
// ============================================================

const AI_API_KEY = process.env.AI_API_KEY || ''
const AI_BASE_URL = process.env.AI_BASE_URL || 'https://api.groq.com/openai/v1'
const AI_MODEL = process.env.AI_MODEL || 'llama-3.3-70b-versatile'

const REQUEST_TIMEOUT_MS = 20_000

export function isAIAvailable(): boolean {
  return AI_API_KEY.length > 0
}

async function complete(
  messages: { role: string; content: string }[],
  maxTokens = 1000,
  temperature = 0.7
): Promise<string> {
  if (!AI_API_KEY) {
    throw new Error('AI not configured — set AI_API_KEY in .env.local')
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const res = await fetch(`${AI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages,
        max_tokens: maxTokens,
        temperature,
      }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`AI API ${res.status}: ${body.slice(0, 200)}`)
    }

    const data = await res.json()
    return data.choices?.[0]?.message?.content || ''
  } finally {
    clearTimeout(timer)
  }
}

// ============================================================
// SYSTEM PROMPT
// ============================================================
const SYSTEM_PROMPT = `You are an intelligent assistant for Oringe Waswa & Akude Advocates LLP, a leading law firm in Kenya.
You help with:
- Answering questions about the firm's legal services
- Guiding users through application and submission processes
- Providing general legal information (NOT specific legal advice)
- Booking consultations and handling inquiries
- Answering FAQs about the firm

Practice areas: Civil Litigation, Criminal Defense, Family Law, Corporate Law, Property Law,
Immigration, Employment Law, Intellectual Property, Constitutional Law, Alternative Dispute Resolution.

Always be professional, helpful, and empathetic. Remind users that your responses are
informational only, not legal advice. For specific matters, encourage booking a consultation.
The firm is based in Nairobi, Kenya and serves clients across East Africa.`

// ============================================================
// TOOL-CALLING (used by the Admin AI Assistant)
// ============================================================
export interface ToolMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: ToolCall[]
  tool_call_id?: string
}

export interface ToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

export interface ToolDefinition {
  type: 'function'
  function: { name: string; description: string; parameters: unknown }
}

export interface ToolCompletionResult {
  content: string | null
  tool_calls?: ToolCall[]
}

export async function completeWithTools(
  messages: ToolMessage[],
  tools: ToolDefinition[],
  maxTokens = 800,
  temperature = 0.2
): Promise<ToolCompletionResult> {
  if (!AI_API_KEY) {
    throw new Error('AI not configured — set AI_API_KEY in .env.local')
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const res = await fetch(`${AI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages,
        tools,
        tool_choice: 'auto',
        max_tokens: maxTokens,
        temperature,
      }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`AI API ${res.status}: ${body.slice(0, 200)}`)
    }

    const data = await res.json()
    const choice = data.choices?.[0]
    return {
      content: choice?.message?.content ?? null,
      tool_calls: choice?.message?.tool_calls as ToolCall[] | undefined,
    }
  } finally {
    clearTimeout(timer)
  }
}

// ============================================================
// PUBLIC API FUNCTIONS
// (Every function returns a sensible default when AI is down.)
// ============================================================

export async function chatWithAI(
  messages: { role: 'user' | 'assistant'; content: string }[]
): Promise<string> {
  if (!isAIAvailable()) {
    return 'The AI assistant is temporarily offline. Please contact us directly at info@oringewaswa.com or call our office for immediate assistance.'
  }
  try {
    return await complete(
      [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
      1000,
      0.7
    )
  } catch {
    return "I'm having trouble connecting right now. Please try again shortly, or reach out to our office directly."
  }
}

export async function analyzeSubmission(
  type: string,
  data: Record<string, unknown>
): Promise<{
  summary: string
  highlights: string[]
  concerns: string[]
  recommended_action: string
  priority_score: number
  suggested_type?: string
  confidence?: number
}> {
  const fallback = {
    summary: 'Submission received and ready for manual review.',
    highlights: [],
    concerns: [],
    recommended_action: 'Review manually',
    priority_score: 5,
  }

  if (!isAIAvailable()) return fallback

  const prompt = `Analyze this "${type}" form submission for Oringe Waswa & Akude Advocates LLP law firm:
${JSON.stringify(data, null, 2)}

Tasks:
1. Summarize the submission (2-3 sentences)
2. List key strengths/highlights
3. List any concerns or red flags
4. Recommend an action
5. Score priority 1-10 (10 = most urgent)
6. Detect if this was submitted in the WRONG category (e.g. contact but it's really a job inquiry)

IMPORTANT: Respond ONLY with valid JSON, no markdown, no backticks:
{
  "summary": "...",
  "highlights": ["..."],
  "concerns": ["..."],
  "recommended_action": "...",
  "priority_score": 7,
  "suggested_type": "contact|job|paper|appointment",
  "confidence": 0.85,
  "routing_reason": "..."
}`

  try {
    const raw = await complete([{ role: 'user', content: prompt }], 600, 0.2)
    return JSON.parse(raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim())
  } catch {
    return fallback
  }
}

export async function analyzeAndRoute(
  type: string,
  data: Record<string, unknown>
): Promise<{
  suggested_type: string
  confidence: number
  routing_reason: string
  summary: string
  priority_score: number
}> {
  const fallback = {
    suggested_type: type,
    confidence: 0.5,
    routing_reason: 'AI unavailable — default routing applied',
    summary: 'Submission received',
    priority_score: 5,
  }

  if (!isAIAvailable()) return fallback

  const prompt = `A user submitted a "${type}" form with this content:
Name: ${data.name || data.client_name || 'Unknown'}
Message: ${data.message || data.description || JSON.stringify(data).slice(0, 500)}

Determine the CORRECT submission category based on the actual content.
Available types: contact, job, paper, appointment

Examples:
- "I want to apply for the position of advocate" → job
- "I have a civil matter I need help with" → contact (or appointment)
- "Here is my research paper on constitutional law" → paper

Respond ONLY with JSON:
{
  "suggested_type": "contact",
  "confidence": 0.92,
  "routing_reason": "User describes a legal matter needing attorney consultation",
  "summary": "Client seeking advice on civil dispute",
  "priority_score": 7
}`

  try {
    const raw = await complete([{ role: 'user', content: prompt }], 300, 0.1)
    return JSON.parse(raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim())
  } catch {
    return fallback
  }
}

export async function generateBlogSummary(
  title: string,
  content: string
): Promise<string> {
  if (!isAIAvailable()) return ''
  try {
    return await complete(
      [{
        role: 'user',
        content: `Write a compelling 2-sentence excerpt for a law firm blog post titled "${title}": ${content.slice(0, 2000)}`,
      }],
      150,
      0.5
    )
  } catch {
    return ''
  }
}

export async function generateCertificateContent(data: {
  recipientName: string
  type: string
  achievement: string
  date: string
  firmName: string
}): Promise<string> {
  if (!isAIAvailable()) {
    return `This certifies that ${data.recipientName} has successfully completed ${data.achievement} at ${data.firmName} on ${data.date}.`
  }
  try {
    return await complete(
      [{
        role: 'user',
        content: `Write formal certificate body text (3-4 sentences, no headings, no markdown) for:
Recipient: ${data.recipientName}
Certificate Type: ${data.type.replace(/_/g, ' ')}
Achievement: ${data.achievement}
Date: ${data.date}
Issuing Organization: ${data.firmName}`,
      }],
      200,
      0.4
    )
  } catch {
    return `This certifies that ${data.recipientName} has successfully completed ${data.achievement} at ${data.firmName} on ${data.date}.`
  }
}

export async function moderateBlogContent(
  title: string,
  content: string
): Promise<{
  safe_to_publish: boolean
  concerns: string[]
  suggestions: string[]
  quality_score: number
  seo_keywords: string[]
}> {
  const fallback = { safe_to_publish: true, concerns: [], suggestions: ['AI moderation unavailable — please review manually.'], quality_score: 5, seo_keywords: [] }

  if (!isAIAvailable()) return fallback

  try {
    const raw = await complete(
      [{
        role: 'user',
        content: `Review this blog post for a Kenyan law firm's website:
Title: ${title}
Content preview: ${content.slice(0, 2000)}

Check: legal accuracy, inappropriate content, defamatory statements, writing quality, SEO.
Respond ONLY with JSON (no markdown):
{"safe_to_publish":true,"concerns":[],"suggestions":[],"quality_score":7,"seo_keywords":[]}`,
      }],
      400,
      0.2
    )
    return JSON.parse(raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim())
  } catch {
    return fallback
  }
}

export async function draftCampaignEmail(
  subject: string,
  audience: string
): Promise<string> {
  if (!isAIAvailable()) return ''
  try {
    return await complete(
      [{
        role: 'user',
        content: `Write a professional newsletter email for a Kenyan law firm with subject: "${subject}".
Target audience: ${audience || 'general subscribers'}
Requirements: under 200 words, formal but engaging, include a call-to-action.
Return plain HTML body (no <!DOCTYPE>, no <html>, just inner body content).`,
      }],
      500,
      0.6
    )
  } catch {
    return ''
  }
}

export async function generateAIFormSuggestion(
  formType: string,
  fieldName: string,
  context: string
): Promise<string> {
  if (!isAIAvailable()) return ''
  try {
    return await complete(
      [{
        role: 'user',
        content: `Help a user fill in the "${fieldName}" field of a ${formType} form for Oringe Waswa & Akude Advocates LLP law firm.
Context provided: ${context}
Write a professional 2-3 sentence template they can use or adapt. Be specific and helpful.`,
      }],
      150,
      0.5
    )
  } catch {
    return ''
  }
}
