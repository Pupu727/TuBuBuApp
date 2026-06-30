import { planItemRepository } from '../repositories/storageRepository'
import type { CarryType, GearCategory, PlanItem } from '../utils/models'
import { GEAR_CATEGORY_NAMES } from '../utils/gearMeta'
import { isCompletedTripPlan } from '../utils/planDate'
import { listGears } from './gearService'
import { createPlan, getPlanById, listPlans } from './planService'
import { createPlanItemFromGear } from './planItemService'
import { formatWeight } from './unitService'

export type PackingTarget = 'bag' | 'nonBag'

export interface PackingDraftInput {
  gearId: string
  quantity: number
  target: PackingTarget
}

export interface PackingDraftItem {
  gearId: string
  name: string
  category: GearCategory
  categoryName: string
  weightG: number
  weight: string
  calorieKcal: number
  quantity: number
  target: PackingTarget
}

export interface CreatePlanFromPackingInput {
  name: string
  sourcePlanId: string
  items: PackingDraftInput[]
}

export type CreatePlanFromPackingResult =
  | { ok: true; planId: string; mode: 'created' | 'updated' }
  | { ok: false; message: string }

export interface CopyablePlanOption {
  id: string
  name: string
}

export interface SwitchablePlanOption {
  id: string
  name: string
}

export type CopyPackingResult =
  | { ok: true; items: PackingDraftItem[]; skippedGearCount: number }
  | { ok: false; message: string }

const normalizeQuantity = (quantity: number): number => {
  if (!Number.isFinite(quantity) || quantity < 1) {
    return 1
  }

  return Math.round(quantity)
}

const targetToCarryType = (target: PackingTarget): CarryType => {
  return target === 'bag' ? 'carried' : 'worn'
}

const carryTypeToTarget = (carryType: CarryType): PackingTarget => {
  return carryType === 'carried' ? 'bag' : 'nonBag'
}

const activePlanItems = (planId: string): PlanItem[] => {
  return planItemRepository.list().filter((item) => !item.deleted && item.plan_id === planId)
}

const createPlanItems = (planId: string, inputItems: PackingDraftInput[], gears: ReturnType<typeof listGears>): PlanItem[] => {
  return inputItems.reduce<PlanItem[]>((items, draftItem) => {
    const gear = gears.find((gearItem) => gearItem.id === draftItem.gearId)

    if (!gear) {
      return items
    }

    items.push(createPlanItemFromGear({
      planId,
      gear,
      quantity: normalizeQuantity(draftItem.quantity),
      carryType: targetToCarryType(draftItem.target),
      packedStatus: 'packed',
      calorieKcal: (gear.calorie_kcal || 0) > 0 ? (gear.calorie_kcal || 0) : 0,
    }))

    return items
  }, [])
}

const saveUpdatedPlanItems = (planId: string, planItems: PlanItem[]): void => {
  const timestamp = new Date().toISOString()
  const existingItems = planItemRepository.list()
  const nextItems = existingItems.map((item) => {
    if (item.plan_id !== planId || item.deleted) {
      return item
    }

    return {
      ...item,
      deleted: true,
      updated_at: timestamp,
    }
  })

  planItemRepository.saveAll([...nextItems, ...planItems])
}

export const savePackingToPlan = (planId: string, items: PackingDraftInput[]): CreatePlanFromPackingResult => {
  if (!planId) {
    return { ok: false, message: '当前没有可保存的方案' }
  }

  const plan = getPlanById(planId)

  if (!plan) {
    return { ok: false, message: '方案不存在或已删除' }
  }

  const gears = listGears()
  const missingItem = items.find((item) => !gears.some((gear) => gear.id === item.gearId))

  if (missingItem) {
    return { ok: false, message: '装备不存在或已删除' }
  }

  const planItems = createPlanItems(planId, items, gears)

  saveUpdatedPlanItems(planId, planItems)

  return { ok: true, planId, mode: 'updated' }
}

