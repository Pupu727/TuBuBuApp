import { planItemRepository } from '../repositories/storageRepository'
import { normalizeGearCategory, normalizeGearStatus } from '../utils/gearMeta'
import type { CarryType, Gear, GearCategory, PackedStatus, PlanItem } from '../utils/models'
import { clampTextLength, MAX_GEAR_NAME_LENGTH, normalizeGearQuantity } from './gearService'

export interface CreatePlanItemFromGearInput {
  planId: string
  gear: Gear
  quantity?: number
  carryType?: CarryType
  isConsumable?: boolean
  packedStatus?: PackedStatus
  calorieKcal?: number
  remark?: string
}

export interface CreateTemporaryPlanItemInput {
  planId: string
  name: string
  category: GearCategory
  weight_g: number
  price_cent: number
  quantity?: number
  carryType?: CarryType
  isConsumable?: boolean
  packedStatus?: PackedStatus
  remark?: string
}

const createId = (): string => `plan-item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

export const createPlanItemFromGear = (input: CreatePlanItemFromGearInput): PlanItem => {
  const timestamp = new Date().toISOString()
  const quantity = input.quantity === undefined
    ? normalizeGearQuantity(input.gear.quantity)
    : input.quantity
  const carryType = input.carryType === undefined ? 'carried' : input.carryType
  const isConsumable = input.isConsumable === undefined ? false : input.isConsumable
  const packedStatus = input.packedStatus === undefined ? 'unpacked' : input.packedStatus
  const calorieKcal = input.calorieKcal === undefined ? 0 : input.calorieKcal
  const remark = input.remark === undefined ? '' : input.remark

  return {
    id: createId(),
    plan_id: input.planId,
    gear_id: input.gear.id,
    source_type: 'gear_library',
    name_snapshot: input.gear.name,
    category_snapshot: input.gear.category,
    weight_g_snapshot: input.gear.weight_g,
    price_cent_snapshot: input.gear.price_cent,
    calorie_kcal_snapshot: calorieKcal,
    quantity,
    carry_type: carryType,
    is_consumable: isConsumable,
    packed_status: packedStatus,
    status_snapshot: normalizeGearStatus(input.gear.status),
    remark,
    deleted: false,
    created_at: timestamp,
    updated_at: timestamp,
  }
}

export const createTemporaryPlanItem = (input: CreateTemporaryPlanItemInput): PlanItem => {
  const timestamp = new Date().toISOString()
  const quantity = input.quantity === undefined ? 1 : normalizeGearQuantity(input.quantity)
  const carryType = input.carryType === undefined
    ? (input.isConsumable ? 'consumable' : 'carried')
    : input.carryType
  const isConsumable = input.isConsumable === undefined ? false : input.isConsumable
  const packedStatus = input.packedStatus === undefined ? 'unpacked' : input.packedStatus
  const remark = input.remark === undefined ? '' : input.remark
  const category = normalizeGearCategory(input.category)

  return {
    id: createId(),
    plan_id: input.planId,
    gear_id: '',
    source_type: 'temporary',
    name_snapshot: clampTextLength(input.name.trim(), MAX_GEAR_NAME_LENGTH),
    category_snapshot: category,
    weight_g_snapshot: input.weight_g,
    price_cent_snapshot: Math.max(0, input.price_cent),
    calorie_kcal_snapshot: 0,
    quantity,
    carry_type: carryType,
    is_consumable: isConsumable,
    packed_status: packedStatus,
    status_snapshot: 'using',
    remark,
    deleted: false,
    created_at: timestamp,
    updated_at: timestamp,
  }
}

export const savePlanItems = (items: PlanItem[]): void => {
  if (!items.length) {
    return
  }

  planItemRepository.saveAll([...planItemRepository.list(), ...items])
}
