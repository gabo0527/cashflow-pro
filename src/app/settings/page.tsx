'use client'
import PlaceholderPage from '@/components/ui/PlaceholderPage'

export default function SettingsPage({ theme }: { theme?: 'light' | 'dark' }) {
  return (
    <PlaceholderPage
      title="Settings"
      description="Manage company settings and integrations"
      theme={theme}
    />
  )
}
