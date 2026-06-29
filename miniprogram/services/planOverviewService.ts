import { planItemRepository } from '../repositories/storageRepository'
import { getPlanById } from './planService'
import { centToYuan, formatWeight } from './unitService'
import {
  GEAR_CATEGORY_COLORS,
  GEAR_CATEGORY_NAMES,
  GEAR_CATEGORY_ORDER,
  GEAR_STATUS_NAMES,
  normalizeGearCategory,
  normalizeGearStatus,
} from '../utils/gearMeta'
import type { CarryType, GearCategory, GearStatus, PackedStatus, PlanItem } from '../utils/models'
import { listGears } from './gearService'
import { formatDayNight, resolveDayNightToneClass } from '../utils/tripMeta'
import { sortPieSlicesByValueAsc } from '../utils/pieChart'

const EXPAND_ALL_THRESHOLD = 10

export interface PlanOverviewItemView {
  id: string
  name: string
  weight: string
  quantityLabel: string
  calorieLabel: string
  carryLabel: string
  carryToneClass: string
  statusLabel: string
  statusToneClass: string
  price: string
}

export interface PlanOverviewSectionView {
  id: GearCategory
  anchorId: string
  name: string
  dotColor: string
  tintColor: string
  itemCount: number
  weight: string
  weightPercent: string
  value: string
  valuePercent: string
  valueCent: number
  calorieLabel: string
  showCalorieSubtotal: boolean
  expanded: boolean
  items: PlanOverviewItemView[]
}

export interface PlanOverviewChartItemView {
  name: string
  dotColor: string
  weightPercent: string
  valuePercent: string
  weight: string
  valueLabel: string
  barPercent: number
  value: number
}

export interface PlanOverviewPieSlice {
  color: string
  label: string
  percent: string
  weight: string
  value: number
}

export interface PlanOverviewAnchorView {
  id: string
  name: string
  categoryId: GearCategory
  dotColor: string
  active?: boolean
}

export interface PlanOverviewWeightBreakdownView {
  wornWeight: string
  consumableWeight: string
  baseWeight: string
  wornPercent: number
  consumablePercent: number
  basePercent: number
  wornWeightG: number
  consumableWeightG: number
  baseWeightG: number
}

export interface PlanOverviewView {
  planId: string
  planName: string
  route: string
  dayNightLabel: string
  dayNightToneClass: string
  isDefault: boolean
  isEmpty: boolean
  useAccordion: boolean
  showAnchors: boolean
  tripQuantity: number
  tripWeightG: number
  tripWeight: string
  backpackWeight: string
  totalValue: string
  calorieKcal: number
  calorieKcalLabel: string
  dailyCalorieLabel: string
  packedPercent: string
  weightBreakdown: PlanOverviewWeightBreakdownView
  categoryPieSlices: PlanOverviewPieSlice[]
  breakdownPieSlices: PlanOverviewPieSlice[]
  anchors: PlanOverviewAnchorView[]
  sections: PlanOverviewSectionView[]
  chartItems: PlanOverviewChartItemView[]
}

const CATEGORY_TINTS: Record<GearCategory, string> = {
  carry: '#f3f0fc',
  sleep: '#edf5fd',
  clothing: '#edf8f2',
  food: '#fff5ea',
  safety: '#fdf0f6',
  electronics: '#f0f2fd',
  supply: '#fdf8ec',
  other: '#f3f4f5',
}

const isActivePlanItem = (item: PlanItem, planId: string): boolean => {
  return !item.deleted && item.plan_id === planId
}

const safeQuantity = (item: PlanItem): number => {
  if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
    return 0
  }

  return item.quantity
}

const itemWeightG = (item: PlanItem): number => {
  return item.weight_g_snapshot * safeQuantity(item)
}

const itemValueCent = (item: PlanItem): number => {
  return item.price_cent_snapshot * safeQuantity(item)
}

const itemCalorieKcal = (item: PlanItem): number => {
  const calorie = item.calorie_kcal_snapshot

  if (typeof calorie !== 'number' || !Number.isFinite(calorie) || calorie <= 0) {
    return 0
  }

  return calorie * safeQuantity(item)
}

const formatPriceYuan = (priceCent: number): string => {
  if (priceCent <= 0) {
    return '--'
  }

  return `${centToYuan(priceCent).toFixed(0)}元`
}

const resolveCarryLabel = (carryType: CarryType): string => {
  if (carryType === 'carried') {
    return '背负'
  }

  if (carryType === 'worn') {
    return '装备'
  }

  if (carryType === 'consumable') {
    return '消耗'
  }

  return '共享'
}

