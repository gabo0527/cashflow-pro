'use client'
import PlaceholderPage from '@/components/ui/PlaceholderPage'

export default function TeamPage({ theme }: { theme?: 'light' | 'dark' }) {
  return (
    <PlaceholderPage
      title="Team"
      description="Manage contractors and employees"
      theme={theme}
    />
  )
}