export const createPlanFromPacking = (input: CreatePlanFromPackingInput): CreatePlanFromPackingResult => {
  if (input.items.length === 0) {
    return { ok: false, message: '请先加入装备' }
  }

  const gears = listGears()
  const missingItem = input.items.find((item) => !gears.some((gear) => gear.id === item.gearId))

  if (missingItem) {
    return { ok: false, message: '装备不存在或已删除' }
  }

  const sourcePlan = input.sourcePlanId ? getPlanById(input.sourcePlanId) : undefined
  const existingPlanId = sourcePlan ? sourcePlan.id : ''

  if (existingPlanId) {
    return savePackingToPlan(existingPlanId, input.items)
  }

  const planResult = createPlan({
    name: input.name.trim() || '默认方案',
    route: '',
    start_date: sourcePlan ? sourcePlan.start_date : '',
    end_date: sourcePlan ? sourcePlan.end_date : '',
    days: sourcePlan ? sourcePlan.days : 1,
    trip_type: sourcePlan ? sourcePlan.trip_type : 'overnight',
    weather_note: sourcePlan ? sourcePlan.weather_note : '',
    target_weight_g: sourcePlan ? sourcePlan.target_weight_g : 0,
    remark: sourcePlan ? sourcePlan.remark : '',
  })

  if (!planResult.ok) {
    return { ok: false, message: planResult.message }
  }

  const planItems = createPlanItems(planResult.plan.id, input.items, gears)

  planItemRepository.saveAll([...planItemRepository.list(), ...planItems])

  return { ok: true, planId: planResult.plan.id, mode: 'created' }
}

export const getPackingDraftItems = (planId: string): PackingDraftItem[] => {
  if (!planId) {
    return []
  }

  return activePlanItems(planId).map((item) => ({
    gearId: item.gear_id,
    name: item.name_snapshot,
    category: item.category_snapshot,
    categoryName: GEAR_CATEGORY_NAMES[item.category_snapshot],
    weightG: item.weight_g_snapshot,
    weight: formatWeight(item.weight_g_snapshot * item.quantity),
    calorieKcal: item.calorie_kcal_snapshot || 0,
    quantity: normalizeQuantity(item.quantity),
    target: carryTypeToTarget(item.carry_type),
  }))
}

const getPlanPackedWeightG = (planId: string): number => {
  return getPackingDraftItems(planId).reduce((sum, item) => sum + item.weightG * item.quantity, 0)
}

export const hasCopyablePackingContent = (planId: string): boolean => {
  return getPlanPackedWeightG(planId) > 0
}

export const getCopyablePlanOptions = (activePlanId: string): CopyablePlanOption[] => {
  const options = listPlans()
    .filter((plan) => hasCopyablePackingContent(plan.id) || plan.id === activePlanId)
    .map((plan) => ({
      id: plan.id,
      name: plan.name,
    }))

  const currentPlan = options.find((plan) => plan.id === activePlanId)

  if (!currentPlan) {
    return options
  }

  return [currentPlan, ...options.filter((plan) => plan.id !== activePlanId)]
}

export const getSwitchablePlanOptions = (activePlanId: string): SwitchablePlanOption[] => {
  const options = listPlans()
    .filter((plan) => !isCompletedTripPlan(plan.start_date))
    .map((plan) => ({
      id: plan.id,
      name: plan.name,
    }))

  const currentPlan = options.find((plan) => plan.id === activePlanId)

  if (!currentPlan) {
    return options
  }

  return [currentPlan, ...options.filter((plan) => plan.id !== activePlanId)]
}

const getDraftInputsWeightG = (items: PackingDraftInput[]): number => {
  const gears = listGears()

  return items.reduce((sum, item) => {
    const gear = gears.find((gearItem) => gearItem.id === item.gearId)

    if (!gear) {
      return sum
    }

    return sum + gear.weight_g * normalizeQuantity(item.quantity)
  }, 0)
}

export const copyPackingToPlan = (targetPlanId: string, sourcePlanId: string): CopyPackingResult => {
  const targetPlan = targetPlanId ? getPlanById(targetPlanId) : undefined
  const sourcePlan = sourcePlanId ? getPlanById(sourcePlanId) : undefined

  if (!targetPlan) {
    return { ok: false, message: '当前方案不存在或已删除' }
  }

  if (!sourcePlan) {
    return { ok: false, message: '来源方案不存在或已删除' }
  }

  if (targetPlanId === sourcePlanId) {
    return { ok: false, message: '请选择其他方案' }
  }

  const sourceItems = getPackingDraftItems(sourcePlanId)
  const gears = listGears()
  const gearIds = new Set(gears.map((gear) => gear.id))
  const copyableInputs = sourceItems
    .filter((item) => gearIds.has(item.gearId))
    .map((item) => ({
      gearId: item.gearId,
      quantity: item.quantity,
      target: item.target,
    }))
  const skippedGearCount = sourceItems.length - copyableInputs.length

  if (copyableInputs.length === 0 || getDraftInputsWeightG(copyableInputs) <= 0) {
    return { ok: false, message: '该方案没有可复制的打包内容' }
  }

  const result = createPlanFromPacking({
    name: targetPlan.name,
    sourcePlanId: targetPlanId,
    items: copyableInputs,
  })

  if (!result.ok) {
    return { ok: false, message: result.message }
  }

  return {
    ok: true,
    items: getPackingDraftItems(targetPlanId),
    skippedGearCount,
  }
}
