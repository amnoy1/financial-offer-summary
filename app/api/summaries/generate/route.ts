import { createClient } from '@/lib/supabase/server'
import { anthropic } from '@/lib/anthropic'
import { FINANCIAL_SYSTEM_PROMPT, buildUserPrompt } from '@/lib/anthropic/prompt'
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { meeting_id } = await request.json()

  // שלוף פגישה + לקוח
  const { data: meeting } = await supabase
    .from('meetings')
    .select(`
      id, transcript, meeting_date, status,
      client:clients(name, phone)
    `)
    .eq('id', meeting_id)
    .single()

  if (!meeting?.transcript) {
    return NextResponse.json({ error: 'תמליל לא נמצא' }, { status: 404 })
  }

  const client = meeting.client as unknown as { name: string; phone: string | null } | null
  const meetingDate = new Date(meeting.meeting_date).toISOString().split('T')[0]

  // שלח ל-Claude
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: FINANCIAL_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: buildUserPrompt(
          meeting.transcript,
          client?.name ?? 'לא ידוע',
          meetingDate,
        ),
      },
    ],
  })

  const rawText = message.content[0].type === 'text' ? message.content[0].text : ''

  // נקה JSON מתוך התגובה (אם יש ```)
  const jsonMatch = rawText.match(/```json\s*([\s\S]*?)\s*```/) ||
                    rawText.match(/```\s*([\s\S]*?)\s*```/)
  const jsonText = jsonMatch ? jsonMatch[1] : rawText.trim()

  let content: object
  try {
    content = JSON.parse(jsonText)
  } catch {
    return NextResponse.json({ error: 'Claude החזיר JSON לא תקין', raw: rawText }, { status: 500 })
  }

  // שמור סיכום
  const { data: summary, error: summaryError } = await supabase
    .from('summaries')
    .insert({ meeting_id, content })
    .select('id')
    .single()

  if (summaryError) {
    return NextResponse.json({ error: 'שמירת סיכום נכשלה' }, { status: 500 })
  }

  // עדכן סטטוס פגישה
  await supabase
    .from('meetings')
    .update({ status: 'ready' })
    .eq('id', meeting_id)

  return NextResponse.json({ summary_id: summary.id, content })
}
