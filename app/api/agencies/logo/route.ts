import { createClient } from '@/lib/supabase/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: agent } = await supabase
    .from('agents')
    .select('agency_id')
    .eq('email', user.email!)
    .single()

  if (!agent) return NextResponse.json({ error: 'סוכן לא נמצא' }, { status: 404 })

  const formData = await request.formData()
  const file = formData.get('logo') as File
  if (!file) return NextResponse.json({ error: 'קובץ חסר' }, { status: 400 })

  const ext = file.name.split('.').pop() ?? 'png'
  const path = `${agent.agency_id}/logo.${ext}`
  const bytes = await file.arrayBuffer()

  const admin = createAdminSupabaseClient()

  const { error: uploadError } = await admin.storage
    .from('logos')
    .upload(path, bytes, { contentType: file.type, upsert: true })

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: { publicUrl } } = admin.storage.from('logos').getPublicUrl(path)

  await admin.from('agencies').update({ logo_url: publicUrl }).eq('id', agent.agency_id)

  return NextResponse.json({ logo_url: publicUrl })
}
