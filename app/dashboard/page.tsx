import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import DashboardHeader from '@/components/DashboardHeader'

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-violet-500', 'bg-emerald-500', 'bg-orange-500',
  'bg-pink-500', 'bg-teal-500', 'bg-indigo-500', 'bg-rose-500',
]

function avatarColor(name: string) {
  return AVATAR_COLORS[(name.charCodeAt(0) ?? 0) % AVATAR_COLORS.length]
}

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
    .select('id, name, meetings(id, meeting_date, status, summaries(id))')
    .order('name', { ascending: true })

  const allClients = clients ?? []
  const totalMeetings = allClients.reduce((s, c) => s + ((c as any).meetings?.length ?? 0), 0)
  const totalSummaries = allClients.reduce((s, c) =>
    s + ((c as any).meetings?.filter((m: any) => m.summaries?.length > 0).length ?? 0), 0)

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">

      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 pt-5 pb-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-1">
            <form action="/api/auth/signout" method="post">
              <button className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 transition-colors">
                יציאה
              </button>
            </form>
            <DashboardHeader
              agencyName={agency?.name ?? null}
              agentName={agent?.name ?? null}
              logoUrl={agency?.logo_url ?? null}
            />
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* CTA */}
        <Link
          href="/record"
          className="flex items-center justify-center gap-2 w-full bg-blue-600 text-white rounded-2xl py-4 text-base font-semibold hover:bg-blue-700 active:bg-blue-800 transition-colors shadow-sm"
        >
          <span className="text-xl">+</span>
          <span>פגישה חדשה</span>
        </Link>

        {/* Stats */}
        {allClients.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'לקוחות', value: allClients.length, icon: '👥' },
              { label: 'פגישות', value: totalMeetings, icon: '🎙️' },
              { label: 'סיכומים', value: totalSummaries, icon: '📄' },
            ].map(stat => (
              <div key={stat.label} className="bg-white rounded-2xl border border-gray-200 px-3 py-3 text-center">
                <p className="text-xl mb-1">{stat.icon}</p>
                <p className="text-2xl font-bold text-gray-900 leading-none">{stat.value}</p>
                <p className="text-xs text-gray-400 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Clients list */}
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-1">לקוחות</h2>

          {allClients.length === 0 ? (
            <div className="text-center text-gray-400 py-16 bg-white rounded-2xl border border-dashed border-gray-300">
              <p className="text-5xl mb-3">🎙️</p>
              <p className="text-sm font-medium text-gray-500">אין לקוחות עדיין</p>
              <p className="text-xs mt-1 text-gray-400">לחץ על &quot;פגישה חדשה&quot; כדי להתחיל</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
              {allClients.map((c: any) => {
                const meetings = (c.meetings ?? []) as any[]
                const summaryCount = meetings.filter((m: any) => m.summaries?.length > 0).length
                const lastMeeting = [...meetings].sort((a, b) =>
                  new Date(b.meeting_date).getTime() - new Date(a.meeting_date).getTime()
                )[0]
                const initials = c.name.trim().slice(0, 2)

                return (
                  <Link
                    key={c.id}
                    href={`/clients/${c.id}`}
                    className="flex items-center gap-3 px-4 py-3.5 hover:bg-blue-50 transition-colors"
                  >
                    {/* Avatar */}
                    <div className={`w-10 h-10 rounded-full ${avatarColor(c.name)} flex items-center justify-center shrink-0`}>
                      <span className="text-white font-semibold text-sm">{initials}</span>
                    </div>

                    {/* Name + date */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm leading-tight">{c.name}</p>
                      {lastMeeting ? (
                        <p className="text-xs text-gray-400 mt-0.5">
                          פגישה אחרונה: {new Date(lastMeeting.meeting_date).toLocaleDateString('he-IL')}
                        </p>
                      ) : (
                        <p className="text-xs text-gray-300 mt-0.5">אין פגישות</p>
                      )}
                    </div>

                    {/* Badges */}
                    <div className="flex items-center gap-2 shrink-0">
                      {meetings.length > 0 && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                          {meetings.length} פגישות
                        </span>
                      )}
                      {summaryCount > 0 && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                          {summaryCount} ✓
                        </span>
                      )}
                      <span className="text-gray-300 text-lg">←</span>
                    </div>
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
