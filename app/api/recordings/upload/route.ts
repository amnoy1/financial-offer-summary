import { createClient } from '@/lib/supabase/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 30

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await request.formData()
  const audioFile = formData.get('audio') as File | null
  const clientId = formData.get('client_id') as string | null
  const clientName = formData.get('client_name') as string | null
  const mode = (formData.get('mode') as string) || 'live'

  if (!audioFile) {
    return NextResponse.json({ error: 'קובץ אודיו חסר' }, { status: 400 })
  }

  // מצא את הסוכן
  const { data: agent } = await supabase
    .from('agents')
    .select('id, agency_id')
    .eq('email', user.email!)
    .single()

  if (!agent) {
    return NextResponse.json({ error: 'סוכן לא נמצא' }, { status: 404 })
  }

  // טפל בלקוח
  let finalClientId = clientId

  if (!finalClientId && clientName) {
    const { data: newClient, error: clientError } = await supabase
      .from('clients')
      .insert({ agency_id: agent.agency_id, name: clientName.trim() })
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

  // העלה אודיו ל-Storage
  const admin = createAdminSupabaseClient()
  const filename = `${agent.agency_id}/${Date.now()}.webm`
  const buffer = Buffer.from(await audioFile.arrayBuffer())

  const { error: uploadError } = await admin.storage
    .from('recordings')
    .upload(filename, buffer, { contentType: 'audio/webm' })

  if (uploadError) {
    return NextResponse.json({ error: 'העלאה נכשלה', details: uploadError.message }, { status: 500 })
  }

  // צור רשומת פגישה
  const { data: meeting, error: meetingError } = await supabase
    .from('meetings')
    .insert({
      agent_id: agent.id,
      client_id: finalClientId,
      meeting_date: new Date().toISOString(),
      recording_url: filename,
      mode,
      status: 'transcribing',
    })
    .select('id')
    .single()

  if (meetingError) {
    return NextResponse.json({ error: 'יצירת פגישה נכשלה' }, { status: 500 })
  }

  return NextResponse.json({ meeting_id: meeting.id })
}
