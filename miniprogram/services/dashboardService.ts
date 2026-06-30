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
  daysUntilPlanDate,
  formatDaysUntilLabel,
  formatPlanDateCapsule,
  hasTripSchedule,
  isCompletedTripPlan,
  partitionPlansByTripStatus,
  type PlanTripStatus,
  resolveLastPastTripPlan,
  resolveNearestUpcomingPlan,
  resolveTripCountdownProgressNum,
  resolveTripCountdownProgressToneClass,
  resolveTripDateToneClass,
  sortPlansByStartDate,
} from '../utils/planDate'
import {
  getGearListItems,
  getGearOwnedValueCent,
  getGearOwnedWeightG,
  getGearSummary,
  listGears,
  normalizeGearQuantity,
} from './gearService'
import type { GearListItem, GearSummary } from './gearService'
import { getPlanOverview } from './planOverviewService'
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

export interface GearHeaderStripItem {
  category: GearCategory | 'all'
  name: string
  percent: number
  color: string
  widthStyle: string
  activeClass: string
}

export interface GearHeaderLegendItem {
  category: GearCategory | 'all'
  name: string
  percent: string
  color: string
  activeClass: string
}

export interface GearHeaderInsight {
  eyebrow: string
  insightText: string
  categoryStrip: GearHeaderStripItem[]
  categoryLegend: GearHeaderLegendItem[]
  showCategoryStrip: boolean
  gearCountBadge: string
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
  startDate: string
  tripDateLabel: string
  tripDateToneClass: string
  daysUntil: number | null
  daysUntilLabel: string
}

export interface PlanPageCard extends PlanListItem {
  remark: string
  remarkPreview: string
  hasRemark: boolean
  tripStatus: PlanTripStatus
  tripQuantity: number
  backpackWeight: string
  packedPercent: string
  packedPercentNum: number
  tripCountdownPercentNum: number
  tripCountdownToneClass: string
  hasTripSchedule: boolean
  hasItems: boolean
  emptyHint: string
  statsLine: string
  packedCapsuleLabel: string
  packedCapsuleToneClass: string
}

export interface PlanPageMetric {
  value: string
  label: string
}

export interface PlanPageHeader {
  planCount: number
  spotlightTitle: string
  insightText: string
  showUpcomingInsight: boolean
  insightRouteLabel: string
  insightDaysUntil: number
  insightDateLabel: string
  insightDepartToday: boolean
  insightCountdownToneClass: string
  metrics: PlanPageMetric[]
  hasPlans: boolean
}

const buildRemarkPreview = (remark: string): Pick<PlanPageCard, 'remark' | 'remarkPreview' | 'hasRemark'> => {
  const trimmed = remark.trim()

  if (!trimmed) {
    return {
      remark: '',
      remarkPreview: '暂无备注',
      hasRemark: false,
    }
  }

  return {
    remark: trimmed,
    remarkPreview: trimmed,
    hasRemark: true,
  }
}

const buildPlanTripDateFields = (startDate: string): Pick<
  PlanListItem,
  'startDate' | 'tripDateLabel' | 'tripDateToneClass' | 'daysUntil' | 'daysUntilLabel'
> => {
  const daysUntil = daysUntilPlanDate(startDate)

  return {
    startDate,
    tripDateLabel: formatPlanDateCapsule(startDate),
    tripDateToneClass: resolveTripDateToneClass(startDate),
    daysUntil,
    daysUntilLabel: formatDaysUntilLabel(daysUntil),
  }
}

const buildPlanListItem = (plan: TripPlan): PlanListItem => {
  return {
    id: plan.id,
    name: plan.name,
    route: plan.route,
    days: plan.days,
    dayNightLabel: formatDayNight(plan.days),
    dayNightToneClass: resolveDayNightToneClass(plan.days),
    weight: formatWeight(planWeight(plan.id)),
    ...buildPlanTripDateFields(plan.start_date),
  }
}

const parsePackedPercentNum = (packedPercent: string): number => {
  if (packedPercent === '--') {
    return 0
  }

  const num = Number.parseInt(packedPercent.replace('%', ''), 10)
  return Number.isFinite(num) ? num : 0
}

const buildPackedCapsule = (
  hasItems: boolean,
  packedPercent: string,
  packedPercentNum: number
): Pick<PlanPageCard, 'packedCapsuleLabel' | 'packedCapsuleToneClass'> => {
  if (!hasItems) {
    return {
      packedCapsuleLabel: '待打包',
      packedCapsuleToneClass: 'pack-capsule--pending',
    }
  }

  if (packedPercentNum >= 100) {
    return {
      packedCapsuleLabel: '已打包',
      packedCapsuleToneClass: 'pack-capsule--done',
    }
  }

  if (packedPercentNum > 0) {
    return {
      packedCapsuleLabel: `已打包 ${packedPercent}`,
      packedCapsuleToneClass: 'pack-capsule--progress',
    }
  }

  return {
    packedCapsuleLabel: '待打包',
    packedCapsuleToneClass: 'pack-capsule--pending',
  }
}

