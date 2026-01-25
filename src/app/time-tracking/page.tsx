'use client'
import PlaceholderPage from '@/components/ui/PlaceholderPage'

export default function TimeTrackingPage({ theme }: { theme?: 'light' | 'dark' }) {
  return (
    <PlaceholderPage
      title="Time Tracking"
      description="Log hours by contractor and project"
      theme={theme}
    />
  )
}
