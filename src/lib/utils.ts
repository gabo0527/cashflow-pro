// ============ COLOR SYSTEM ============

export const colors = {
  // Semantic colors
  revenue: '#10b981',      // Emerald - income, cash in
  directCost: '#f43f5e',   // Rose - OpEx, COGS, project costs
  overhead: '#f59e0b',     // Amber - G&A, admin, non-project
  investment: '#3b82f6',   // Slate Blue - CapEx, strategic spend
  neutral: '#64748b',      // Slate - text, borders

  // UI colors
  primary: '#3b82f6',      // Slate Blue - actions, links
  success: '#10b981',      // Emerald
  warning: '#f59e0b',      // Amber
  danger: '#f43f5e',       // Rose

  // Dark mode
  dark: {
    bg: '#0f172a',         // slate-900
    card: '#1e293b',       // slate-800
    border: '#334155',     // slate-700
    text: '#f1f5f9',       // slate-100
    textMuted: '#94a3b8',  // slate-400
  },

  // Light mode
  light: {
    bg: '#f8fafc',         // slate-50
    card: '#ffffff',
    border: '#e2e8f0',     // slate-200
    text: '#1e293b',       // slate-800
    textMuted: '#64748b',  // slate-500
  }
}

// ============ FORMATTING ============

export const formatCurrency = (value: number, compact = false): string => {
  if (compact && Math.abs(value) >= 1000000) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 1
    }).format(value)
  }
  if (compact && Math.abs(value) >= 1000) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 1
    }).format(value)
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value)
}

export const formatPercent = (value: number, decimals = 1): string => {
  return `${value.toFixed(decimals)}%`
}

export const formatNumber = (value: number, compact = false): string => {
  if (compact) {
    return new Intl.NumberFormat('en-US', {
      notation: 'compact',
      maximumFractionDigits: 1
    }).format(value)
  }
  return new Intl.NumberFormat('en-US').format(value)
}

export const formatDate = (date: string | Date, format: 'short' | 'medium' | 'long' = 'medium'): string => {
  const d = typeof date === 'string' ? new Date(date) : date
  
  switch (format) {
    case 'short':
      return d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })
    case 'long':
      return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    default:
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }
}

// ============ CALCULATIONS ============

export const calculateGrossMargin = (revenue: number, directCosts: number): number => {
  if (revenue === 0) return 0
  return ((revenue - directCosts) / revenue) * 100
}

export const calculateNetMargin = (revenue: number, totalExpenses: number): number => {
  if (revenue === 0) return 0
  return ((revenue - totalExpenses) / revenue) * 100
}

export const calculateGrossProfit = (revenue: number, directCosts: number): number => {
  return revenue - directCosts
}

// ============ STATUS HELPERS ============

export const getStatusColor = (status: string): string => {
  switch (status.toLowerCase()) {
    case 'active':
    case 'paid':
    case 'approved':
      return colors.success
    case 'inactive':
    case 'archived':
    case 'void':
      return colors.neutral
    case 'overdue':
    case 'danger':
      return colors.danger
    case 'pending':
    case 'draft':
    case 'on-hold':
    case 'paused':
      return colors.warning
    case 'in-progress':
    case 'sent':
    case 'partial':
      return colors.primary
    default:
      return colors.neutral
  }
}

export const getStatusLabel = (status: string): string => {
  return status
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

// ============ AGING HELPERS ============

export const getAgingBucket = (daysOverdue: number): string => {
  if (daysOverdue <= 0) return 'Current'
  if (daysOverdue <= 30) return '1-30 Days'
  if (daysOverdue <= 60) return '31-60 Days'
  if (daysOverdue <= 90) return '61-90 Days'
  return '90+ Days'
}

export const getAgingColor = (daysOverdue: number): string => {
  if (daysOverdue <= 0) return colors.success
  if (daysOverdue <= 30) return colors.primary
  if (daysOverdue <= 60) return colors.warning
  return colors.danger
}

// ============ CLASSNAME HELPER ============

export const cn = (...classes: (string | boolean | undefined | null)[]): string => {
  return classes.filter(Boolean).join(' ')
}
