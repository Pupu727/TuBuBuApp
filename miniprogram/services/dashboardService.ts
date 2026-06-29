import { planItemRepository, tripPlanRepository } from '../repositories/storageRepository'
import {
  GEAR_CATEGORY_COLORS,
  GEAR_CATEGORY_NAMES,
  GEAR_CATEGORY_ORDER,
  normalizeGearCategory,
  normalizeGearStatus,
} from '../utils/gearMeta'
import type { Gear, GearCategory, PlanItem, TripPlan } from '../utils/models'
import { formatDayNight, resolveDayNightToneClass } from '../utils/tripMeta'
import {
  getGearListItems,
  getGearOwnedValueCent,
  getGearOwnedWeightG,
  getGearSummary,
  listGears,
  normalizeGearQuantity,
} from './gearService'
import type { GearListItem, GearSummary } from './gearService'
import { centToYuan, formatWeight } from './unitService'

export interface DashboardSummary {
  gearCount: number
  totalGearWeight: string
  totalGearValue: string
  utilization: string
  defaultPlanName: string
  defaultPlanWeight: string
  defaultPlanDays: number
  defaultPlanDayNight: string
  defaultPlanRoute: string
  primaryCategoryName: string
  primaryCategoryWeight: string
  primaryCategoryPercent: string
  primaryCategoryValue: string
  primaryCategoryValuePercent: string
  categoryOverviews: CategoryOverviewItem[]
}

export interface CategoryOverviewItem {
  category: GearCategory
  name: string
  weight: string
  weightPercent: string
  value: string
  valuePercent: string
  dotColor: string
}

export type { GearSummary, GearListItem }

export interface GearCategoryOption {
  id: GearCategory
  name: string
}

export interface PlanListItem {
  id: string
  name: string
  route: string
  days: number
  dayNightLabel: string
  dayNightToneClass: string
  weight: string
  isDefault: boolean
}

const activePlans = (): TripPlan[] => tripPlanRepository.list().filter((plan) => !plan.deleted)

const activePlanItems = (): PlanItem[] => planItemRepository.list().filter((item) => !item.deleted)

const formatPrice = (priceCent: number): string => {
  return `${centToYuan(priceCent).toFixed(0)}元`
}

const planWeight = (planId: string): number => {
  const activeGearIds = new Set(listGears().map((gear) => gear.id))

  return activePlanItems()
    .filter((item) => item.plan_id === planId && activeGearIds.has(item.gear_id))
    .reduce((sum, item) => sum + item.weight_g_snapshot * item.quantity, 0)
}

const buildCategoryOverviews = (
  gears: Gear[],
  totalGearWeight: number,
  totalGearValue: number
): CategoryOverviewItem[] => {
  const items: CategoryOverviewItem[] = []

  GEAR_CATEGORY_ORDER.forEach((category) => {
    const categoryGears = gears.filter((gear) => normalizeGearCategory(gear.category) === category)
    const categoryWeight = categoryGears.reduce((sum, gear) => sum + getGearOwnedWeightG(gear), 0)
    const categoryValue = categoryGears.reduce((sum, gear) => sum + getGearOwnedValueCent(gear), 0)

    if (categoryWeight <= 0 && categoryValue <= 0) {
      return
    }

    items.push({
      category,
      name: GEAR_CATEGORY_NAMES[category],
      weight: formatWeight(categoryWeight),
      weightPercent: totalGearWeight ? ((categoryWeight / totalGearWeight) * 100).toFixed(1) : '0.0',
      value: formatPrice(categoryValue),
      valuePercent: totalGearValue ? ((categoryValue / totalGearValue) * 100).toFixed(1) : '0.0',
      dotColor: GEAR_CATEGORY_COLORS[category],
    })
  })

  return items
}

