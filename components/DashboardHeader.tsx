'use client'

import { useRef, useState } from 'react'

interface Props {
  agencyName: string | null
  agentName: string | null
  logoUrl: string | null
}

export default function DashboardHeader({ agencyName, agentName, logoUrl: initialLogoUrl }: Props) {
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const formData = new FormData()
    formData.append('logo', file)
    const res = await fetch('/api/agencies/logo', { method: 'POST', body: formData })
    if (res.ok) {
      const { logo_url } = await res.json()
      setLogoUrl(logo_url + '?t=' + Date.now())
    }
    setUploading(false)
    e.target.value = ''
  }

  return (
    <div className="flex items-center gap-4">
      <div className="relative group">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          title="לחץ לשינוי לוגו"
          className="relative w-14 h-14 rounded-xl border border-gray-200 overflow-hidden hover:opacity-80 transition-opacity focus:outline-none shadow-sm"
        >
          {logoUrl ? (
            <img src={logoUrl} alt={agencyName ?? ''} className="w-full h-full object-contain p-1" />
          ) : (
            <div className="w-full h-full bg-gray-50 flex flex-col items-center justify-center text-gray-400 gap-0.5">
              {uploading ? (
                <span className="text-xl">⏳</span>
              ) : (
                <>
                  <span className="text-xl">🏢</span>
                  <span className="text-[9px] text-gray-300">לוגו</span>
                </>
              )}
            </div>
          )}
          {!uploading && (
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
              <span className="text-white text-lg">📷</span>
            </div>
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleLogoUpload}
        />
      </div>
      <div className="text-right">
        <h1 className="font-bold text-gray-900 text-lg leading-tight">
          {agencyName ?? 'סיכום פגישות'}
        </h1>
        {agentName && <p className="text-sm text-gray-400 mt-0.5">{agentName}</p>}
      </div>
    </div>
  )
}
