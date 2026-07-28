import { NextRequest, NextResponse } from 'next/server'
import { chatWithAI } from '@/lib/openai'

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json()
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Invalid messages array' }, { status: 400 })
    }
    const response = await chatWithAI(messages)
    return NextResponse.json({ response })
  } catch (error) {
    console.error('GitHub Models chat error:', error)
    return NextResponse.json(
      { error: 'AI service unavailable. Please try again.' },
      { status: 500 }
    )
  }
}