export const getDashboardSummary = (): DashboardSummary => {
  const gears = listGears()
  const plans = activePlans()
  const defaultPlan = plans.find((plan) => plan.is_default) || plans[0]
  const totalGearWeight = gears.reduce((sum, gear) => sum + getGearOwnedWeightG(gear), 0)
  const totalGearValue = gears.reduce((sum, gear) => sum + getGearOwnedValueCent(gear), 0)
  const summary = getGearSummary()
  const defaultPlanWeight = defaultPlan ? planWeight(defaultPlan.id) : 0
  const categoryOverviews = buildCategoryOverviews(gears, totalGearWeight, totalGearValue)
  const primaryCategory = categoryOverviews[0]
  const hasGear = summary.gearCount > 0

  return {
    gearCount: summary.gearCount,
    totalGearWeight: summary.totalGearWeight,
    totalGearValue: summary.totalGearValue,
    utilization: summary.utilization,
    defaultPlanName: defaultPlan ? defaultPlan.name : '暂无方案',
    defaultPlanWeight: hasGear && defaultPlanWeight > 0 ? formatWeight(defaultPlanWeight) : '--',
    defaultPlanDays: defaultPlan ? defaultPlan.days : 0,
    defaultPlanDayNight: defaultPlan ? formatDayNight(defaultPlan.days) : '--',
    defaultPlanRoute: defaultPlan ? defaultPlan.route : '暂无路线',
    primaryCategoryName: primaryCategory ? primaryCategory.name : GEAR_CATEGORY_NAMES.other,
    primaryCategoryWeight: primaryCategory ? primaryCategory.weight : formatWeight(0),
    primaryCategoryPercent: primaryCategory ? primaryCategory.weightPercent : '0.0',
    primaryCategoryValue: primaryCategory ? primaryCategory.value : formatPrice(0),
    primaryCategoryValuePercent: primaryCategory ? primaryCategory.valuePercent : '0.0',
    categoryOverviews,
  }
}

export const getGearCategoryOptions = (): GearCategoryOption[] => {
  return GEAR_CATEGORY_ORDER.map((category) => ({
    id: category,
    name: GEAR_CATEGORY_NAMES[category],
  }))
}

export const getGearSummaryByFilter = (category?: GearCategory, keyword?: string): GearSummary => {
  return getGearSummary({
    category,
    keyword,
  })
}

export const getGearList = (category?: GearCategory, keyword?: string): GearListItem[] => {
  return getGearListItems({
    category,
    keyword,
  })
}

const getActivePlanGearIds = (planId: string): string[] => {
  const activeGearIds = new Set(listGears().map((gear) => gear.id))
  const gearIds: string[] = []

  activePlanItems().forEach((item) => {
    if (item.plan_id !== planId || !activeGearIds.has(item.gear_id)) {
      return
    }

    if (gearIds.indexOf(item.gear_id) < 0) {
      gearIds.push(item.gear_id)
    }
  })

  return gearIds
}

export const getGearListForPlan = (
  planId: string,
  category?: GearCategory,
  keyword?: string
): GearListItem[] => {
  const gearIds = new Set(getActivePlanGearIds(planId))

  return getGearListItems({
    category,
    keyword,
  }).filter((item) => gearIds.has(item.id))
}

export const getGearSummaryForPlan = (
  planId: string,
  category?: GearCategory,
  keyword?: string
): GearSummary => {
  const gearIds = new Set(getActivePlanGearIds(planId))
  const gears = listGears({
    category,
    keyword,
  }).filter((gear) => gearIds.has(gear.id))
  const totalGearWeight = gears.reduce((sum, gear) => sum + getGearOwnedWeightG(gear), 0)
  const totalGearValue = gears.reduce((sum, gear) => sum + getGearOwnedValueCent(gear), 0)
  const usingCount = gears.filter((gear) => normalizeGearStatus(gear.status) === 'using').length
  const utilization = gears.length ? Math.round((usingCount / gears.length) * 100) : 0

  return {
    gearCount: gears.length,
    totalGearWeight: formatWeight(totalGearWeight),
    totalGearValue: formatPrice(totalGearValue),
    utilization: `${utilization}%`,
  }
}

export const getPlanList = (): PlanListItem[] => {
  return activePlans().map((plan) => ({
    id: plan.id,
    name: plan.name,
    route: plan.route,
    days: plan.days,
    dayNightLabel: formatDayNight(plan.days),
    dayNightToneClass: resolveDayNightToneClass(plan.days),
    weight: formatWeight(planWeight(plan.id)),
    isDefault: plan.is_default,
  }))
}
