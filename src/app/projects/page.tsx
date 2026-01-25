'use client'
import PlaceholderPage from '@/components/ui/PlaceholderPage'

export default function ProjectsPage({ theme }: { theme?: 'light' | 'dark' }) {
  return (
    <PlaceholderPage
      title="Projects"
      description="Track project profitability, budgets, and margins"
      theme={theme}
    />
  )
}