const buildPlanPageCard = (plan: TripPlan): PlanPageCard => {
  const overview = getPlanOverview(plan.id)
  const remarkFields = buildRemarkPreview(plan.remark)
  const packedPercentNum = parsePackedPercentNum(overview.packedPercent)
  const scheduled = hasTripSchedule(plan.start_date)
  const tripStatus: PlanTripStatus = isCompletedTripPlan(plan.start_date) ? 'completed' : 'upcoming'
  const tripCountdownPercentNum = scheduled
    ? resolveTripCountdownProgressNum(plan.start_date) || 0
    : 0
  const hasItems = !overview.isEmpty
  const emptyHint = '暂无装备'
  const statsLine = hasItems
    ? `${overview.tripQuantity}件 · ${overview.backpackWeight}`
    : emptyHint
  const packedCapsule =
    tripStatus === 'completed'
      ? { packedCapsuleLabel: '已出行', packedCapsuleToneClass: 'pack-capsule--completed' }
      : buildPackedCapsule(hasItems, overview.packedPercent, packedPercentNum)

  return {
    ...buildPlanListItem(plan),
    ...remarkFields,
    ...packedCapsule,
    tripQuantity: overview.tripQuantity,
    tripStatus,
    backpackWeight: overview.backpackWeight,
    packedPercent: overview.packedPercent,
    packedPercentNum,
    tripCountdownPercentNum,
    tripCountdownToneClass:
      tripStatus === 'completed' ? 'trip-progress-fill--past' : resolveTripCountdownProgressToneClass(plan.start_date),
    hasTripSchedule: scheduled,
    hasItems,
    emptyHint,
    statsLine,
  }
}

const buildEmptyPlanPageMetrics = (): PlanPageMetric[] => {
  return []
}

const resolveUpcomingRouteLabel = (upcoming: { route: string }): string => {
  const route = upcoming.route.trim()

  return route || '暂无路线'
}

const resolveLastTripMetricValue = (plans: TripPlan[]): string => {
  const lastPast = resolveLastPastTripPlan(plans)

  if (!lastPast) {
    return '--'
  }

  const route = lastPast.route.trim()

  return route || '暂无路线'
}