const resolveCarryToneClass = (carryType: CarryType): string => {
  if (carryType === 'carried') {
    return 'carry-carried'
  }

  if (carryType === 'worn') {
    return 'carry-worn'
  }

  if (carryType === 'consumable') {
    return 'carry-consumable'
  }

  return 'carry-shared'
}

const resolveGearStatusToneClass = (status: GearStatus): string => {
  return `gear-status-${status}`
}

const resolveItemGearStatus = (
  item: PlanItem,
  gearStatusMap: Record<string, GearStatus>,
): GearStatus => {
  if (item.status_snapshot) {
    return normalizeGearStatus(item.status_snapshot)
  }

  if (item.gear_id && gearStatusMap[item.gear_id]) {
    return gearStatusMap[item.gear_id]
  }

  return 'idle'
}

const buildGearStatusMap = (): Record<string, GearStatus> => {
  const gearStatusMap: Record<string, GearStatus> = {}

  listGears().forEach((gear) => {
    gearStatusMap[gear.id] = normalizeGearStatus(gear.status)
  })

  return gearStatusMap
}

const isPlanItemPacked = (packedStatus: PackedStatus): boolean => {
  if (packedStatus === 'packed' || packedStatus === 'unpacked') {
    return true
  }

  return false
}

const shouldShowItemCalorie = (category: GearCategory): boolean => {
  return category === 'supply'
}

const shouldShowCategoryCalorie = (category: GearCategory): boolean => {
  return category === 'supply'
}

const buildQuantityLabel = (quantity: number): string => {
  if (quantity > 1) {
    return `×${quantity}`
  }

  return ''
}

const buildItemView = (
  item: PlanItem,
  gearStatusMap: Record<string, GearStatus>,
): PlanOverviewItemView => {
  const category = normalizeGearCategory(item.category_snapshot)
  const quantity = safeQuantity(item)
  const calorieKcal = itemCalorieKcal(item)
  const gearStatus = resolveItemGearStatus(item, gearStatusMap)
  let calorieLabel = ''

  if (shouldShowItemCalorie(category) && calorieKcal > 0) {
    calorieLabel = `${Math.round(calorieKcal)} kcal`
  }

  return {
    id: item.id,
    name: item.name_snapshot,
    weight: formatWeight(itemWeightG(item)),
    quantityLabel: buildQuantityLabel(quantity),
    calorieLabel,
    carryLabel: resolveCarryLabel(item.carry_type),
    carryToneClass: resolveCarryToneClass(item.carry_type),
    statusLabel: GEAR_STATUS_NAMES[gearStatus],
    statusToneClass: resolveGearStatusToneClass(gearStatus),
    price: formatPriceYuan(itemValueCent(item)),
  }
}

const buildPackedPercent = (items: PlanItem[]): string => {
  let needPack = 0
  let packed = 0

  items.forEach((item) => {
    if (item.packed_status === 'not_needed') {
      return
    }

    needPack += 1

    if (isPlanItemPacked(item.packed_status)) {
      packed += 1
    }
  })

  if (needPack <= 0) {
    return '--'
  }

  return `${Math.round((packed / needPack) * 100)}%`
}

const buildWeightBreakdown = (
  items: PlanItem[],
  tripWeightG: number,
): PlanOverviewWeightBreakdownView => {
  let wornWeightG = 0
  let consumableWeightG = 0
  let baseWeightG = 0

  items.forEach((item) => {
    const weight = itemWeightG(item)

    if (item.carry_type === 'worn') {
      wornWeightG += weight
    }

    if (item.is_consumable) {
      consumableWeightG += weight
    }

    if (item.carry_type === 'carried' && !item.is_consumable) {
      baseWeightG += weight
    }
  })

  const denominator = tripWeightG > 0 ? tripWeightG : 1

  return {
    wornWeight: formatWeight(wornWeightG),
    consumableWeight: formatWeight(consumableWeightG),
    baseWeight: formatWeight(baseWeightG),
    wornPercent: Math.round((wornWeightG / denominator) * 100),
    consumablePercent: Math.round((consumableWeightG / denominator) * 100),
    basePercent: Math.round((baseWeightG / denominator) * 100),
    wornWeightG,
    consumableWeightG,
    baseWeightG,
  }
}

