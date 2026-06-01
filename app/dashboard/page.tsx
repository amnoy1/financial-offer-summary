import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: agent } = await supabase
    .from('agents')
    .select('name, agency:agencies(name)')
    .eq('email', user.email!)
    .single()

  const { data: meetings } = await supabase
    .from('meetings')
    .select(`
      id, meeting_date, status, mode,
      client:clients(name),
      summary:summaries(id)
    `)
    .order('meeting_date', { ascending: false })
    .limit(10)

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
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="font-bold text-gray-900">סיכום פגישות</h1>
          {agent && (
            <p className="text-xs text-gray-500">
              {agent.name} | {(agent.agency as { name: string })?.name}
            </p>
          )}
        </div>
        <form action="/api/auth/signout" method="post">
          <button className="text-xs text-gray-500 hover:text-gray-700">
            יציאה
          </button>
        </form>
      </header>

      {/* Main */}
      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* CTA */}
        <Link
          href="/record"
          className="block w-full bg-blue-600 text-white text-center rounded-2xl py-4 text-lg font-semibold hover:bg-blue-700 transition-colors shadow-sm"
        >
          + פגישה חדשה
        </Link>

        {/* Meetings list */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 mb-3">פגישות אחרונות</h2>
          {!meetings || meetings.length === 0 ? (
            <div className="text-center text-gray-400 py-12 bg-white rounded-2xl border border-gray-200">
              <p className="text-4xl mb-2">🎙️</p>
              <p className="text-sm">אין פגישות עדיין</p>
              <p className="text-xs mt-1">לחץ על "פגישה חדשה" כדי להתחיל</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {meetings.map((m: any) => (
                <li key={m.id}>
                  <Link
                    href={`/meetings/${m.id}`}
                    className="flex items-center justify-between bg-white rounded-xl border border-gray-200 px-4 py-3 hover:border-blue-300 transition-colors"
                  >
                    <div>
                      <p className="font-medium text-gray-900 text-sm">
                        {m.client?.name ?? 'לקוח לא ידוע'}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(m.meeting_date).toLocaleDateString('he-IL')}
                        {' · '}
                        {m.mode === 'live' ? 'הקלטה חיה' : 'הערת קול'}
                      </p>
                    </div>
                    <span className="text-xs">{statusLabel[m.status] ?? m.status}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  )
}
