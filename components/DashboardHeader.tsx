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
    <div className="flex items-center gap-3">
      <div className="relative group">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          title="לחץ לשינוי לוגו"
          className="relative w-10 h-10 rounded-lg border border-gray-100 overflow-hidden hover:opacity-80 transition-opacity focus:outline-none"
        >
          {logoUrl ? (
            <img src={logoUrl} alt={agencyName ?? ''} className="w-full h-full object-contain" />
          ) : (
            <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-400 text-lg">
              {uploading ? '⏳' : '🏢'}
            </div>
          )}
          {!uploading && (
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <span className="text-white text-base">📷</span>
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
        <h1 className="font-bold text-gray-900 text-base leading-tight">
          {agencyName ?? 'סיכום פגישות'}
        </h1>
        {agentName && <p className="text-xs text-gray-400">{agentName}</p>}
      </div>
    </div>
  )
}