const buildBreakdownPieSlices = (
  breakdown: PlanOverviewWeightBreakdownView,
  tripWeightG: number,
): PlanOverviewPieSlice[] => {
  const slices: PlanOverviewPieSlice[] = []

  if (breakdown.baseWeightG > 0) {
    slices.push({
      color: '#8067d8',
      label: '基础重量',
      percent: tripWeightG > 0 ? ((breakdown.baseWeightG / tripWeightG) * 100).toFixed(1) : '0.0',
      weight: breakdown.baseWeight,
      value: breakdown.baseWeightG,
    })
  }

  if (breakdown.wornWeightG > 0) {
    slices.push({
      color: '#34b979',
      label: '装备重量',
      percent: tripWeightG > 0 ? ((breakdown.wornWeightG / tripWeightG) * 100).toFixed(1) : '0.0',
      weight: breakdown.wornWeight,
      value: breakdown.wornWeightG,
    })
  }

  if (breakdown.consumableWeightG > 0) {
    slices.push({
      color: '#ff9f30',
      label: '消耗品',
      percent: tripWeightG > 0 ? ((breakdown.consumableWeightG / tripWeightG) * 100).toFixed(1) : '0.0',
      weight: breakdown.consumableWeight,
      value: breakdown.consumableWeightG,
    })
  }

  return sortPieSlicesByValueAsc(slices)
}

const emptyOverview = (planId: string): PlanOverviewView => {
  return {
    planId,
    planName: '方案不存在',
    route: '暂无路线',
    dayNightLabel: '1天0夜',
    dayNightToneClass: resolveDayNightToneClass(1),
    isDefault: false,
    isEmpty: true,
    useAccordion: false,
    showAnchors: false,
    tripQuantity: 0,
    tripWeightG: 0,
    tripWeight: '--',
    backpackWeight: '--',
    totalValue: '--',
    calorieKcal: 0,
    calorieKcalLabel: '0',
    dailyCalorieLabel: '--',
    packedPercent: '--',
    weightBreakdown: {
      wornWeight: '--',
      consumableWeight: '--',
      baseWeight: '--',
      wornPercent: 0,
      consumablePercent: 0,
      basePercent: 0,
      wornWeightG: 0,
      consumableWeightG: 0,
      baseWeightG: 0,
    },
    categoryPieSlices: [],
    breakdownPieSlices: [],
    anchors: [],
    sections: [],
    chartItems: [],
  }
}

