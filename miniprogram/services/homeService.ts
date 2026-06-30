import { getHomeActivePlanId, setHomeActivePlanId } from '../repositories/userProfileRepository'
import { evaluateCalorieRecommendForPlan } from './calorieRecommendService'
import type { CalorieRecommendView } from './calorieRecommendService'
import { evaluateComfortForPlan } from './comfortService'
import type { ComfortView } from './comfortService'
import { getPlanList } from './dashboardService'
import { getPlanOverview } from './planOverviewService'
import { resolveActivePlanId } from './planService'

export interface HomePlanCarouselItem {
  id: string
  name: string
  routeLabel: string
  dayNightLabel: string
  dayNightToneClass: string
  tripDateLabel: string
  tripDateToneClass: string
  showTripCountdown: boolean
  tripCountdownLabel: string
  tripWeight: string
  backpackWeight: string
  backpackWeightJinLabel: string
  calorieKcalLabel: string
  calorieRecommend: CalorieRecommendView
  hasItems: boolean
  comfort: ComfortView
}

export interface HomePlanChecklistNote {
  title: string
  desc: string
  tapAction: 'packing' | 'overview' | 'plans'
}

export const getHomePlanChecklistNote = (
  hasPlans: boolean,
  planId: string,
  planHasItems: boolean,
): HomePlanChecklistNote => {
  if (!hasPlans) {
    return {
      title: '出行清单',
      desc: '创建方案后即可整理要带哪些装备',
      tapAction: 'plans',
    }
  }

  if (!planId || !planHasItems) {
    return {
      title: '出行清单',
      desc: '清单还是空的，去打包工作台添加装备',
      tapAction: 'packing',
    }
  }

  const overview = getPlanOverview(planId)

  return {
    title: '出行清单',
    desc: `${overview.tripQuantity} 件 · 出行 ${overview.tripWeight} · 背包 ${overview.backpackWeight}`,
    tapAction: 'overview',
  }
}

export const resolveHomeActivePlanId = (): string => {
  const plans = getPlanList()
  const savedPlanId = getHomeActivePlanId()

  if (savedPlanId) {
    const matched = plans.find((plan) => plan.id === savedPlanId)
    if (matched) {
      return matched.id
    }
  }

  const defaultPlan = plans.find((plan) => plan.id === resolveActivePlanId()) || plans[0]
  return defaultPlan ? defaultPlan.id : ''
}

export const rememberHomeActivePlanId = (planId: string): void => {
  if (!planId) {
    return
  }

  setHomeActivePlanId(planId)
}

export const getHomePlanCarouselItems = (): HomePlanCarouselItem[] => {
  return getPlanList().map((plan) => {
    const overview = getPlanOverview(plan.id)
    const showTripCountdown = plan.daysUntil !== null && plan.daysUntil >= 0
    const tripCountdownLabel = !showTripCountdown
      ? ''
      : plan.daysUntil === 0
        ? '今天'
        : `还有${plan.daysUntil}天`
    const backpackWeightJinLabel = overview.backpackWeightJinLabel || ''

    return {
      id: plan.id,
      name: plan.name,
      routeLabel: plan.route && plan.route.trim() ? plan.route.trim() : '暂无路线',
      dayNightLabel: plan.dayNightLabel,
      dayNightToneClass: plan.dayNightToneClass,
      tripDateLabel: plan.tripDateLabel,
      tripDateToneClass: plan.tripDateToneClass,
      showTripCountdown,
      tripCountdownLabel,
      tripWeight: overview.tripWeight,
      backpackWeight: overview.backpackWeight,
      backpackWeightJinLabel,
      calorieKcalLabel: overview.calorieKcalLabel,
      calorieRecommend: evaluateCalorieRecommendForPlan(plan.id, plan.days),
      hasItems: !overview.isEmpty,
      comfort: evaluateComfortForPlan(plan.id),
    }
  })
}

export const findHomePlanCarouselIndex = (planId: string, items: HomePlanCarouselItem[]): number => {
  if (!planId || items.length === 0) {
    return 0
  }

  const index = items.findIndex((item) => item.id === planId)
  return index >= 0 ? index : 0
}

export const getActiveHomePlan = (
  planId: string,
  items: HomePlanCarouselItem[],
): HomePlanCarouselItem | null => {
  if (!planId || items.length === 0) {
    return null
  }

  const matched = items.find((item) => item.id === planId)
  return matched || items[0] || null
}
