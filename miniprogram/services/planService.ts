import { planItemRepository, tripPlanRepository } from '../repositories/storageRepository'
import type { PlanItem, TripPlan, TripType } from '../utils/models'

export interface PlanFormInput {
  name: string
  route: string
  start_date: string
  end_date: string
  days: number
  trip_type: TripType
  weather_note: string
  target_weight_g: number
  remark: string
}

export type PlanMutationResult =
  | { ok: true; plan: TripPlan }
  | { ok: false; message: string }

export const MAX_PLAN_NAME_LENGTH = 30
export const MAX_PLAN_ROUTE_LENGTH = 30
export const MAX_PLAN_REMARK_LENGTH = 200

const createId = (): string => `plan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const createPlanItemId = (): string => `plan-item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const now = (): string => new Date().toISOString()

const activePlans = (): TripPlan[] => tripPlanRepository.list().filter((plan) => !plan.deleted)

const activePlanItems = (): PlanItem[] => planItemRepository.list().filter((item) => !item.deleted)

export const clampTextLength = (value: string, maxLength: number): string => {
  if (!value || maxLength <= 0) {
    return ''
  }

  return value.slice(0, maxLength)
}

const validatePlanInput = (input: PlanFormInput): string | null => {
  if (!input.name.trim()) {
    return '请输入方案名称'
  }

  if (!Number.isFinite(input.days) || input.days < 1) {
    return '请输入有效出行天数'
  }

  if (!Number.isFinite(input.target_weight_g) || input.target_weight_g < 0) {
    return '请输入有效目标重量'
  }

  return null
}

const inputToPlanPatch = (input: PlanFormInput): Omit<TripPlan, 'id' | 'deleted' | 'created_at' | 'updated_at' | 'is_default'> => {
  return {
    name: clampTextLength(input.name.trim(), MAX_PLAN_NAME_LENGTH),
    route: clampTextLength(input.route.trim(), MAX_PLAN_ROUTE_LENGTH),
    start_date: input.start_date,
    end_date: input.end_date,
    days: Math.round(input.days),
    trip_type: input.trip_type,
    weather_note: input.weather_note.trim(),
    target_weight_g: Math.round(input.target_weight_g),
    remark: clampTextLength(input.remark.trim(), MAX_PLAN_REMARK_LENGTH),
  }
}

const getActivePlanById = (id: string): TripPlan | undefined => {
  return activePlans().find((plan) => plan.id === id)
}

const saveDefaultState = (planId: string): TripPlan | undefined => {
  const timestamp = now()
  let selectedPlan: TripPlan | undefined
  const plans = tripPlanRepository.list().map((plan) => {
    if (plan.deleted) {
      return plan
    }

    const isDefault = plan.id === planId
    const nextPlan = {
      ...plan,
      is_default: isDefault,
      updated_at: isDefault || plan.is_default ? timestamp : plan.updated_at,
    }

    if (isDefault) {
      selectedPlan = nextPlan
    }

    return nextPlan
  })

  if (selectedPlan) {
    tripPlanRepository.saveAll(plans)
  }

  return selectedPlan
}

const copyPlanItem = (item: PlanItem, planId: string): PlanItem => {
  const timestamp = now()

  return {
    ...item,
    id: createPlanItemId(),
    plan_id: planId,
    packed_status: 'unpacked',
    deleted: false,
    created_at: timestamp,
    updated_at: timestamp,
  }
}

export const listPlans = (): TripPlan[] => {
  return activePlans()
}

export const getPlanById = (id: string): TripPlan | undefined => {
  return getActivePlanById(id)
}

export const planToFormInput = (plan: TripPlan): PlanFormInput => {
  return {
    name: plan.name,
    route: plan.route,
    start_date: plan.start_date,
    end_date: plan.end_date,
    days: plan.days,
    trip_type: plan.trip_type,
    weather_note: plan.weather_note,
    target_weight_g: plan.target_weight_g,
    remark: plan.remark,
  }
}

export const createPlan = (input: PlanFormInput): PlanMutationResult => {
  const validationError = validatePlanInput(input)

  if (validationError) {
    return { ok: false, message: validationError }
  }

  const timestamp = now()
  const hasDefaultPlan = activePlans().some((plan) => plan.is_default)
  const plan: TripPlan = {
    id: createId(),
    deleted: false,
    created_at: timestamp,
    updated_at: timestamp,
    is_default: !hasDefaultPlan,
    ...inputToPlanPatch(input),
  }

  tripPlanRepository.create(plan)

  return { ok: true, plan }
}

export const updatePlan = (id: string, input: PlanFormInput): PlanMutationResult => {
  const validationError = validatePlanInput(input)

  if (validationError) {
    return { ok: false, message: validationError }
  }

  if (!getActivePlanById(id)) {
    return { ok: false, message: '方案不存在或已删除' }
  }

  const updated = tripPlanRepository.update(id, inputToPlanPatch(input))

  if (!updated) {
    return { ok: false, message: '方案不存在或已删除' }
  }

  return { ok: true, plan: updated }
}

export const setDefaultPlan = (id: string): PlanMutationResult => {
  if (!getActivePlanById(id)) {
    return { ok: false, message: '方案不存在或已删除' }
  }

  const plan = saveDefaultState(id)

  if (!plan) {
    return { ok: false, message: '方案不存在或已删除' }
  }

  return { ok: true, plan }
}

export const copyPlan = (id: string): PlanMutationResult => {
  const sourcePlan = getActivePlanById(id)

  if (!sourcePlan) {
    return { ok: false, message: '方案不存在或已删除' }
  }

  const timestamp = now()
  const copiedPlan: TripPlan = {
    ...sourcePlan,
    id: createId(),
    name: `${sourcePlan.name} 副本`,
    is_default: false,
    deleted: false,
    created_at: timestamp,
    updated_at: timestamp,
  }
  const copiedItems = activePlanItems()
    .filter((item) => item.plan_id === sourcePlan.id)
    .map((item) => copyPlanItem(item, copiedPlan.id))

  tripPlanRepository.create(copiedPlan)
  planItemRepository.saveAll([...planItemRepository.list(), ...copiedItems])

  return { ok: true, plan: copiedPlan }
}

export const softDeletePlan = (id: string): PlanMutationResult => {
  const sourcePlan = getActivePlanById(id)

  if (!sourcePlan) {
    return { ok: false, message: '方案不存在或已删除' }
  }

  const deletedPlan = tripPlanRepository.softDelete(id)

  if (!deletedPlan) {
    return { ok: false, message: '方案不存在或已删除' }
  }

  const timestamp = now()
  const nextPlanItems = planItemRepository.list().map((item) => {
    if (item.plan_id !== id || item.deleted) {
      return item
    }

    return {
      ...item,
      deleted: true,
      updated_at: timestamp,
    }
  })

  planItemRepository.saveAll(nextPlanItems)

  if (sourcePlan.is_default) {
    const nextDefaultPlan = activePlans().find((plan) => plan.id !== id)

    if (nextDefaultPlan) {
      saveDefaultState(nextDefaultPlan.id)
    }
  }

  return { ok: true, plan: deletedPlan }
}
