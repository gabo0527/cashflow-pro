'use client'
import PlaceholderPage from '@/components/ui/PlaceholderPage'

export default function CashFlowPage({ theme }: { theme?: 'light' | 'dark' }) {
  return (
    <PlaceholderPage
      title="Cash Flow"
      description="Track bank transactions, inflows, and outflows"
      theme={theme}
    />
  )
}
