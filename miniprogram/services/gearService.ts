import { gearRepository } from '../repositories/storageRepository'
import {
  GEAR_CATEGORY_NAMES,
  GEAR_STATUS_NAMES,
  normalizeGearCategory,
  normalizeGearStatus,
  resolveStatusForCategory,
} from '../utils/gearMeta'
import type { Gear, GearCategory, GearStatus } from '../utils/models'
import { centToYuan, formatWeight, kgToGrams, yuanToCent } from './unitService'

export interface GearFormInput {
  name: string
  category: GearCategory
  weightValue: string
  weightUnit: 'g' | 'kg'
  priceYuan: string
  quantity: number
  status: GearStatus
  purchase_date: string
  channel: string
  calorieKcalValue: string
  remark: string
  image_url: string
}

export interface GearQuery {
  category?: GearCategory
  keyword?: string
}

export interface GearSummary {
  gearCount: number
  totalGearWeight: string
  totalGearValue: string
  utilization: string
}

export interface GearListItem {
  id: string
  name: string
  category: GearCategory
  categoryName: string
  weight: string
  price: string
  status: GearStatus
  statusLabel: string
  daysOwned: string
  dailyCost: string
  imageUrl: string
  hasImage: boolean
}

export type GearMutationResult =
  | { ok: true; gear: Gear }
  | { ok: false; message: string }

export const MAX_GEAR_WEIGHT_G = 50000
export const MAX_GEAR_CALORIE_KCAL = 10000
export const MAX_GEAR_PRICE_CENT = 10000000
export const MAX_GEAR_NAME_LENGTH = 30
export const MAX_GEAR_CHANNEL_LENGTH = 30
export const MAX_GEAR_REMARK_LENGTH = 200
export const MIN_GEAR_QUANTITY = 1
export const MAX_GEAR_QUANTITY = 50

export const normalizeGearQuantity = (value: unknown): number => {
  let resolved = 1

  if (typeof value === 'number' && Number.isFinite(value)) {
    resolved = value
  } else if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.trim())

    if (Number.isFinite(parsed)) {
      resolved = parsed
    }
  }

  const rounded = Math.round(resolved)

  if (rounded < MIN_GEAR_QUANTITY) {
    return MIN_GEAR_QUANTITY
  }

  if (rounded > MAX_GEAR_QUANTITY) {
    return MAX_GEAR_QUANTITY
  }

  return rounded
}

export const getGearOwnedWeightG = (gear: Gear): number => {
  return gear.weight_g * normalizeGearQuantity(gear.quantity)
}

export const getGearOwnedValueCent = (gear: Gear): number => {
  return gear.price_cent * normalizeGearQuantity(gear.quantity)
}

