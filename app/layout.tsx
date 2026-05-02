import type { Metadata } from 'next'
import './globals.css'
import Header from '@/components/layout/Header'

export const metadata: Metadata = {
  title: 'ContaAI - AI Accounting Assistant',
  description: 'AI-powered accounting for Spanish autonomos and personal finances',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" style={{ height: '100%' }}>
      <body style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
        <Header />
        <main style={{ flex: 1, maxWidth: '1280px', margin: '0 auto', padding: '32px 24px', width: '100%' }}>
          {children}
        </main>
      </body>
    </html>
  )
}
