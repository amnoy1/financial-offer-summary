import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import DashboardHeader from '@/components/DashboardHeader'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: agent } = await supabase
    .from('agents')
    .select('name, agency:agencies(name, logo_url)')
    .eq('email', user.email!)
    .single()

  const agency = (agent?.agency as unknown as { name: string; logo_url: string | null }) ?? null

  const { data: clients } = await supabase
    .from('clients')
    .select(`
      id, name,
      meetings(id, meeting_date, status, summaries(id))
    `)
    .order('name', { ascending: true })

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <form action="/api/auth/signout" method="post">
            <button className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5">
              יציאה
            </button>
          </form>
          <DashboardHeader
            agencyName={agency?.name ?? null}
            agentName={agent?.name ?? null}
            logoUrl={agency?.logo_url ?? null}
          />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* CTA */}
        <Link
          href="/record"
          className="block w-full bg-blue-600 text-white text-center rounded-2xl py-4 text-lg font-semibold hover:bg-blue-700 transition-colors shadow-sm"
        >
          + פגישה חדשה
        </Link>

        {/* Clients table */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 mb-3">לקוחות</h2>
          {!clients || clients.length === 0 ? (
            <div className="text-center text-gray-400 py-12 bg-white rounded-2xl border border-gray-200">
              <p className="text-4xl mb-2">🎙️</p>
              <p className="text-sm">אין לקוחות עדיין</p>
              <p className="text-xs mt-1">לחץ על "פגישה חדשה" כדי להתחיל</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              {/* Table header */}
              <div className="grid grid-cols-3 px-4 py-2 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500">
                <span>שם לקוח</span>
                <span className="text-center">פגישות</span>
                <span className="text-center">סיכומים</span>
              </div>
              {clients.map((c: any, i: number) => {
                const meetings = c.meetings ?? []
                const summaryCount = meetings.filter((m: any) => m.summaries?.length > 0).length
                const lastMeeting = meetings.sort((a: any, b: any) =>
                  new Date(b.meeting_date).getTime() - new Date(a.meeting_date).getTime()
                )[0]
                return (
                  <Link
                    key={c.id}
                    href={`/clients/${c.id}`}
                    className={`grid grid-cols-3 px-4 py-3 items-center hover:bg-blue-50 transition-colors ${i < clients.length - 1 ? 'border-b border-gray-100' : ''}`}
                  >
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{c.name}</p>
                      {lastMeeting && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(lastMeeting.meeting_date).toLocaleDateString('he-IL')}
                        </p>
                      )}
                    </div>
                    <p className="text-center text-sm text-gray-600">{meetings.length}</p>
                    <p className="text-center text-sm">
                      {summaryCount > 0 ? (
                        <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs">{summaryCount}</span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </p>
                  </Link>
                )
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
