import { planItemRepository } from '../repositories/storageRepository'
import type { PlanItem } from '../utils/models'

export interface PlanCoreStats {
  tripQuantity: number
  tripWeightG: number
  backpackWeightG: number
  calorieKcal: number
  backpackItems: PlanItem[]
  nonBackpackItems: PlanItem[]
}

const isActivePlanItem = (item: PlanItem, planId: string): boolean => {
  return !item.deleted && item.plan_id === planId
}

const isBackpackItem = (item: PlanItem): boolean => {
  return item.carry_type === 'carried'
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

const itemCalorieKcal = (item: PlanItem): number => {
  const calorie = item.calorie_kcal_snapshot

  if (typeof calorie !== 'number' || !Number.isFinite(calorie) || calorie <= 0) {
    return 0
  }

  return calorie * safeQuantity(item)
}

export const getPlanItemsByPackGroup = (
  planId: string,
): { backpackItems: PlanItem[]; nonBackpackItems: PlanItem[] } => {
  const items = planItemRepository.list().filter((item) => isActivePlanItem(item, planId))

  return items.reduce<{ backpackItems: PlanItem[]; nonBackpackItems: PlanItem[] }>(
    (groups, item) => {
      if (isBackpackItem(item)) {
        groups.backpackItems.push(item)
        return groups
      }

      groups.nonBackpackItems.push(item)
      return groups
    },
    {
      backpackItems: [],
      nonBackpackItems: [],
    },
  )
}

export const getPlanCoreStats = (planId: string): PlanCoreStats => {
  const groups = getPlanItemsByPackGroup(planId)
  const allItems = [...groups.backpackItems, ...groups.nonBackpackItems]

  return {
    tripQuantity: allItems.reduce((sum, item) => sum + safeQuantity(item), 0),
    tripWeightG: allItems.reduce((sum, item) => sum + itemWeightG(item), 0),
    backpackWeightG: groups.backpackItems.reduce((sum, item) => sum + itemWeightG(item), 0),
    calorieKcal: allItems.reduce((sum, item) => sum + itemCalorieKcal(item), 0),
    backpackItems: groups.backpackItems,
    nonBackpackItems: groups.nonBackpackItems,
  }
}
