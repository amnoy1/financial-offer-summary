'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const statusLabel: Record<string, string> = {
  recording: '🔴 מקליט',
  uploading: '⬆️ מעלה',
  transcribing: '🔄 מתמלל',
  summarizing: '🤖 מסכם',
  ready: '✅ מוכן',
  error: '❌ שגיאה',
}

const modeLabel: Record<string, string> = {
  live: '🎙️ הקלטה חיה',
  memo: '📝 הערת קול',
  text: '📋 טקסט',
}

export default function ClientPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [client, setClient] = useState<{ name: string; phone: string | null } | null>(null)
  const [meetings, setMeetings] = useState<any[]>([])
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.push('/login')
      else loadData()
    })
  }, [id])

  async function loadData() {
    const { data } = await supabase
      .from('clients')
      .select('id, name, phone, meetings(id, meeting_date, status, mode, summaries(id))')
      .eq('id', id)
      .single()

    if (!data) { router.push('/dashboard'); return }
    setClient({ name: (data as any).name, phone: (data as any).phone ?? null })
    const sorted = ((data as any).meetings ?? []).sort(
      (a: any, b: any) => new Date(b.meeting_date).getTime() - new Date(a.meeting_date).getTime()
    )
    setMeetings(sorted)
  }

  async function deleteMeeting(meetingId: string) {
    if (!confirm('למחוק את הפגישה לצמיתות?')) return
    setDeleting(meetingId)
    const res = await fetch(`/api/meetings/${meetingId}`, { method: 'DELETE' })
    if (res.ok) {
      setMeetings(prev => prev.filter(m => m.id !== meetingId))
    }
    setDeleting(null)
  }

  if (!client) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50" dir="rtl">
      <p className="text-gray-400 text-sm">טוען...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <Link href="/dashboard" className="text-gray-500 text-lg">→</Link>
        <div>
          <h1 className="font-semibold text-gray-900">{client.name}</h1>
          {client.phone && <p className="text-xs text-gray-400">{client.phone}</p>}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <p className="text-xs text-gray-500 font-semibold">{meetings.length} פגישות</p>

        {meetings.length === 0 ? (
          <div className="text-center text-gray-400 py-12 bg-white rounded-2xl border border-gray-200">
            <p className="text-sm">אין פגישות עדיין</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {meetings.map((m: any) => {
              const hasSummary = m.summaries?.length > 0
              return (
                <li key={m.id} className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm">
                      {new Date(m.meeting_date).toLocaleDateString('he-IL', {
                        day: 'numeric', month: 'long', year: 'numeric'
                      })}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{modeLabel[m.mode] ?? m.mode}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {hasSummary && (
                      <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">סיכום</span>
                    )}
                    <span className="text-xs text-gray-400">{statusLabel[m.status] ?? m.status}</span>
                    <Link
                      href={`/meetings/${m.id}`}
                      className="text-xs text-blue-600 border border-blue-200 px-2.5 py-1 rounded-lg hover:bg-blue-50 transition-colors"
                    >
                      ערוך
                    </Link>
                    <button
                      onClick={() => deleteMeeting(m.id)}
                      disabled={deleting === m.id}
                      className="text-xs text-red-500 border border-red-200 px-2.5 py-1 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-40"
                    >
                      {deleting === m.id ? '...' : 'מחק'}
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </main>
    </div>
  )
}
