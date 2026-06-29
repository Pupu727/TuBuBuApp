import type { GearFormInput } from '../services/gearService'
import { parseCalorieKcal, parseWeightToGrams } from '../services/gearService'
import { GEAR_CATEGORY_OPTIONS, GEAR_STATUS_NAMES, resolveStatusForCategory } from './gearMeta'

export interface GearFormViewModel extends GearFormInput {
  categoryLabel: string
  statusLabel: string
}

export interface GearFormErrors {
  name: boolean
  weight: boolean
  calorie: boolean
}

export interface GearFormInputLimits {
  name: boolean
  channel: boolean
  remark: boolean
  weight: boolean
  price: boolean
  calorie: boolean
  quantity: boolean
}

export const defaultGearFormErrors = (): GearFormErrors => ({
  name: false,
  weight: false,
  calorie: false,
})

export const defaultGearFormInputLimits = (): GearFormInputLimits => ({
  name: false,
  channel: false,
  remark: false,
  weight: false,
  price: false,
  calorie: false,
  quantity: false,
})

export const isTextLengthExceeded = (rawValue: string, maxLength: number): boolean => {
  return rawValue.length > maxLength
}

export const isNumericInputExceeded = (rawValue: string, clampedValue: string): boolean => {
  const raw = rawValue.trim()

  if (!raw) {
    return false
  }

  const rawNum = Number(raw)
  const clampedNum = Number(clampedValue)

  if (!Number.isFinite(rawNum) || !Number.isFinite(clampedNum)) {
    return false
  }

  return rawNum > clampedNum
}

export const isQuantityLimitExceeded = (rawValue: string, min: number, max: number): boolean => {
  const raw = rawValue.trim()

  if (!raw) {
    return false
  }

  const parsed = parseInt(raw, 10)

  if (!Number.isFinite(parsed)) {
    return false
  }

  return parsed > max || parsed < min
}

export const defaultGearFormView = (): GearFormViewModel => ({
  name: '',
  category: 'carry',
  weightValue: '',
  weightUnit: 'g',
  priceYuan: '',
  quantity: 1,
  status: 'using',
  purchase_date: '',
  channel: '',
  calorieKcalValue: '',
  remark: '',
  image_url: '',
  categoryLabel: GEAR_CATEGORY_OPTIONS[0].name,
  statusLabel: GEAR_STATUS_NAMES.using,
})

export const gearFormInputFromView = (form: GearFormViewModel): GearFormInput => ({
  name: form.name,
  category: form.category,
  weightValue: form.weightValue,
  weightUnit: form.weightUnit,
  priceYuan: form.priceYuan,
  quantity: form.quantity,
  status: resolveStatusForCategory(form.category, form.status),
  purchase_date: form.purchase_date,
  channel: form.channel,
  calorieKcalValue: form.calorieKcalValue,
  remark: form.remark,
  image_url: form.image_url,
})

export const validateGearFormView = (form: GearFormViewModel): GearFormErrors => {
  const weight_g = parseWeightToGrams(form.weightValue, form.weightUnit)
  const calorie_kcal = parseCalorieKcal(form.calorieKcalValue)

  return {
    name: !form.name.trim(),
    weight: weight_g === null,
    calorie: form.category === 'supply' && calorie_kcal === null,
  }
}
