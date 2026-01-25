'use client'
import PlaceholderPage from '@/components/ui/PlaceholderPage'

export default function InvoicesPage({ theme }: { theme?: 'light' | 'dark' }) {
  return (
    <PlaceholderPage
      title="Invoices & AR"
      description="Manage invoices, track aging, and monitor payments"
      theme={theme}
    />
  )
}
