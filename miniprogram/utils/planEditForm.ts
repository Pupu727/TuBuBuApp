import type { PlanFormInput } from '../services/planService'
import { resolveDayNightMaxDays } from './tripMeta'

export interface PlanEditFormView {
  name: string
  route: string
  days: number
  maxTripDays: number
  remark: string
}

export interface PlanEditFormInputLimits {
  name: boolean
  route: boolean
  remark: boolean
}

export interface PlanEditFormErrors {
  name: boolean
  days: boolean
}

export const defaultPlanEditForm = (): PlanEditFormView => ({
  name: '',
  route: '',
  days: 1,
  maxTripDays: resolveDayNightMaxDays(1),
  remark: '',
})

export const defaultPlanEditFormErrors = (): PlanEditFormErrors => ({
  name: false,
  days: false,
})

export const defaultPlanEditFormInputLimits = (): PlanEditFormInputLimits => ({
  name: false,
  route: false,
  remark: false,
})

export const isPlanTextLengthExceeded = (rawValue: string, maxLength: number): boolean => {
  return rawValue.length > maxLength
}

export const buildCreatePlanInput = (editForm: PlanEditFormView): PlanFormInput => {
  return {
    name: editForm.name.trim(),
    route: editForm.route.trim(),
    start_date: '',
    end_date: '',
    days: editForm.days > 0 ? editForm.days : 1,
    trip_type: 'overnight',
    weather_note: '',
    target_weight_g: 0,
    remark: editForm.remark.trim(),
  }
}

export const validatePlanEditForm = (editForm: PlanEditFormView): PlanEditFormErrors => {
  const name = editForm.name.trim()
  const days = editForm.days

  return {
    name: !name,
    days: !Number.isFinite(days) || days < 1,
  }
}
