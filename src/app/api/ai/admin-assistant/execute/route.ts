import { NextRequest, NextResponse } from 'next/server'
import { runAction, isValidResource, isWriteOpAllowed, type AdminOperation } from '@/lib/adminAiTools'

// This endpoint is the ONLY place a proposed AI action actually executes.
// It re-validates everything server-side, the client cannot force an
// unsupported resource/operation combo through even if the payload is tampered with.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const resource = String(body?.resource || '')
    const operation = body?.operation as AdminOperation
    const id = typeof body?.id === 'string' ? body.id : undefined
    const data = (body?.data as Record<string, unknown>) || undefined

    if (!isValidResource(resource)) {
      return NextResponse.json({ error: `Unknown resource "${resource}"` }, { status: 400 })
    }
    if (!operation || !isWriteOpAllowed(resource, operation)) {
      return NextResponse.json({ error: `"${operation}" is not permitted on "${resource}"` }, { status: 400 })
    }
    if ((operation === 'update' || operation === 'delete' || operation === 'send') && !id) {
      return NextResponse.json({ error: `An id is required for ${operation}` }, { status: 400 })
    }

    const origin = req.nextUrl.origin
    const cookieHeader = req.headers.get('cookie') || undefined
    const { ok, status, result } = await runAction(origin, resource, operation, { id, data }, cookieHeader)

    if (!ok) {
      const detailMessage =
        result && typeof result === 'object' && 'error' in (result as Record<string, unknown>)
          ? String((result as Record<string, unknown>).error)
          : 'Action failed'
      return NextResponse.json({ error: detailMessage, detail: result }, { status: status || 500 })
    }
    return NextResponse.json({ success: true, result })
  } catch (error) {
    console.error('Admin AI execute error:', error)
    return NextResponse.json({ error: 'Execution failed' }, { status: 500 })
  }
}
