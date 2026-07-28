import { NextRequest, NextResponse } from 'next/server'
import { analyzeAndRoute } from '@/lib/openai'

export async function POST(req: NextRequest) {
  try {
    const { type, data } = await req.json()
    if (!type || !data) {
      return NextResponse.json({ error: 'type and data required' }, { status: 400 })
    }
    const result = await analyzeAndRoute(type, data)
    return NextResponse.json(result)
  } catch (error) {
    console.error('AI routing error:', error)
    // Return safe defaults so submission still goes through
    return NextResponse.json({
      suggested_type: 'contact',
      confidence: 0,
      routing_reason: 'AI analysis unavailable',
      summary: 'Submission received',
      priority_score: 5,
    })
  }
}
