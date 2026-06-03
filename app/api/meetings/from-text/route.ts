import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 30

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { agent_id, client_id, client_name, text, meeting_type } = await request.json()

  if (!text?.trim()) {
    return NextResponse.json({ error: 'טקסט חסר' }, { status: 400 })
  }

  // מצא את הסוכן
  let finalAgentId = agent_id
  let agencyId: string

  if (finalAgentId) {
    const { data: agent } = await supabase
      .from('agents')
      .select('id, agency_id')
      .eq('id', finalAgentId)
      .single()
    if (!agent) return NextResponse.json({ error: 'סוכן לא נמצא' }, { status: 404 })
    agencyId = agent.agency_id
  } else {
    const { data: agent } = await supabase
      .from('agents')
      .select('id, agency_id')
      .eq('email', user.email!)
      .single()
    if (!agent) return NextResponse.json({ error: 'סוכן לא נמצא' }, { status: 404 })
    finalAgentId = agent.id
    agencyId = agent.agency_id
  }

  // טפל בלקוח
  let finalClientId = client_id

  if (!finalClientId && client_name) {
    const { data: newClient, error: clientError } = await supabase
      .from('clients')
      .insert({ agency_id: agencyId, name: client_name.trim() })
      .select('id')
      .single()

    if (clientError) {
      return NextResponse.json({ error: 'יצירת לקוח נכשלה' }, { status: 500 })
    }
    finalClientId = newClient.id
  }

  if (!finalClientId) {
    return NextResponse.json({ error: 'נדרש שם לקוח' }, { status: 400 })
  }

  // צור פגישה עם הטקסט כתמליל
  const { data: meeting, error: meetingError } = await supabase
    .from('meetings')
    .insert({
      agent_id: finalAgentId,
      client_id: finalClientId,
      meeting_date: new Date().toISOString(),
      transcript: text.trim(),
      mode: 'text',
      meeting_type: meeting_type || 'pre_treatment',
      status: 'summarizing',
    })
    .select('id')
    .single()

  if (meetingError || !meeting) {
    return NextResponse.json({ error: 'יצירת פגישה נכשלה' }, { status: 500 })
  }

  return NextResponse.json({ meeting_id: meeting.id })
}
