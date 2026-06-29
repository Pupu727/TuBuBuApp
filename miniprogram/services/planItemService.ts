import type { CarryType, Gear, PackedStatus, PlanItem } from '../utils/models'
import { normalizeGearStatus } from '../utils/gearMeta'
import { normalizeGearQuantity } from './gearService'

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
