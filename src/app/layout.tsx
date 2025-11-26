import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'CashFlow Pro | Business Cash Management',
  description: 'Professional cash flow forecasting and management tool for businesses',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        {children}
      </body>
    </html>
  )
}
