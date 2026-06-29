import { getDashboardSummary } from './dashboardService'
import { listGears, getGearOwnedValueCent, getGearOwnedWeightG, normalizeGearQuantity } from './gearService'
import { getPlanOverview } from './planOverviewService'
import { centToYuan, formatWeight } from './unitService'
import {
  GEAR_CATEGORY_COLORS,
  GEAR_CATEGORY_NAMES,
  GEAR_CATEGORY_ORDER,
  normalizeGearCategory,
} from '../utils/gearMeta'
import { sortPieSlicesByValueAsc, type PieSliceInput } from '../utils/pieChart'

export type HomeOverviewScope = 'gear' | 'plan'
export type HomeOverviewMode = 'weight' | 'value'

export interface HomeOverviewSwitchItem {
  id: string
  label: string
  activeClass: string
}

export interface HomeOverviewLegendItem {
  name: string
  percent: string
  value: string
  dotColor: string
}

export interface HomeOverviewEmptyView {
  title: string
  ctaLabel: string
  ctaAction: 'add' | 'plans' | 'packing' | 'overview'
}

export interface HomeOverviewView {
  scope: HomeOverviewScope
  mode: HomeOverviewMode
  scopeSwitches: HomeOverviewSwitchItem[]
  modeLabel: string
  showEmpty: boolean
  empty: HomeOverviewEmptyView
  showChart: boolean
  pieSlices: PieSliceInput[]
  chartKey: string
  centerValue: string
  centerLabel: string
  legendItems: HomeOverviewLegendItem[]
}

const buildScopeSwitches = (scope: HomeOverviewScope): HomeOverviewSwitchItem[] => {
  const items: Array<{ id: HomeOverviewScope; label: string }> = [
    { id: 'gear', label: '装备库' },
    { id: 'plan', label: '当前方案' },
  ]

  return items.map((item) => ({
    id: item.id,
    label: item.label,
    activeClass: item.id === scope ? 'active' : '',
  }))
}

const buildModeLabel = (scope: HomeOverviewScope, mode: HomeOverviewMode): string => {
  if (scope === 'gear') {
    return mode === 'weight' ? '装备重量' : '装备价值'
  }

  return mode === 'weight' ? '出行重量' : '方案价值'
}

const formatPrice = (priceCent: number): string => {
  return `${centToYuan(priceCent).toFixed(0)}元`
}

const mapGearSlices = (mode: HomeOverviewMode): PieSliceInput[] => {
  const gears = listGears()
  const totalWeightG = gears.reduce((sum, gear) => sum + getGearOwnedWeightG(gear), 0)
  const totalValueCent = gears.reduce((sum, gear) => sum + getGearOwnedValueCent(gear), 0)
  const slices: PieSliceInput[] = []

  GEAR_CATEGORY_ORDER.forEach((category) => {
    const categoryGears = gears.filter((gear) => normalizeGearCategory(gear.category) === category)
    const categoryWeightG = categoryGears.reduce((sum, gear) => sum + getGearOwnedWeightG(gear), 0)
    const categoryValueCent = categoryGears.reduce((sum, gear) => sum + getGearOwnedValueCent(gear), 0)

    if (categoryWeightG <= 0 && categoryValueCent <= 0) {
      return
    }

    if (mode === 'value') {
      slices.push({
        color: GEAR_CATEGORY_COLORS[category],
        label: GEAR_CATEGORY_NAMES[category],
        percent: totalValueCent ? ((categoryValueCent / totalValueCent) * 100).toFixed(1) : '0.0',
        weight: formatPrice(categoryValueCent),
        value: categoryValueCent,
      })
      return
    }

    slices.push({
      color: GEAR_CATEGORY_COLORS[category],
      label: GEAR_CATEGORY_NAMES[category],
      percent: totalWeightG ? ((categoryWeightG / totalWeightG) * 100).toFixed(1) : '0.0',
      weight: formatWeight(categoryWeightG),
      value: categoryWeightG,
    })
  })

  return sortPieSlicesByValueAsc(slices)
}