export const getPlanOverview = (planId: string): PlanOverviewView => {
  const plan = getPlanById(planId)

  if (!plan) {
    return emptyOverview(planId)
  }

  const items = planItemRepository.list().filter((item) => isActivePlanItem(item, planId))
  const gearStatusMap = buildGearStatusMap()
  const tripQuantity = items.reduce((sum, item) => sum + safeQuantity(item), 0)
  const tripWeightG = items.reduce((sum, item) => sum + itemWeightG(item), 0)
  const backpackWeightG = items.reduce((sum, item) => {
    if (item.carry_type !== 'carried') {
      return sum
    }

    return sum + itemWeightG(item)
  }, 0)
  const totalValueCent = items.reduce((sum, item) => sum + itemValueCent(item), 0)
  const calorieKcal = items.reduce((sum, item) => sum + itemCalorieKcal(item), 0)
  const useAccordion = tripQuantity >= EXPAND_ALL_THRESHOLD
  const showAnchors = useAccordion
  const sections: PlanOverviewSectionView[] = []
  const chartItems: PlanOverviewChartItemView[] = []
  const anchors: PlanOverviewAnchorView[] = []

  GEAR_CATEGORY_ORDER.forEach((category) => {
    const categoryItems = items.filter((item) => normalizeGearCategory(item.category_snapshot) === category)

    if (categoryItems.length <= 0) {
      return
    }

    const categoryWeightG = categoryItems.reduce((sum, item) => sum + itemWeightG(item), 0)
    const categoryValueCent = categoryItems.reduce((sum, item) => sum + itemValueCent(item), 0)
    const categoryCalorieKcal = categoryItems.reduce((sum, item) => sum + itemCalorieKcal(item), 0)
    const anchorId = `section-${category}`
    const showCalorieSubtotal = shouldShowCategoryCalorie(category)
    let calorieLabel = ''

    if (showCalorieSubtotal && categoryCalorieKcal > 0) {
      calorieLabel = `${Math.round(categoryCalorieKcal)} kcal`
    }

    const expanded = !useAccordion

    sections.push({
      id: category,
      anchorId,
      name: GEAR_CATEGORY_NAMES[category],
      dotColor: GEAR_CATEGORY_COLORS[category],
      tintColor: CATEGORY_TINTS[category],
      itemCount: categoryItems.reduce((sum, item) => sum + safeQuantity(item), 0),
      weight: formatWeight(categoryWeightG),
      weightPercent: tripWeightG > 0 ? ((categoryWeightG / tripWeightG) * 100).toFixed(1) : '0.0',
      value: formatPriceYuan(categoryValueCent),
      valuePercent: totalValueCent > 0 ? ((categoryValueCent / totalValueCent) * 100).toFixed(1) : '0.0',
      valueCent: categoryValueCent,
      calorieLabel,
      showCalorieSubtotal,
      expanded,
      items: categoryItems.map((item) => buildItemView(item, gearStatusMap)),
    })

    chartItems.push({
      name: GEAR_CATEGORY_NAMES[category],
      dotColor: GEAR_CATEGORY_COLORS[category],
      weightPercent: tripWeightG > 0 ? ((categoryWeightG / tripWeightG) * 100).toFixed(1) : '0.0',
      valuePercent: totalValueCent > 0 ? ((categoryValueCent / totalValueCent) * 100).toFixed(1) : '0.0',
      weight: formatWeight(categoryWeightG),
      valueLabel: formatPriceYuan(categoryValueCent),
      barPercent: tripWeightG > 0 ? Math.round((categoryWeightG / tripWeightG) * 100) : 0,
      value: categoryWeightG,
    })

    anchors.push({
      id: anchorId,
      name: GEAR_CATEGORY_NAMES[category],
      categoryId: category,
      dotColor: GEAR_CATEGORY_COLORS[category],
    })
  })

  let dailyCalorieLabel = '--'

  if (calorieKcal > 0 && plan.days > 0) {
    dailyCalorieLabel = `${Math.round(calorieKcal / plan.days)} kcal/天`
  }

  const weightBreakdown = buildWeightBreakdown(items, tripWeightG)
  const categoryPieSlices = sortPieSlicesByValueAsc(chartItems.map((item) => ({
    color: item.dotColor,
    label: item.name,
    percent: item.weightPercent,
    weight: item.weight,
    value: item.value,
  })))
  const breakdownPieSlices = buildBreakdownPieSlices(weightBreakdown, tripWeightG)

  return {
    planId: plan.id,
    planName: plan.name,
    route: plan.route || '暂无路线',
    dayNightLabel: formatDayNight(plan.days),
    dayNightToneClass: resolveDayNightToneClass(plan.days),
    isDefault: plan.is_default,
    isEmpty: items.length <= 0,
    useAccordion,
    showAnchors,
    tripQuantity,
    tripWeightG,
    tripWeight: tripWeightG > 0 ? formatWeight(tripWeightG) : '--',
    backpackWeight: backpackWeightG > 0 ? formatWeight(backpackWeightG) : '--',
    totalValue: totalValueCent > 0 ? formatPriceYuan(totalValueCent) : '--',
    calorieKcal,
    calorieKcalLabel: `${Math.round(calorieKcal)}`,
    dailyCalorieLabel,
    packedPercent: buildPackedPercent(items),
    weightBreakdown,
    categoryPieSlices,
    breakdownPieSlices,
    anchors,
    sections,
    chartItems,
  }
}

export const collectExpandedCategoryIds = (
  sections: PlanOverviewSectionView[],
): GearCategory[] => {
  const expandedCategoryIds: GearCategory[] = []

  sections.forEach((section) => {
    if (section.expanded) {
      expandedCategoryIds.push(section.id)
    }
  })

  return expandedCategoryIds
}

export const mergePlanOverviewSectionExpanded = (
  sections: PlanOverviewSectionView[],
  useAccordion: boolean,
  expandedCategoryIds: GearCategory[],
): PlanOverviewSectionView[] => {
  if (!useAccordion) {
    return sections.map((section) => ({
      ...section,
      expanded: true,
    }))
  }

  return sections.map((section) => ({
    ...section,
    expanded: expandedCategoryIds.indexOf(section.id) >= 0,
  }))
}

export const togglePlanOverviewSection = (
  sections: PlanOverviewSectionView[],
  categoryId: GearCategory,
): PlanOverviewSectionView[] => {
  return sections.map((section) => {
    if (section.id !== categoryId) {
      return section
    }

    return {
      ...section,
      expanded: !section.expanded,
    }
  })
}

export const expandPlanOverviewSection = (
  sections: PlanOverviewSectionView[],
  categoryId: GearCategory,
): PlanOverviewSectionView[] => {
  return sections.map((section) => {
    if (section.id !== categoryId) {
      return section
    }

    return {
      ...section,
      expanded: true,
    }
  })
}
