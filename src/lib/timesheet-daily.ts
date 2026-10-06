// Shared by the portal and its server routes. Descriptions are keyed by date,
// never by project alone, so a weekly note cannot be copied into every day.
export interface DailyTimeForm {
  project_id: string
  days: Record<string, string>
  descriptions: Record<string, string>
  legacyNote?: string
}

export const MAX_DESCRIPTION_LENGTH = 2000

export function isTimeAndMaterials(paymentType: string): boolean {
  return ['tm', 't&m', 'time_and_materials', 'hourly'].includes(paymentType.toLowerCase().trim())
}

export function validISODate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
}

export function weekDates(ending: string): string[] {
  if (!validISODate(ending) || new Date(`${ending}T00:00:00Z`).getUTCDay() !== 0) {
    throw new Error('week_ending must be a valid Sunday date')
  }
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(`${ending}T00:00:00Z`)
    date.setUTCDate(date.getUTCDate() - 6 + index)
    return date.toISOString().slice(0, 10)
  })
}

export function cleanDailyEntry(
  hours: unknown, descriptions: unknown, dates: string[], required: boolean
): { daily_hours: Record<string, number>; daily_descriptions: Record<string, string> } {
  if (!hours || typeof hours !== 'object' || Array.isArray(hours)) {
    throw new Error('daily_hours must be an object of dates and hours')
  }
  const notes = descriptions ?? {}
  if (typeof notes !== 'object' || notes === null || Array.isArray(notes)) {
    throw new Error('daily_descriptions must be an object of dates and descriptions')
  }
  const daily_hours: Record<string, number> = {}
  const daily_descriptions: Record<string, string> = {}
  for (const [date, raw] of Object.entries(hours)) {
    if (!dates.includes(date)) throw new Error(`Hours for ${date} are outside the selected week`)
    if (typeof raw !== 'number' && typeof raw !== 'string') throw new Error(`Invalid hours for ${date}`)
    const number = typeof raw === 'string' && raw.trim() === '' ? 0 : Number(raw)
    if (!Number.isFinite(number) || number < 0 || number > 24) throw new Error(`Hours for ${date} must be between 0 and 24`)
    if (number > 0) daily_hours[date] = number
  }
  for (const [date, raw] of Object.entries(notes)) {
    if (!dates.includes(date) || typeof raw !== 'string') throw new Error(`Invalid description for ${date}`)
    const note = raw.trim()
    if (note.length > MAX_DESCRIPTION_LENGTH) throw new Error(`Description for ${date} must be ${MAX_DESCRIPTION_LENGTH} characters or fewer`)
    // Preserve a description when a contractor temporarily clears its hours.
    if (note) daily_descriptions[date] = note
  }
  for (const date of Object.keys(daily_hours)) {
    if (required && !daily_descriptions[date]) throw new Error(`Add a description for ${date} before saving or submitting`)
  }
  return { daily_hours, daily_descriptions }
}

export function dailySubmissionRows(
  projectId: string, daily: ReturnType<typeof cleanDailyEntry>, rate: number
) {
  return Object.entries(daily.daily_hours).map(([date, hours]) => ({
    project_id: projectId, date, hours, billable_hours: hours,
    is_billable: true, bill_rate: rate,
    description: daily.daily_descriptions[date] || null,
  }))
}
