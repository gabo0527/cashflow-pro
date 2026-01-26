import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import AppShell from '@/components/layout/AppShell'
import { headers } from 'next/headers'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Vantage | Financial Analytics',
  description: 'Financial operating system for project-based businesses',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Get the current path from headers
  const headersList = await headers()
  const pathname = headersList.get('x-pathname') || ''
  
  // Public routes that don't need AppShell (sidebar)
  const isPublicRoute = pathname.startsWith('/timesheet')

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        {isPublicRoute ? (
          <div className="min-h-screen bg-slate-900 text-slate-100">
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
