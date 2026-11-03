// October invoices due October 31 are the first period tracked in Vantage.
export const INVOICE_FOLLOWUP_START_MONTH = '2026-10-01'
export const PAYABLES_TIME_ZONE = 'America/Puerto_Rico'
export function localToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: PAYABLES_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}
export function previousBillingMonth(today = localToday()) {
  const end = new Date(`${today.slice(0, 7)}-01T12:00:00Z`)
  end.setUTCDate(0)
  return { start: `${end.toISOString().slice(0, 7)}-01`, end: end.toISOString().slice(0, 10) }
}
export function federalHolidays(year: number) {
  const days = new Set<string>()
  const observed = (y: number, month: number, day: number) => {
    const date = new Date(Date.UTC(y, month - 1, day, 12))
    if (date.getUTCDay() === 6) date.setUTCDate(date.getUTCDate() - 1)
    else if (date.getUTCDay() === 0) date.setUTCDate(date.getUTCDate() + 1)
    days.add(date.toISOString().slice(0,10))
  }
  // Include adjacent New Year's observance, which may fall on December 31.
  for (const y of [year,year+1]) observed(y,1,1)
  for (const [month,day] of [[6,19],[7,4],[11,11],[12,25]]) observed(year,month,day)
  for (const [month,weekday,nth] of [[1,1,3],[2,1,3],[9,1,1],[10,1,2],[11,4,4]]) {
    const date = new Date(Date.UTC(year,month-1,1,12))
    date.setUTCDate(1 + (weekday-date.getUTCDay()+7)%7 + (nth-1)*7)
    days.add(date.toISOString().slice(0,10))
  }
  const memorial = new Date(Date.UTC(year,4,31,12))
  memorial.setUTCDate(31-(memorial.getUTCDay()-1+7)%7)
  days.add(memorial.toISOString().slice(0,10))
  return Array.from(days)
}
// U.S. federal observances plus any extra company holidays.
export function thirdBusinessDayAfterMonth(periodEnd: string, holidays: string[] = []) {
  const date = new Date(`${periodEnd}T12:00:00Z`)
  const closed = new Set([...federalHolidays(date.getUTCFullYear()),...federalHolidays(date.getUTCFullYear()+1),...holidays])
  let count = 0
  while (count < 3) {
    date.setUTCDate(date.getUTCDate() + 1)
    if (![0, 6].includes(date.getUTCDay()) && !closed.has(date.toISOString().slice(0, 10))) count++
  }
  return date.toISOString().slice(0, 10)
}
export function isOutstanding(invoice: { status: string }) {
  return ['submitted', 'pending', 'approved', 'scheduled'].includes(invoice.status)
}
export function payableBucket(invoice: { status: string; due_date?: string | null }, today = localToday()) {
  if (!isOutstanding(invoice)) return 'closed'
  if (!invoice.due_date) return 'missing_due_date'
  if (invoice.due_date < today) return 'overdue'
  const inSeven = new Date(`${today}T12:00:00Z`)
  inSeven.setUTCDate(inSeven.getUTCDate() + 7)
  return invoice.due_date <= inSeven.toISOString().slice(0, 10) ? 'due_soon' : 'upcoming'
}
export function statusTimestamp(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString('en-US', { timeZone: PAYABLES_TIME_ZONE, dateStyle: 'medium', timeStyle: 'medium' }) + ' AST' : 'Not recorded'
}
