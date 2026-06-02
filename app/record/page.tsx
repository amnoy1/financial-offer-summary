'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Step = 'setup' | 'recording' | 'uploading' | 'transcribing' | 'done' | 'error'
type Mode = 'live' | 'memo'

const STEPS = [
  { key: 'uploading', label: 'מעלה קובץ...' },
  { key: 'transcribing', label: 'מתמלל בעברית...' },
  { key: 'done', label: 'מוכן לסיכום' },
]

export default function RecordPage() {
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState<Step>('setup')
  const [mode, setMode] = useState<Mode>('live')
  const [clientName, setClientName] = useState('')
  const [clientId, setClientId] = useState<string | null>(null)
  const [clients, setClients] = useState<{ id: string; name: string }[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [timer, setTimer] = useState(0)
  const [error, setError] = useState('')

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // בדיקת auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.push('/login')
    })
  }, [])

  // שלוף לקוחות
  useEffect(() => {
    supabase.from('clients').select('id, name').order('name').then(({ data }) => {
      if (data) setClients(data)
    })
  }, [])

  // טיימר
  useEffect(() => {
    if (step === 'recording') {
      timerRef.current = setInterval(() => setTimer(t => t + 1), 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [step])

  const formatTime = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`

  const filteredClients = clients.filter(c =>
    clientName.length > 0 && c.name.includes(clientName)
  )

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []

      const recorder = new MediaRecorder(stream)
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = handleStop

      recorder.start(1000)
      mediaRecorderRef.current = recorder
      setTimer(0)
      setStep('recording')
    } catch {
      setError('לא ניתן לגשת למיקרופון — אשר הרשאה בדפדפן')
      setStep('error')
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop()
    streamRef.current?.getTracks().forEach(t => t.stop())
  }

  const handleStop = useCallback(async () => {
    setStep('uploading')

    const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
    const formData = new FormData()
    formData.append('audio', blob, 'recording.webm')
    formData.append('mode', mode)
    if (clientId) {
      formData.append('client_id', clientId)
    } else {
      formData.append('client_name', clientName)
    }

    try {
      const uploadRes = await fetch('/api/recordings/upload', {
        method: 'POST',
        body: formData,
      })
      if (!uploadRes.ok) {
        const errData = await uploadRes.json().catch(() => ({}))
        throw new Error(errData.error || `upload ${uploadRes.status}`)
      }
      const { meeting_id } = await uploadRes.json()

      setStep('transcribing')

      const transcribeRes = await fetch('/api/recordings/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meeting_id }),
      })
      if (!transcribeRes.ok) {
        const errData = await transcribeRes.json().catch(() => ({}))
        throw new Error(errData.error || `transcribe ${transcribeRes.status}`)
      }

      setStep('done')
      setTimeout(() => router.push(`/meetings/${meeting_id}`), 800)
    } catch (err: any) {
      setError(`שגיאה בעיבוד: ${err.message}`)
      setStep('error')
    }
  }, [mode, clientId, clientName, router])

  const currentStepIndex = STEPS.findIndex(s => s.key === step)

  // ── UI ──────────────────────────────────────────

  if (step === 'error') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-gray-50" dir="rtl">
        <p className="text-4xl mb-4">❌</p>
        <p className="text-red-600 font-medium text-center">{error}</p>
        <button
          onClick={() => { setStep('setup'); setError('') }}
          className="mt-6 px-6 py-2 bg-blue-600 text-white rounded-full text-sm"
        >
          נסה שוב
        </button>
      </div>
    )
  }

  if (step !== 'setup' && step !== 'recording') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-gray-50" dir="rtl">
        <p className="text-5xl mb-6">⏳</p>
        <h2 className="text-xl font-bold mb-8 text-gray-800">מעבד הקלטה...</h2>
        <div className="w-full max-w-xs space-y-3">
          {STEPS.map((s, i) => {
            const done = i < currentStepIndex
            const active = i === currentStepIndex
            return (
              <div key={s.key} className="flex items-center gap-3">
                <span className="text-lg w-6">
                  {done ? '✅' : active ? '🔄' : '⏳'}
                </span>
                <span className={`text-sm ${active ? 'font-semibold text-blue-700' : done ? 'text-gray-400' : 'text-gray-400'}`}>
                  {s.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  if (step === 'recording') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-gray-50" dir="rtl">
        <p className="text-gray-500 text-sm mb-2">{mode === 'live' ? 'הקלטה חיה' : 'הערת קול'}</p>
        <p className="text-gray-800 font-semibold mb-8">{clientName}</p>

        {/* Timer */}
        <div className="text-5xl font-mono font-bold text-gray-900 mb-10 tabular-nums">
          {formatTime(timer)}
        </div>

        {/* Pulse animation */}
        <div className="relative mb-10">
          <div className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-30 scale-150" />
          <button
            onClick={stopRecording}
            className="relative w-24 h-24 rounded-full bg-red-500 flex items-center justify-center shadow-lg active:scale-95 transition-transform"
          >
            <div className="w-10 h-10 bg-white rounded-md" />
          </button>
        </div>

        <p className="text-sm text-gray-400">לחץ לעצירה ועיבוד</p>
      </div>
    )
  }

  // ── Setup ─────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.push('/dashboard')} className="text-gray-500 text-lg">→</button>
        <h1 className="font-semibold text-gray-900">פגישה חדשה</h1>
      </header>

      <main className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* Client */}
        <div className="relative">
          <label className="block text-sm font-medium text-gray-700 mb-1">שם הלקוח</label>
          <input
            type="text"
            value={clientName}
            onChange={e => {
              setClientName(e.target.value)
              setClientId(null)
              setShowSuggestions(true)
            }}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            onFocus={() => setShowSuggestions(true)}
            placeholder="חפש או הכנס שם חדש..."
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {showSuggestions && filteredClients.length > 0 && (
            <ul className="absolute z-10 w-full bg-white border border-gray-200 rounded-xl mt-1 shadow-lg overflow-hidden">
              {filteredClients.map(c => (
                <li
                  key={c.id}
                  onMouseDown={() => {
                    setClientName(c.name)
                    setClientId(c.id)
                    setShowSuggestions(false)
                  }}
                  className="px-4 py-2.5 text-sm hover:bg-blue-50 cursor-pointer"
                >
                  {c.name}
                </li>
              ))}
            </ul>
          )}
          {clientName && !clientId && (
            <p className="text-xs text-blue-600 mt-1">+ לקוח חדש יווצר</p>
          )}
        </div>

        {/* Mode */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">סוג הקלטה</label>
          <div className="grid grid-cols-2 gap-2">
            {([['live', '🎙️ הקלטה חיה', 'בזמן אמת מהפגישה'], ['memo', '📝 הערת קול', 'סיכום לאחר פגישה']] as const).map(([val, title, desc]) => (
              <button
                key={val}
                onClick={() => setMode(val)}
                className={`p-3 rounded-xl border-2 text-right transition-colors ${
                  mode === val
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <p className="text-sm font-medium">{title}</p>
                <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Start button */}
        <button
          onClick={startRecording}
          disabled={!clientName.trim()}
          className="w-full bg-red-500 text-white rounded-2xl py-5 text-lg font-bold disabled:opacity-40 shadow-sm active:scale-98 transition-transform"
        >
          🎙️ התחל הקלטה
        </button>
      </main>
    </div>
  )
}
