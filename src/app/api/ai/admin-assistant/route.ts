import { NextRequest, NextResponse } from 'next/server'
import { completeWithTools, type ToolMessage } from '@/lib/openai'
import { buildToolDefinitions, buildSystemPrompt, runQuery, isValidResource } from '@/lib/adminAiTools'

const MAX_TOOL_ITERATIONS = 6

interface IncomingMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface PendingAction {
  resource: string
  operation: 'create' | 'update' | 'delete' | 'send'
  id?: string
  data?: Record<string, unknown>
  summary: string
}

export async function POST(req: NextRequest) {
  try {
    const { messages } = (await req.json()) as { messages: IncomingMessage[] }
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Invalid messages array' }, { status: 400 })
    }

    const origin = req.nextUrl.origin
    const cookieHeader = req.headers.get('cookie') || undefined
    const tools = buildToolDefinitions()
    const conversation: ToolMessage[] = [
      { role: 'system', content: buildSystemPrompt() },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ]

    let pendingAction: PendingAction | null = null
    let finalText: string | null = null

    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      const result = await completeWithTools(conversation, tools)

      if (!result.tool_calls || result.tool_calls.length === 0) {
        finalText = result.content || ''
        break
      }

      // Append the assistant's tool-call message to the running conversation
      conversation.push({ role: 'assistant', content: result.content, tool_calls: result.tool_calls })

      let stagedThisRound = false

      for (const call of result.tool_calls) {
        let args: Record<string, unknown> = {}
        try {
          args = JSON.parse(call.function.arguments || '{}')
        } catch {
          args = {}
        }

        if (call.function.name === 'query_data') {
          const resource = String(args.resource || '')
          const operation = args.operation === 'get' ? 'get' : 'list'
          if (!isValidResource(resource)) {
            conversation.push({
              role: 'tool',
              tool_call_id: call.id,
              content: JSON.stringify({ error: `Unknown resource "${resource}"` }),
            })
            continue
          }
          const data = await runQuery(origin, resource, operation, {
            id: typeof args.id === 'string' ? args.id : undefined,
            filter: (args.filter as Record<string, string>) || undefined,
          }, cookieHeader)
          conversation.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(data) })
        } else if (call.function.name === 'propose_action') {
          const resource = String(args.resource || '')
          const operation = args.operation as PendingAction['operation']
          if (!isValidResource(resource) || !['create', 'update', 'delete', 'send'].includes(operation)) {
            conversation.push({
              role: 'tool',
              tool_call_id: call.id,
              content: JSON.stringify({ error: 'Invalid resource or operation for propose_action' }),
            })
            continue
          }
          pendingAction = {
            resource,
            operation,
            id: typeof args.id === 'string' ? args.id : undefined,
            data: (args.data as Record<string, unknown>) || undefined,
            summary: String(args.summary || 'Proposed action'),
          }
          stagedThisRound = true
          // Satisfy the tool-call contract so the message list stays valid,
          // but we stop the loop right after, we don't execute anything here.
          conversation.push({
            role: 'tool',
            tool_call_id: call.id,
            content: JSON.stringify({ staged: true, note: 'Awaiting human confirmation in the UI.' }),
          })
        } else {
          conversation.push({
            role: 'tool',
            tool_call_id: call.id,
            content: JSON.stringify({ error: `Unknown tool ${call.function.name}` }),
          })
        }
      }

      if (stagedThisRound) {
        finalText = (result.content && result.content.trim()) || "Here's what I'm proposing, please review and confirm below."
        break
      }
      // otherwise loop again so the model can see the query results and continue
    }

    if (finalText === null) {
      finalText = "I wasn't able to finish that, could you rephrase or narrow it down?"
    }

    return NextResponse.json({ message: finalText, pendingAction })
  } catch (error) {
    console.error('Admin AI assistant error:', error)
    return NextResponse.json({ error: 'Admin assistant unavailable. Please try again.' }, { status: 500 })
  }
}
