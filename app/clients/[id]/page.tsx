import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: client } = await supabase
    .from('clients')
    .select(`
      id, name, phone,
      meetings(
        id, meeting_date, status, mode,
        summaries(id)
      )
    `)
    .eq('id', id)
    .single()

  if (!client) redirect('/dashboard')

  const meetings = ((client as any).meetings ?? []).sort(
    (a: any, b: any) => new Date(b.meeting_date).getTime() - new Date(a.meeting_date).getTime()
  )

  const statusLabel: Record<string, string> = {
    recording: '🔴 מקליט',
    uploading: '⬆️ מעלה',
    transcribing: '🔄 מתמלל',
    summarizing: '🤖 מסכם',
    ready: '✅ מוכן',
    error: '❌ שגיאה',
  }

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <Link href="/dashboard" className="text-gray-500 text-lg">→</Link>
        <div>
          <h1 className="font-semibold text-gray-900">{(client as any).name}</h1>
          {(client as any).phone && (
            <p className="text-xs text-gray-400">{(client as any).phone}</p>
          )}
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
                <li key={m.id}>
                  <Link
                    href={`/meetings/${m.id}`}
                    className="flex items-center justify-between bg-white rounded-xl border border-gray-200 px-4 py-3 hover:border-blue-300 transition-colors"
                  >
                    <div>
                      <p className="font-medium text-gray-900 text-sm">
                        {new Date(m.meeting_date).toLocaleDateString('he-IL', {
                          day: 'numeric', month: 'long', year: 'numeric'
                        })}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {m.mode === 'live' ? '🎙️ הקלטה חיה' : '📝 הערת קול'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {hasSummary && (
                        <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">סיכום</span>
                      )}
                      <span className="text-xs">{statusLabel[m.status] ?? m.status}</span>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </main>
    </div>
  )
}
