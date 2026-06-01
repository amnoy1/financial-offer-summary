import { createClient } from '@/lib/supabase/server'
import { createAdminSupabaseClient } from '@/lib/supabase/admin'
import { renderToBuffer } from '@react-pdf/renderer'
import { SummaryPDF } from '@/components/PDFTemplate'
import { NextRequest, NextResponse } from 'next/server'
import React from 'react'

export const maxDuration = 60

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { summary_id } = await request.json()

  // שלוף סיכום + פגישה + סוכן + סוכנות
  const { data: summary } = await supabase
    .from('summaries')
    .select(`
      id, content,
      meeting:meetings(
        id,
        client:clients(name),
        agent:agents(
          name,
          agency:agencies(name, logo_url)
        )
      )
    `)
    .eq('id', summary_id)
    .single()

  if (!summary) {
    return NextResponse.json({ error: 'סיכום לא נמצא' }, { status: 404 })
  }

  const meeting = summary.meeting as any
  const agent = meeting?.agent
  const agency = agent?.agency

  // צור PDF
  const pdfBuffer = await renderToBuffer(
    React.createElement(SummaryPDF, {
      content: summary.content as any,
      agencyName: agency?.name ?? 'סוכנות',
      agentName: agent?.name ?? '',
      logoUrl: agency?.logo_url ?? null,
    })
  )

  // שמור PDF ל-Storage
  const admin = createAdminSupabaseClient()
  const filename = `${meeting.id}/${summary_id}.pdf`

  await admin.storage
    .from('pdfs')
    .upload(filename, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true,
    })

  // צור Signed URL (24 שעות)
  const { data: signedUrlData } = await admin.storage
    .from('pdfs')
    .createSignedUrl(filename, 60 * 60 * 24)

  if (!signedUrlData?.signedUrl) {
    return NextResponse.json({ error: 'יצירת URL נכשלה' }, { status: 500 })
  }

  // עדכן pdf_url בסיכום
  await supabase
    .from('summaries')
    .update({ pdf_url: filename })
    .eq('id', summary_id)

  return NextResponse.json({ pdf_url: signedUrlData.signedUrl })
}
