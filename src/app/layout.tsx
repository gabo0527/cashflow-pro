import type { Metadata } from 'next'
import './globals.css'
import AppShell from '@/components/layout/AppShell'
import { headers } from 'next/headers'

export const metadata: Metadata = {
  title: 'VantageFP | Financial Operations',
  description: 'Financial operating system for project-based businesses',
  metadataBase: new URL('https://vantagefp.co'),
  openGraph: {
    title: 'VantageFP | Financial Operations',
    description: 'Financial operating system for project-based businesses',
    url: 'https://vantagefp.co',
    siteName: 'VantageFP',
    type: 'website',
  },
  icons: {
    icon: '/favicon.ico',
  },
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const headersList = await headers()
  const pathname = headersList.get('x-pathname') || ''

  const isPublicRoute = pathname.startsWith('/timesheet')

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Archivo:wght@600;700;800;900&family=Instrument+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ fontFamily: "'Instrument Sans', system-ui, -apple-system, sans-serif" }}>
        {isPublicRoute ? (
          <div className="min-h-screen bg-[#080c14] text-slate-100">
            {children}
          </div>
        ) : (
          <AppShell>
            {children}
          </AppShell>
        )}
      </body>
    </html>
  )
}
