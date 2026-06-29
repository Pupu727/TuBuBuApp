import { getUserBodyProfile } from '../repositories/userProfileRepository'
import { getPlanOverview } from './planOverviewService'

export interface CalorieRecommendView {
  visible: boolean
  label: string
}

const emptyRecommend = (): CalorieRecommendView => ({
  visible: false,
  label: '',
})

const parsePositiveNumber = (raw: string): number | null => {
  const trimmed = raw.trim()

  if (!trimmed) {
    return null
  }

  const value = Number(trimmed)

  if (!Number.isFinite(value) || value <= 0) {
    return null
  }

  return value
}

const resolveLoadFactor = (carryRatePercent: number): number => {
  if (carryRatePercent <= 10) {
    return 1
  }

  if (carryRatePercent <= 15) {
    return 1.05
  }

  if (carryRatePercent <= 20) {
    return 1.1
  }

  if (carryRatePercent <= 25) {
    return 1.15
  }

  return 1.2
}

const resolveHikingHours = (days: number, carryRatePercent: number): number => {
  const safeDays = Number.isFinite(days) && days > 0 ? Math.round(days) : 1

  if (safeDays === 1) {
    if (carryRatePercent > 20) {
      return 10
    }

    if (carryRatePercent > 15) {
      return 9
    }

    return 8
  }

  let hoursPerDay = 7

  if (carryRatePercent > 20) {
    hoursPerDay = 8
  }

  return safeDays * hoursPerDay
}

const resolveRoadMealK = (days: number, carryRatePercent: number): number => {
  const safeDays = Number.isFinite(days) && days > 0 ? Math.round(days) : 1

  if (carryRatePercent > 25 || (safeDays >= 2 && carryRatePercent > 20)) {
    return 4.5
  }

  if (carryRatePercent > 18 || safeDays >= 3) {
    return 3.5
  }

  if (carryRatePercent > 12 || safeDays >= 2) {
    return 2.8
  }

  return 2
}

const resolveEmergencyKcal = (days: number): number => {
  const safeDays = Number.isFinite(days) && days > 0 ? Math.round(days) : 1
  return safeDays * 400
}

const formatRoadMealKcal = (value: number): string => {
  const rounded = Math.round(value / 50) * 50
  return `约${rounded}kcal`
}

export const evaluateCalorieRecommendForPlan = (planId: string, days: number): CalorieRecommendView => {
  if (!planId) {
    return emptyRecommend()
  }

  const profile = getUserBodyProfile()
  const weightKg = parsePositiveNumber(profile.weightKg)

  if (!weightKg) {
    return emptyRecommend()
  }

  const overview = getPlanOverview(planId)
  const safeDays = Number.isFinite(days) && days > 0 ? Math.round(days) : 1
  const loadKg = overview.tripWeightG / 1000
  const carryRatePercent = loadKg > 0 ? (loadKg / weightKg) * 100 : 0

  const hikingHours = resolveHikingHours(safeDays, carryRatePercent)
  const roadMealK = resolveRoadMealK(safeDays, carryRatePercent)
  const loadFactor = resolveLoadFactor(carryRatePercent)
  const envFactor = 1
  const emergencyKcal = resolveEmergencyKcal(safeDays)

  const baseRoadKcal = hikingHours * weightKg * roadMealK
  const roadKcal = baseRoadKcal * loadFactor * envFactor + emergencyKcal

  if (!Number.isFinite(roadKcal) || roadKcal <= 0) {
    return emptyRecommend()
  }

  return {
    visible: true,
    label: formatRoadMealKcal(roadKcal),
  }
}
