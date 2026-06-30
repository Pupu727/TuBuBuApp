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

export const compareDateParts = (left: DateParts, right: DateParts): number => {
  if (left.year !== right.year) {
    return left.year - right.year
  }

  if (left.month !== right.month) {
    return left.month - right.month
  }

  return left.day - right.day
}

export const getFutureLimitParts = (yearsAhead = 2): DateParts => {
  const today = getTodayParts()

  return {
    year: today.year + yearsAhead,
    month: 12,
    day: 31,
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

export const clampDatePartsBetween = (parts: DateParts, minParts: DateParts, maxParts: DateParts): DateParts => {
  let next = clampDateParts(parts, maxParts)

  if (compareDateParts(next, minParts) < 0) {
    next = { ...minParts }
  }

  if (next.year === minParts.year && next.month < minParts.month) {
    next.month = minParts.month
  }

  if (next.year === minParts.year && next.month === minParts.month && next.day < minParts.day) {
    next.day = minParts.day
  }

  return clampDateParts(next, maxParts)
}

export const buildYearOptions = (minYear: number, maxYear: number): number[] => {
  const years: number[] = []

  for (let year = minYear; year <= maxYear; year += 1) {
    years.push(year)
  }

  return years
}

export const buildMonthOptions = (year: number, maxParts: DateParts, minParts?: DateParts): number[] => {
  const minMonth = minParts && year === minParts.year ? minParts.month : 1
  const maxMonth = year === maxParts.year ? maxParts.month : 12
  const months: number[] = []

  for (let month = minMonth; month <= maxMonth; month += 1) {
    months.push(month)
  }

  return months
}

export const buildDayOptions = (
  year: number,
  month: number,
  maxParts: DateParts,
  minParts?: DateParts
): number[] => {
  const minDay = minParts && year === minParts.year && month === minParts.month ? minParts.day : 1
  const maxDay = year === maxParts.year && month === maxParts.month
    ? maxParts.day
    : daysInMonth(year, month)
  const days: number[] = []

  for (let day = minDay; day <= maxDay; day += 1) {
    days.push(day)
  }

  return days
}
