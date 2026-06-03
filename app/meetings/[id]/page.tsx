'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type SummaryContent = {
  client: { name: string; phone: string | null; meeting_date: string }
  topics_discussed: string[]
  financial_profile: {
    pension: string | null
    free_capital: string | null
    existing_products: Array<{
      type: string; company: string | null
      monthly: number | null; total: number | null; coverage: number | null
    }>
  }
  recommendations: string[]
  tax_notes: string[]
  action_items: Array<{ task: string; due_date: string; owner: 'agent' | 'client' }>
}

export default function MeetingPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [status, setStatus] = useState<string>('loading')
  const [meetingType, setMeetingType] = useState<string | null>(null)
  const [content, setContent] = useState<SummaryContent | null>(null)
  const [summaryId, setSummaryId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const [error, setError] = useState('')
  const [includeTaxNotes, setIncludeTaxNotes] = useState(true)
  const [includeActionItems, setIncludeActionItems] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.push('/login')
      else loadMeeting()
    })
  }, [id])

  async function loadMeeting() {
    const { data: meeting } = await supabase
      .from('meetings')
      .select('id, status, meeting_type, summaries(id, content)')
      .eq('id', id)
      .single()

    if (!meeting) { setError('פגישה לא נמצאה'); setStatus('error'); return }

    setMeetingType((meeting as any).meeting_type ?? null)
    const summaries = (meeting.summaries as any[]) ?? []

    if (summaries.length > 0) {
      // סיכום קיים — טוען מה-DB ישירות, ללא קריאה ל-Claude
      setContent(summaries[0].content as SummaryContent)
      setSummaryId(summaries[0].id)
      setStatus('ready')
    } else if (meeting.status === 'summarizing') {
      // פגישה חדשה שעדיין לא סוכמה — הפעל Claude
      setStatus('summarizing')
      await generateSummary()
    } else {
      // סטטוס אחר (ready ללא סיכום, error וכו') — הצג שגיאה
      setError('לא נמצא סיכום לפגישה זו')
      setStatus('error')
    }
  }

  async function generateSummary() {
    try {
      const res = await fetch('/api/summaries/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meeting_id: id }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setError(err.error || 'יצירת סיכום נכשלה')
        setStatus('error')
        return
      }

      const { summary_id, content } = await res.json()
      setContent(content as SummaryContent)
      setSummaryId(summary_id)
      setStatus('ready')
    } catch {
      setError('שגיאת רשת — לא הצלחנו ליצור סיכום')
      setStatus('error')
    }
  }

  async function saveChanges() {
    if (!summaryId || !content) return
    setSaving(true)
    const savedContent = {
      ...content,
      tax_notes: (meetingType === 'pre_treatment' && !includeTaxNotes) ? [] : content.tax_notes,
      action_items: (meetingType === 'pre_treatment' && !includeActionItems) ? [] : content.action_items,
    }
    await supabase
      .from('summaries')
      .update({ content: savedContent, edited_by_agent: true })
      .eq('id', summaryId)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function updateRecommendation(i: number, val: string) {
    setContent(c => c ? { ...c, recommendations: c.recommendations.map((r, j) => j === i ? val : r) } : c)
  }

  async function downloadPdf() {
    if (!summaryId) return
    setGeneratingPdf(true)
    const res = await fetch('/api/summaries/pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ summary_id: summaryId }),
    })
    if (res.ok) {
      const { pdf_url } = await res.json()
      window.open(pdf_url, '_blank')
    }
    setGeneratingPdf(false)
  }

  function updateActionItem(i: number, field: string, val: string) {
    setContent(c => c ? {
      ...c,
      action_items: c.action_items.map((a, j) => j === i ? { ...a, [field]: val } : a)
    } : c)
  }

  // ── States ─────────────────────────────────────

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50" dir="rtl">
        <p className="text-gray-400 text-sm">טוען...</p>
      </div>
    )
  }

  if (status === 'summarizing') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50" dir="rtl">
        <p className="text-4xl mb-4">🤖</p>
        <p className="font-semibold text-gray-800 mb-2">מנתח ומסכם...</p>
        <p className="text-sm text-gray-400">Claude Sonnet מעבד את הפגישה</p>
        <div className="mt-6 w-48 h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 rounded-full animate-pulse w-3/4" />
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-gray-50" dir="rtl">
        <p className="text-4xl mb-3">❌</p>
        <p className="text-red-600 text-center">{error}</p>
        <button onClick={() => router.push('/dashboard')} className="mt-4 text-sm text-blue-600 underline">
          חזור ל-Dashboard
        </button>
      </div>
    )
  }

  if (!content) return null

  // ── Summary Editor ─────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/dashboard')} className="text-gray-500 text-lg">→</button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-semibold text-gray-900 text-sm">{content.client.name}</h1>
              {meetingType && (() => {
                const badges: Record<string, { label: string; cls: string }> = {
                  pre_treatment: { label: '🗂️ טרום טיפול', cls: 'bg-gray-100 text-gray-600' },
                  recommendations: { label: '💡 המלצות', cls: 'bg-blue-100 text-blue-700' },
                  service: { label: '🔧 שרות', cls: 'bg-orange-100 text-orange-700' },
                }
                const b = badges[meetingType]
                return b ? <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${b.cls}`}>{b.label}</span> : null
              })()}
            </div>
            <p className="text-xs text-gray-400">{content.client.meeting_date}</p>
          </div>
        </div>
        <button
          onClick={saveChanges}
          disabled={saving}
          className="text-sm bg-blue-600 text-white px-4 py-1.5 rounded-full disabled:opacity-50"
        >
          {saved ? '✓ נשמר' : saving ? 'שומר...' : 'שמור'}
        </button>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5 space-y-5 pb-28">

        {/* נושאים */}
        <section className="bg-white rounded-2xl border border-gray-200 p-4">
          <h2 className="font-semibold text-gray-700 text-sm mb-2">
            {meetingType === 'pre_treatment' ? 'נושאים שנבדקו' : 'נושאים שנדונו'}
          </h2>
          <div className="flex flex-wrap gap-2">
            {content.topics_discussed.map((t, i) => (
              <span key={i} className="bg-blue-50 text-blue-700 text-xs px-3 py-1 rounded-full">
                {t}
              </span>
            ))}
          </div>
        </section>

        {/* מוצרים קיימים */}
        {content.financial_profile.existing_products.length > 0 && (
          <section className="bg-white rounded-2xl border border-gray-200 p-4">
            <h2 className="font-semibold text-gray-700 text-sm mb-3">מוצרים קיימים</h2>
            <div className="space-y-2">
              {content.financial_profile.existing_products.map((p, i) => (
                <div key={i} className="flex justify-between items-start text-sm border-b border-gray-100 pb-2 last:border-0">
                  <div>
                    <p className="font-semibold text-gray-900">{p.type}</p>
                    {p.company && <p className="text-xs text-gray-600 font-medium">{p.company}</p>}
                  </div>
                  <div className="text-left text-xs text-gray-700 font-medium space-y-0.5">
                    {p.monthly != null && <p>{p.monthly.toLocaleString()} ₪/חודש</p>}
                    {p.total != null && <p>סה״כ: {p.total.toLocaleString()} ₪</p>}
                    {p.coverage != null && <p>כיסוי: {p.coverage.toLocaleString()} ₪</p>}
                  </div>
                </div>
              ))}
            </div>
            {content.financial_profile.pension && (
              <p className="text-xs text-gray-500 mt-3 pt-2 border-t border-gray-100">
                <span className="font-medium">פנסיה: </span>{content.financial_profile.pension}
              </p>
            )}
            {content.financial_profile.free_capital && (
              <p className="text-xs text-gray-500 mt-1">
                <span className="font-medium">כסף פנוי: </span>{content.financial_profile.free_capital}
              </p>
            )}
          </section>
        )}

        {/* המלצות ✏️ — hidden for pre_treatment */}
        {meetingType !== 'pre_treatment' && (
          <section className="bg-white rounded-2xl border border-gray-200 p-4">
            <h2 className="font-semibold text-gray-700 text-sm mb-3">המלצות הסוכן ✏️</h2>
            <div className="space-y-2">
              {content.recommendations.map((r, i) => (
                <textarea
                  key={i}
                  value={r}
                  onChange={e => updateRecommendation(i, e.target.value)}
                  rows={2}
                  className="w-full text-sm text-gray-900 border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              ))}
            </div>
          </section>
        )}

        {/* הערות מס */}
        {content.tax_notes.length > 0 && (
          <section className="bg-amber-50 rounded-2xl border border-amber-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold text-amber-800 text-sm">הערות מס</h2>
              {meetingType === 'pre_treatment' && (
                <label className="flex items-center gap-1.5 text-xs text-amber-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeTaxNotes}
                    onChange={e => setIncludeTaxNotes(e.target.checked)}
                    className="w-3.5 h-3.5 accent-amber-600"
                  />
                  כלול בסיכום
                </label>
              )}
            </div>
            {includeTaxNotes && (
              <ul className="space-y-1">
                {content.tax_notes.map((t, i) => (
                  <li key={i} className="text-xs text-amber-700 flex gap-2">
                    <span>•</span><span>{t}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* משימות ✏️ */}
        <section className="bg-white rounded-2xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-700 text-sm">משימות וצעדי המשך ✏️</h2>
            {meetingType === 'pre_treatment' && (
              <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeActionItems}
                  onChange={e => setIncludeActionItems(e.target.checked)}
                  className="w-3.5 h-3.5 accent-blue-600"
                />
                כלול בסיכום
              </label>
            )}
          </div>
          {includeActionItems && <div className="space-y-3">
            {content.action_items.map((a, i) => (
              <div key={i} className="flex gap-2 items-start">
                <span className="text-lg mt-0.5">{a.owner === 'agent' ? '👤' : '🧑‍💼'}</span>
                <div className="flex-1 space-y-1">
                  <input
                    value={a.task}
                    onChange={e => updateActionItem(i, 'task', e.target.value)}
                    className="w-full text-sm text-gray-900 border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                  <div className="flex gap-2 text-xs">
                    <span className={`px-2 py-0.5 rounded-full ${a.owner === 'agent' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                      {a.owner === 'agent' ? 'סוכן' : 'לקוח'}
                    </span>
                    <input
                      type="date"
                      value={a.due_date}
                      onChange={e => updateActionItem(i, 'due_date', e.target.value)}
                      className="border border-gray-200 rounded px-1.5 py-0.5 text-xs text-gray-900 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>}
        </section>
      </main>

      {/* Bottom bar */}
      <div className="fixed bottom-0 right-0 left-0 bg-white border-t border-gray-200 p-4 flex gap-3 max-w-2xl mx-auto">
        <button
          onClick={saveChanges}
          disabled={saving}
          className="flex-1 bg-blue-600 text-white rounded-xl py-3 font-semibold text-sm disabled:opacity-50"
        >
          {saved ? '✓ נשמר!' : saving ? 'שומר...' : 'אשר ושמור'}
        </button>
        <button
          onClick={downloadPdf}
          disabled={generatingPdf}
          className="flex-1 border border-blue-600 text-blue-600 rounded-xl py-3 font-semibold text-sm disabled:opacity-50"
        >
          {generatingPdf ? '⏳ מייצר...' : '📄 הורד PDF'}
        </button>
      </div>
    </div>
  )
}
