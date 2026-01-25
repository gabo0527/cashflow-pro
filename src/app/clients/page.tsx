'use client'
import PlaceholderPage from '@/components/ui/PlaceholderPage'

export default function ClientsPage({ theme }: { theme?: 'light' | 'dark' }) {
  return (
    <PlaceholderPage
      title="Clients"
      description="Manage client relationships and view revenue by client"
      theme={theme}
    />
  )
}