const buildPlanPageHeaderFromPlans = (plans: TripPlan[]): PlanPageHeader => {
  const planCount = plans.length
  const readyCount = plans.filter((plan) => !getPlanOverview(plan.id).isEmpty).length
  const upcoming = resolveNearestUpcomingPlan(plans)
  const lastTripMetricValue = resolveLastTripMetricValue(plans)
  const spotlightTitle = `共 ${planCount} 个出行方案`
  let insightText = ''
  let showUpcomingInsight = false
  let insightRouteLabel = ''
  let insightDaysUntil = 0
  let insightDateLabel = ''
  let insightDepartToday = false
  let insightCountdownToneClass = ''

  if (upcoming) {
    showUpcomingInsight = true
    insightRouteLabel = resolveUpcomingRouteLabel(upcoming)
    insightDaysUntil = upcoming.daysUntil
    insightDateLabel = formatPlanDateCapsule(upcoming.startDate)
    insightDepartToday = upcoming.daysUntil === 0
    insightCountdownToneClass = resolveTripDateToneClass(upcoming.startDate)
  } else if (readyCount === 0) {
    insightText = '先为方案设置出行日期，再开始整理装备'
  } else {
    insightText = '最近没有待出发方案，可为下方方案补充出行日期'
  }

  return {
    planCount,
    spotlightTitle,
    insightText,
    showUpcomingInsight,
    insightRouteLabel,
    insightDaysUntil,
    insightDateLabel,
    insightDepartToday,
    insightCountdownToneClass,
    metrics: [
      { value: String(planCount), label: '个方案' },
      { value: String(readyCount), label: '已装备' },
      { value: lastTripMetricValue, label: '上次出行' },
    ],
    hasPlans: true,
  }
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

const sortCategoryOverviewsByWeight = (items: CategoryOverviewItem[]): CategoryOverviewItem[] => {
  return items.slice().sort((left, right) => Number(right.weightPercent) - Number(left.weightPercent))
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

const resolveLegendActiveClass = (
  category: GearCategory | 'all',
  activeCategory: GearCategory | 'all'
): string => {
  if (category === 'all') {
    return activeCategory === 'all' ? 'is-active' : ''
  }

  return activeCategory === category ? 'is-active' : ''
}

export const getGearHeaderInsight = (
  gears: Gear[],
  activeCategory: GearCategory | 'all' = 'all',
  options?: {
    eyebrow?: string
    isPlanEmpty?: boolean
  }
): GearHeaderInsight => {
  const eyebrow = (options && options.eyebrow) || '全部装备'
  const totalGearWeight = gears.reduce((sum, gear) => sum + getGearOwnedWeightG(gear), 0)
  const categoryOverviews = sortCategoryOverviewsByWeight(buildCategoryOverviews(gears, totalGearWeight, 0))
  const gearCount = gears.reduce((sum, gear) => sum + normalizeGearQuantity(gear.quantity), 0)
  const gearCountBadge = `${gearCount} 件`

  if (options && options.isPlanEmpty) {
    return {
      eyebrow,
      insightText: '当前方案还没有装备',
      categoryStrip: [],
      categoryLegend: [],
      showCategoryStrip: false,
      gearCountBadge: '0 件',
    }
  }

  if (!gears.length || categoryOverviews.length === 0) {
    return {
      eyebrow,
      insightText: '添加第一件装备，开始管理你的背负',
      categoryStrip: [],
      categoryLegend: [],
      showCategoryStrip: false,
      gearCountBadge,
    }
  }

  const primaryCategory = categoryOverviews[0]
  const insightText = `${primaryCategory.name}最重 · 占总重 ${primaryCategory.weightPercent}%`
  const categoryStrip: GearHeaderStripItem[] = categoryOverviews.map((item) => ({
    category: item.category,
    name: item.name,
    percent: Number(item.weightPercent),
    color: item.dotColor,
    widthStyle: `flex: ${item.weightPercent};`,
    activeClass: resolveLegendActiveClass(item.category, activeCategory),
  }))
  const categoryLegend: GearHeaderLegendItem[] = categoryOverviews.map((item) => ({
    category: item.category,
    name: item.name,
    percent: `${item.weightPercent}%`,
    color: item.dotColor,
    activeClass: resolveLegendActiveClass(item.category, activeCategory),
  }))

  return {
    eyebrow,
    insightText,
    categoryStrip,
    categoryLegend,
    showCategoryStrip: true,
    gearCountBadge,
  }
}

export const getGearsForPlanHeader = (planId: string): Gear[] => {
  const gearIds = new Set(getActivePlanGearIds(planId))

  return listGears().filter((gear) => gearIds.has(gear.id))
}

export const getDashboardSummary = (): DashboardSummary => {
  const gears = listGears()
  const plans = activePlans()
  const upcoming = resolveNearestUpcomingPlan(plans)
  const defaultPlan = upcoming
    ? plans.find((plan) => plan.id === upcoming.planId)
    : plans[0]
  const totalGearWeight = gears.reduce((sum, gear) => sum + getGearOwnedWeightG(gear), 0)
  const totalGearValue = gears.reduce((sum, gear) => sum + getGearOwnedValueCent(gear), 0)
  const summary = getGearSummary()
  const defaultPlanWeight = defaultPlan ? planWeight(defaultPlan.id) : 0
  const categoryOverviews = sortCategoryOverviewsByWeight(buildCategoryOverviews(gears, totalGearWeight, totalGearValue))
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
  const { upcomingPlans } = partitionPlansByTripStatus(activePlans())
  return sortPlansByStartDate(upcomingPlans).map((plan) => buildPlanListItem(plan))
}

export const getPlanPageCards = (): PlanPageCard[] => {
  const { upcomingPlans } = partitionPlansByTripStatus(activePlans())
  return sortPlansByStartDate(upcomingPlans).map((plan) => buildPlanPageCard(plan))
}

export interface PlanPageSections {
  upcomingPlans: PlanPageCard[]
  completedPlans: PlanPageCard[]
  upcomingCount: number
  completedCount: number
}

const sortPlansByStartDateDesc = <T extends { start_date: string }>(plans: T[]): T[] => {
  return sortPlansByStartDate(plans).slice().reverse()
}

export const getPlanPageSections = (): PlanPageSections => {
  const plans = activePlans()
  const { upcomingPlans, completedPlans } = partitionPlansByTripStatus(plans)

  const upcomingCards = sortPlansByStartDate(upcomingPlans).map((plan) => buildPlanPageCard(plan))
  const completedCards = sortPlansByStartDateDesc(completedPlans).map((plan) => buildPlanPageCard(plan))

  return {
    upcomingPlans: upcomingCards,
    completedPlans: completedCards,
    upcomingCount: upcomingCards.length,
    completedCount: completedCards.length,
  }
}

export const getPlanPageHeader = (): PlanPageHeader => {
  const plans = activePlans()
  const planCount = plans.length

  if (planCount === 0) {
    return {
      planCount: 0,
      spotlightTitle: '',
      insightText: '创建第一个出行方案，开始管理装备和重量',
      showUpcomingInsight: false,
      insightRouteLabel: '',
      insightDaysUntil: 0,
      insightDateLabel: '',
      insightDepartToday: false,
      insightCountdownToneClass: '',
      metrics: buildEmptyPlanPageMetrics(),
      hasPlans: false,
    }
  }

  const { upcomingPlans } = partitionPlansByTripStatus(plans)
  return buildPlanPageHeaderFromPlans(upcomingPlans)
}
