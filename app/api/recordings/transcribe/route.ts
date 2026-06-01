import { createClient } from '@/lib/supabase/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { groq } from '@/lib/groq'
import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { meeting_id } = await request.json()

  // שלוף את הפגישה
  const { data: meeting } = await supabase
    .from('meetings')
    .select('id, recording_url')
    .eq('id', meeting_id)
    .single()

  if (!meeting?.recording_url) {
    return NextResponse.json({ error: 'פגישה לא נמצאה' }, { status: 404 })
  }

  // הורד אודיו מה-Storage
  const admin = createAdminSupabaseClient()
  const { data: audioBlob, error: downloadError } = await admin.storage
    .from('recordings')
    .download(meeting.recording_url)

  if (downloadError || !audioBlob) {
    return NextResponse.json({ error: 'הורדת אודיו נכשלה' }, { status: 500 })
  }

  // תמלל עם Groq Whisper
  const audioFile = new File([audioBlob], 'recording.webm', { type: 'audio/webm' })

  const transcription = await groq.audio.transcriptions.create({
    file: audioFile,
    model: 'whisper-large-v3',
    language: 'he',
    response_format: 'text',
  })

  const transcript = typeof transcription === 'string' ? transcription : (transcription as any).text

  // עדכן פגישה עם תמליל + מחק אודיו
  await Promise.all([
    supabase
      .from('meetings')
      .update({ transcript, status: 'summarizing', recording_url: null })
      .eq('id', meeting_id),
    admin.storage
      .from('recordings')
      .remove([meeting.recording_url]),
  ])

  return NextResponse.json({ transcript, meeting_id })
}