const mapPlanSlices = (planId: string, mode: HomeOverviewMode): PieSliceInput[] => {
  const overview = getPlanOverview(planId)

  if (overview.isEmpty) {
    return []
  }

  if (mode === 'value') {
    return sortPieSlicesByValueAsc(overview.sections.map((section) => ({
      color: section.dotColor,
      label: section.name,
      percent: section.valuePercent,
      weight: section.value,
      value: section.valueCent,
    })))
  }

  return overview.categoryPieSlices
}

const buildLegendItems = (slices: PieSliceInput[]): HomeOverviewLegendItem[] => {
  return slices.map((slice) => ({
    name: slice.label,
    percent: slice.percent,
    value: slice.weight,
    dotColor: slice.color,
  }))
}

const resolveGearCenter = (mode: HomeOverviewMode): { centerValue: string; centerLabel: string } => {
  const summary = getDashboardSummary()

  if (mode === 'value') {
    return {
      centerValue: summary.totalGearValue,
      centerLabel: '总价值',
    }
  }

  return {
    centerValue: summary.totalGearWeight,
    centerLabel: '总重量',
  }
}

const resolvePlanCenter = (
  planId: string,
  mode: HomeOverviewMode,
): { centerValue: string; centerLabel: string } => {
  const overview = getPlanOverview(planId)

  if (mode === 'value') {
    return {
      centerValue: overview.totalValue,
      centerLabel: '总价值',
    }
  }

  return {
    centerValue: overview.tripWeight,
    centerLabel: '总重量',
  }
}

const resolveEmptyView = (
  scope: HomeOverviewScope,
  gearCount: number,
  hasPlans: boolean,
  planHasItems: boolean,
): HomeOverviewEmptyView | null => {
  if (scope === 'gear' && gearCount <= 0) {
    return {
      title: '还没有装备',
      ctaLabel: '添加第一件装备',
      ctaAction: 'add',
    }
  }

  if (scope === 'plan' && !hasPlans) {
    return {
      title: '装备已就绪',
      ctaLabel: '创建出行方案',
      ctaAction: 'plans',
    }
  }

  if (scope === 'plan' && !planHasItems) {
    return {
      title: '方案还没有清单',
      ctaLabel: '去打包',
      ctaAction: 'packing',
    }
  }

  return null
}

export const getHomeOverviewView = (
  scope: HomeOverviewScope,
  mode: HomeOverviewMode,
  planId: string,
  gearCount: number,
  hasPlans: boolean,
  planHasItems: boolean,
): HomeOverviewView => {
  const emptyView = resolveEmptyView(scope, gearCount, hasPlans, planHasItems)
  const scopeSwitches = buildScopeSwitches(scope)
  const modeLabel = buildModeLabel(scope, mode)

  if (emptyView) {
    return {
      scope,
      mode,
      scopeSwitches,
      modeLabel,
      showEmpty: true,
      empty: emptyView,
      showChart: false,
      pieSlices: [],
      chartKey: `${scope}-${mode}-empty`,
      centerValue: '--',
      centerLabel: mode === 'value' ? '总价值' : '总重量',
      legendItems: [],
    }
  }

  const pieSlices =
    scope === 'gear' ? mapGearSlices(mode) : mapPlanSlices(planId, mode)
  const center =
    scope === 'gear' ? resolveGearCenter(mode) : resolvePlanCenter(planId, mode)
  const chartKey = `${scope}-${mode}-${scope === 'plan' ? planId : 'gear'}`

  return {
    scope,
    mode,
    scopeSwitches,
    modeLabel,
    showEmpty: false,
    empty: {
      title: '',
      ctaLabel: '',
      ctaAction: 'overview',
    },
    showChart: pieSlices.length > 0,
    pieSlices,
    chartKey,
    centerValue: center.centerValue,
    centerLabel: center.centerLabel,
    legendItems: buildLegendItems(pieSlices),
  }
}
