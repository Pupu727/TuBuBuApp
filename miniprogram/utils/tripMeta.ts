export const MAX_TRIP_DAYS = 21

export const formatDayNight = (days: number): string => {
  const safeDays = Number.isFinite(days) && days > 0 ? Math.round(days) : 1
  const nights = Math.max(0, safeDays - 1)

  return `${safeDays}天${nights}夜`
}

export const resolveDayNightToneClass = (days: number): string => {
  const safeDays = Number.isFinite(days) && days > 0 ? Math.round(days) : 1
  const toneIndex = ((safeDays - 1) % 7) + 1

  return `daynight-${toneIndex}`
}

export const buildTripDayOptions = (maxDays: number): number[] => {
  const safeMax = maxDays > 0 ? Math.round(maxDays) : 1
  const options: number[] = []

  for (let days = 1; days <= safeMax; days += 1) {
    options.push(days)
  }

  return options
}

export const resolveDayNightMaxDays = (selectedDays: number): number => {
  const safeSelected = Number.isFinite(selectedDays) && selectedDays > 0 ? Math.round(selectedDays) : 1

  if (safeSelected > MAX_TRIP_DAYS) {
    return safeSelected
  }

  return MAX_TRIP_DAYS
}

export const clampTripDays = (days: number, maxDays: number): number => {
  const safeMax = maxDays > 0 ? Math.round(maxDays) : MAX_TRIP_DAYS
  const safeDays = Number.isFinite(days) && days > 0 ? Math.round(days) : 1

  if (safeDays > safeMax) {
    return safeMax
  }

  return safeDays
}
