import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'סיכום פגישות — סוכן פיננסי',
  description: 'אפליקציה לסיכום פגישות פיננסיות אוטומטי',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="he" dir="rtl" className="h-full">
      <body className="min-h-full bg-gray-50 text-gray-900 antialiased">
        {children}
      </body>
    </html>
  )
}
