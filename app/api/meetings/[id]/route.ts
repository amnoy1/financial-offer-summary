import { createClient } from '@/lib/supabase/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminSupabaseClient()

  // Delete summaries first (cascade safety)
  await admin.from('summaries').delete().eq('meeting_id', id)

  const { error } = await admin.from('meetings').delete().eq('id', id)
  if (error) return NextResponse.json({ error: 'מחיקה נכשלה' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
