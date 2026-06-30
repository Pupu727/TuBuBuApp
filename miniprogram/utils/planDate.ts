import {
  compareDateParts,
  formatDateParts,
  getTodayParts,
  parseDateString,
  type DateParts,
} from './datePicker'

export { compareDateParts }

export const getTodayDateString = (): string => formatDateParts(getTodayParts())

export const computePlanEndDate = (startDate: string, days: number): string => {
  const parts = parseDateString(startDate)

  if (!parts || days < 1) {
    return ''
  }

  const date = new Date(parts.year, parts.month - 1, parts.day)
  date.setDate(date.getDate() + Math.round(days) - 1)

  return formatDateParts({
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  })
}

export const daysUntilPlanDate = (startDate: string): number | null => {
  const parts = parseDateString(startDate)

  if (!parts) {
    return null
  }

  const today = getTodayParts()
  const todayMs = new Date(today.year, today.month - 1, today.day).getTime()
  const targetMs = new Date(parts.year, parts.month - 1, parts.day).getTime()

  return Math.round((targetMs - todayMs) / 86400000)
}

export const isPlanDateOnOrAfterToday = (startDate: string): boolean => {
  const parts = parseDateString(startDate)

  if (!parts) {
    return false
  }

  return compareDateParts(parts, getTodayParts()) >= 0
}

export const formatPlanDateCapsule = (startDate: string): string => {
  const parts = parseDateString(startDate)

  if (!parts) {
    return '未排期'
  }

  const yearSuffix = parts.year % 100

  return `${yearSuffix}/${parts.month}/${parts.day}`
}

/** 进度条满格对应的最大剩余天数（超出仍显示 100%） */
export const TRIP_COUNTDOWN_MAX_DAYS = 60

export const resolveTripCountdownProgressNum = (startDate: string): number | null => {
  const daysUntil = daysUntilPlanDate(startDate)

  if (daysUntil === null) {
    return null
  }

  if (daysUntil <= 0) {
    return 0
  }

  const progress = Math.round((daysUntil / TRIP_COUNTDOWN_MAX_DAYS) * 100)

  return Math.min(100, Math.max(0, progress))
}

export const resolveTripCountdownProgressToneClass = (startDate: string): string => {
  const days = daysUntilPlanDate(startDate)

  if (days === null) {
    return 'trip-progress-fill--unset'
  }

  if (days < 0) {
    return 'trip-progress-fill--past'
  }

  if (days <= 7) {
    return 'trip-progress-fill--soon'
  }

  return 'trip-progress-fill--active'
}

export const hasTripSchedule = (startDate: string): boolean => {
  return parseDateString(startDate) !== null
}

export const resolveTripDateToneClass = (startDate: string): string => {
  const days = daysUntilPlanDate(startDate)

  if (days === null) {
    return 'trip-date--unset'
  }

  if (days < 0) {
    return 'trip-date--past'
  }

  if (days === 0) {
    return 'trip-date--today'
  }

  if (days <= 7) {
    return 'trip-date--soon'
  }

  if (days <= 30) {
    return 'trip-date--near'
  }

  return 'trip-date--far'
}

export const formatDaysUntilLabel = (days: number | null): string => {
  if (days === null) {
    return '--'
  }

  if (days < 0) {
    return '已过期'
  }

  if (days === 0) {
    return '今天'
  }

  return String(days)
}

export type PlanTripStatus = 'unscheduled' | 'upcoming' | 'completed'

export const resolvePlanTripStatus = (startDate: string): PlanTripStatus => {
  const parts = parseDateString(startDate)

  if (!parts) {
    return 'unscheduled'
  }

  const today = getTodayParts()

  if (compareDateParts(parts, today) < 0) {
    return 'completed'
  }

  return 'upcoming'
}

export const isCompletedTripPlan = (startDate: string): boolean => {
  return resolvePlanTripStatus(startDate) === 'completed'
}

export const partitionPlansByTripStatus = <T extends { start_date: string }>(
  plans: T[]
): { upcomingPlans: T[]; completedPlans: T[] } => {
  const upcomingPlans: T[] = []
  const completedPlans: T[] = []

  plans.forEach((plan) => {
    const status = resolvePlanTripStatus(plan.start_date)

    if (status === 'completed') {
      completedPlans.push(plan)
      return
    }

    upcomingPlans.push(plan)
  })

  return { upcomingPlans, completedPlans }
}

export interface UpcomingPlanCandidate {
  planId: string
  planName: string
  route: string
  startDate: string
  daysUntil: number
}

export const resolveNearestUpcomingPlan = <T extends { id: string; name: string; route: string; start_date: string }>(
  plans: T[]
): UpcomingPlanCandidate | null => {
  const today = getTodayParts()
  let nearest: UpcomingPlanCandidate | null = null

  plans.forEach((plan) => {
    const parts = parseDateString(plan.start_date)

    if (!parts || compareDateParts(parts, today) < 0) {
      return
    }

    const daysUntil = daysUntilPlanDate(plan.start_date)

    if (daysUntil === null) {
      return
    }

    if (!nearest || daysUntil < nearest.daysUntil) {
      nearest = {
        planId: plan.id,
        planName: plan.name,
        route: plan.route,
        startDate: plan.start_date,
        daysUntil,
      }
    }
  })

  return nearest
}

export interface LastPastTripCandidate {
  planId: string
  planName: string
  route: string
  startDate: string
}

export const resolveLastPastTripPlan = <T extends { id: string; name: string; route: string; start_date: string }>(
  plans: T[]
): LastPastTripCandidate | null => {
  const today = getTodayParts()
  let latest: LastPastTripCandidate | null = null
  let latestParts: DateParts | null = null

  plans.forEach((plan) => {
    const parts = parseDateString(plan.start_date)

    if (!parts || compareDateParts(parts, today) >= 0) {
      return
    }

    if (!latestParts || compareDateParts(parts, latestParts) > 0) {
      latestParts = parts
      latest = {
        planId: plan.id,
        planName: plan.name,
        route: plan.route,
        startDate: plan.start_date,
      }
    }
  })

  return latest
}

export const sortPlansByStartDate = <T extends { start_date: string }>(plans: T[]): T[] => {
  return plans.slice().sort((left, right) => {
    const leftParts = parseDateString(left.start_date)
    const rightParts = parseDateString(right.start_date)

    if (!leftParts && !rightParts) {
      return 0
    }

    if (!leftParts) {
      return 1
    }

    if (!rightParts) {
      return -1
    }

    return compareDateParts(leftParts, rightParts)
  })
}
