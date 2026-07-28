import { NextRequest, NextResponse } from 'next/server'
import { draftCampaignEmail } from '@/lib/openai'

export async function POST(req: NextRequest) {
  try {
    const { subject, audience } = await req.json()
    if (!subject) {
      return NextResponse.json({ error: 'subject required' }, { status: 400 })
    }
    const html = await draftCampaignEmail(subject, audience || 'general subscribers')
    return NextResponse.json({ html })
  } catch (error) {
    console.error('AI email draft error:', error)
    return NextResponse.json({ error: 'Draft generation failed' }, { status: 500 })
  }
}