const createId = (): string => `gear-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const now = (): string => new Date().toISOString()

const activeGears = (): Gear[] => {
  return gearRepository.list()
    .filter((gear) => !gear.deleted)
    .map((gear) => ({
      ...gear,
      quantity: normalizeGearQuantity(gear.quantity),
    }))
}

const formatPriceYuan = (priceCent: number): string => {
  if (priceCent <= 0) {
    return '--'
  }

  return `${centToYuan(priceCent).toFixed(0)}元`
}

export const parseWeightToGrams = (weightValue: string, weightUnit: 'g' | 'kg'): number | null => {
  const trimmed = weightValue.trim()

  if (!trimmed) {
    return null
  }

  const numeric = Number(trimmed)

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null
  }

  const weightG = weightUnit === 'kg' ? kgToGrams(numeric) : Math.round(numeric)

  return Math.min(weightG, MAX_GEAR_WEIGHT_G)
}

export const convertWeightDisplayValue = (
  weightValue: string,
  fromUnit: 'g' | 'kg',
  toUnit: 'g' | 'kg'
): string => {
  if (fromUnit === toUnit) {
    return weightValue
  }

  const trimmed = weightValue.trim()

  if (!trimmed) {
    return ''
  }

  const numeric = Number(trimmed)

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return weightValue
  }

  if (fromUnit === 'g' && toUnit === 'kg') {
    const kgValue = numeric / 1000

    if (Number.isInteger(kgValue)) {
      return String(kgValue)
    }

    return String(parseFloat(kgValue.toFixed(3)))
  }

  return String(kgToGrams(numeric))
}

export const parseCalorieKcal = (calorieValue: string): number | null => {
  const trimmed = calorieValue.trim()

  if (!trimmed) {
    return null
  }

  const numeric = Number(trimmed)

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null
  }

  return Math.min(Math.round(numeric), MAX_GEAR_CALORIE_KCAL)
}

export const parsePriceToCent = (priceYuan: string): number => {
  const trimmed = priceYuan.trim()

  if (!trimmed) {
    return 0
  }

  const numeric = Number(trimmed)

  if (!Number.isFinite(numeric) || numeric < 0) {
    return -1
  }

  return Math.min(yuanToCent(numeric), MAX_GEAR_PRICE_CENT)
}

export const clampWeightInputValue = (weightValue: string, weightUnit: 'g' | 'kg'): string => {
  const numeric = Number(weightValue)

  if (!Number.isFinite(numeric)) {
    return weightValue
  }

  const maxDisplay = weightUnit === 'kg'
    ? String(parseFloat((MAX_GEAR_WEIGHT_G / 1000).toFixed(3)))
    : String(MAX_GEAR_WEIGHT_G)

  return numeric > Number(maxDisplay) ? maxDisplay : weightValue
}

export const clampPriceInputValue = (priceYuan: string): string => {
  const numeric = Number(priceYuan)

  if (!Number.isFinite(numeric)) {
    return priceYuan
  }

  const maxYuan = centToYuan(MAX_GEAR_PRICE_CENT)

  return numeric > maxYuan ? String(maxYuan) : priceYuan
}

export const clampCalorieInputValue = (calorieValue: string): string => {
  const numeric = Number(calorieValue)

  if (!Number.isFinite(numeric)) {
    return calorieValue
  }

  return numeric > MAX_GEAR_CALORIE_KCAL ? String(MAX_GEAR_CALORIE_KCAL) : calorieValue
}

export const clampTextLength = (value: string, maxLength: number): string => {
  if (!value || maxLength <= 0) {
    return ''
  }

  return value.slice(0, maxLength)
}

export const calcDaysOwned = (purchaseDate: string): string => {
  if (!purchaseDate) {
    return '--'
  }

  const start = new Date(`${purchaseDate}T00:00:00`)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (Number.isNaN(start.getTime())) {
    return '--'
  }

  const diffMs = today.getTime() - start.getTime()
  const days = Math.max(1, Math.floor(diffMs / (24 * 60 * 60 * 1000)) + 1)

  return `${days}天`
}

export const calcDailyCost = (priceCent: number, purchaseDate: string): string => {
  if (priceCent <= 0 || !purchaseDate) {
    return '--'
  }

  const start = new Date(`${purchaseDate}T00:00:00`)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (Number.isNaN(start.getTime())) {
    return '--'
  }

  const diffMs = today.getTime() - start.getTime()
  const days = Math.max(1, Math.floor(diffMs / (24 * 60 * 60 * 1000)) + 1)
  const daily = centToYuan(priceCent) / days

  return `${daily.toFixed(2)}元/天`
}

const validateGearInput = (input: GearFormInput): string | null => {
  if (!input.name.trim()) {
    return '请输入装备名称'
  }

  const weight_g = parseWeightToGrams(input.weightValue, input.weightUnit)

  if (weight_g === null) {
    return '请输入有效重量'
  }

  const price_cent = parsePriceToCent(input.priceYuan)

  if (price_cent < 0) {
    return '请输入有效价格'
  }

  if (normalizeGearCategory(input.category) === 'supply') {
    const calorie_kcal = parseCalorieKcal(input.calorieKcalValue)

    if (calorie_kcal === null) {
      return '请输入有效热量'
    }
  }

  return null
}
const inputToGearPatch = (input: GearFormInput): Omit<Gear, 'id' | 'deleted' | 'created_at' | 'updated_at'> => {
  const weight_g = parseWeightToGrams(input.weightValue, input.weightUnit) || 0
  const price_cent = Math.max(0, parsePriceToCent(input.priceYuan))
  const category = normalizeGearCategory(input.category)
  const isSupply = category === 'supply'

  return {
    name: clampTextLength(input.name.trim(), MAX_GEAR_NAME_LENGTH),
    category,
    weight_g,
    price_cent,
    quantity: normalizeGearQuantity(input.quantity),
    status: resolveStatusForCategory(category, input.status),
    purchase_date: input.purchase_date,
    channel: isSupply ? '' : clampTextLength(input.channel.trim(), MAX_GEAR_CHANNEL_LENGTH),
    calorie_kcal: isSupply ? (parseCalorieKcal(input.calorieKcalValue) || 0) : 0,
    remark: clampTextLength(input.remark.trim(), MAX_GEAR_REMARK_LENGTH),
    image_url: input.image_url,
  }
}

const gearToListItem = (gear: Gear): GearListItem => {
  const category = normalizeGearCategory(gear.category)
  const status = normalizeGearStatus(gear.status)

  return {
    id: gear.id,
    name: gear.name,
    category,
    categoryName: GEAR_CATEGORY_NAMES[category],
    weight: formatWeight(getGearOwnedWeightG(gear)),
    price: formatPriceYuan(gear.price_cent),
    status,
    statusLabel: GEAR_STATUS_NAMES[status],
    daysOwned: calcDaysOwned(gear.purchase_date),
    dailyCost: calcDailyCost(gear.price_cent, gear.purchase_date),
    imageUrl: gear.image_url,
    hasImage: Boolean(gear.image_url),
  }
}

const filterGears = (gears: Gear[], query?: GearQuery): Gear[] => {
  const keyword = query && query.keyword ? query.keyword.trim().toLowerCase() : ''

  return gears.filter((gear) => {
    const category = normalizeGearCategory(gear.category)

    if (query && query.category && category !== query.category) {
      return false
    }

    if (keyword && !gear.name.toLowerCase().includes(keyword)) {
      return false
    }

    return true
  })
}

export const listGears = (query?: GearQuery): Gear[] => {
  return filterGears(activeGears(), query)
}

export const getGearById = (id: string): Gear | undefined => {
  return activeGears().find((gear) => gear.id === id)
}

export const getGearSummary = (query?: GearQuery): GearSummary => {
  const gears = listGears(query)
  const totalGearWeight = gears.reduce((sum, gear) => sum + getGearOwnedWeightG(gear), 0)
  const totalGearValue = gears.reduce((sum, gear) => sum + getGearOwnedValueCent(gear), 0)
  const usingCount = gears.filter((gear) => normalizeGearStatus(gear.status) === 'using').length
  const utilization = gears.length ? Math.round((usingCount / gears.length) * 100) : 0
  const gearCount = gears.reduce((sum, gear) => sum + normalizeGearQuantity(gear.quantity), 0)

  return {
    gearCount,
    totalGearWeight: formatWeight(totalGearWeight),
    totalGearValue: formatPriceYuan(totalGearValue),
    utilization: `${utilization}%`,
  }
}

export const getGearListItems = (query?: GearQuery): GearListItem[] => {
  return listGears(query).map(gearToListItem)
}

export const gearToFormInput = (gear: Gear): GearFormInput => {
  const useKg = gear.weight_g >= 1000 && gear.weight_g % 1000 === 0

  return {
    name: gear.name,
    category: normalizeGearCategory(gear.category),
    weightValue: useKg ? String(gear.weight_g / 1000) : String(gear.weight_g),
    weightUnit: useKg ? 'kg' : 'g',
    priceYuan: gear.price_cent > 0 ? String(centToYuan(gear.price_cent)) : '',
    quantity: normalizeGearQuantity(gear.quantity),
    status: normalizeGearStatus(gear.status),
    purchase_date: gear.purchase_date,
    channel: gear.channel || '',
    calorieKcalValue: (gear.calorie_kcal || 0) > 0 ? String(gear.calorie_kcal) : '',
    remark: gear.remark,
    image_url: gear.image_url,
  }
}

export const createGear = (input: GearFormInput): GearMutationResult => {
  const validationError = validateGearInput(input)

  if (validationError) {
    return { ok: false, message: validationError }
  }

  const timestamp = now()
  const gear: Gear = {
    id: createId(),
    deleted: false,
    created_at: timestamp,
    updated_at: timestamp,
    ...inputToGearPatch(input),
  }

  gearRepository.create(gear)

  return { ok: true, gear }
}

export const updateGear = (id: string, input: GearFormInput): GearMutationResult => {
  const validationError = validateGearInput(input)

  if (validationError) {
    return { ok: false, message: validationError }
  }

  const updated = gearRepository.update(id, inputToGearPatch(input))

  if (!updated) {
    return { ok: false, message: '装备不存在或已删除' }
  }

  return { ok: true, gear: updated }
}

export const softDeleteGear = (id: string): GearMutationResult => {
  const deleted = gearRepository.softDelete(id)

  if (!deleted) {
    return { ok: false, message: '装备不存在或已删除' }
  }

  return { ok: true, gear: deleted }
}
