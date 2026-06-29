export interface DateParts {
  year: number
  month: number
  day: number
}

export const getTodayParts = (): DateParts => {
  const now = new Date()
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
  }
}

export const parseDateString = (value: string): DateParts | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())

  if (!match) {
    return null
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  }
}

export const formatDateParts = (parts: DateParts): string => {
  const month = `${parts.month}`.padStart(2, '0')
  const day = `${parts.day}`.padStart(2, '0')
  return `${parts.year}-${month}-${day}`
}

const daysInMonth = (year: number, month: number): number => new Date(year, month, 0).getDate()

export const clampDateParts = (parts: DateParts, maxParts: DateParts): DateParts => {
  let year = Math.min(Math.max(parts.year, 1990), maxParts.year)
  let month = parts.month
  let day = parts.day

  if (year === maxParts.year && month > maxParts.month) {
    month = maxParts.month
  }

  const maxDay = year === maxParts.year && month === maxParts.month
    ? maxParts.day
    : daysInMonth(year, month)

  if (day > maxDay) {
    day = maxDay
  }

  return { year, month, day }
}

export const buildYearOptions = (minYear: number, maxYear: number): number[] => {
  const years: number[] = []

  for (let year = minYear; year <= maxYear; year += 1) {
    years.push(year)
  }

  return years
}

export const buildMonthOptions = (year: number, maxParts: DateParts): number[] => {
  const maxMonth = year === maxParts.year ? maxParts.month : 12
  const months: number[] = []

  for (let month = 1; month <= maxMonth; month += 1) {
    months.push(month)
  }

  return months
}

export const buildDayOptions = (year: number, month: number, maxParts: DateParts): number[] => {
  const maxDay = year === maxParts.year && month === maxParts.month
    ? maxParts.day
    : daysInMonth(year, month)
  const days: number[] = []

  for (let day = 1; day <= maxDay; day += 1) {
    days.push(day)
  }

  return days
}
