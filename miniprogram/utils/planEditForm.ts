import type { PlanFormInput } from '../services/planService'
import { getTodayDateString, computePlanEndDate, isPlanDateOnOrAfterToday } from './planDate'
import { resolveDayNightMaxDays } from './tripMeta'

export interface PlanEditFormView {
  name: string
  route: string
  startDate: string
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
  startDate: boolean
  days: boolean
}

export const defaultPlanEditForm = (): PlanEditFormView => ({
  name: '',
  route: '',
  startDate: getTodayDateString(),
  days: 1,
  maxTripDays: resolveDayNightMaxDays(1),
  remark: '',
})

export const defaultPlanEditFormErrors = (): PlanEditFormErrors => ({
  name: false,
  startDate: false,
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
  const startDate = editForm.startDate.trim()
  const days = editForm.days > 0 ? editForm.days : 1

  return {
    name: editForm.name.trim(),
    route: editForm.route.trim(),
    start_date: startDate,
    end_date: computePlanEndDate(startDate, days),
    days,
    trip_type: 'overnight',
    weather_note: '',
    target_weight_g: 0,
    remark: editForm.remark.trim(),
  }
}

export const validatePlanEditForm = (editForm: PlanEditFormView): PlanEditFormErrors => {
  const name = editForm.name.trim()
  const startDate = editForm.startDate.trim()
  const days = editForm.days

  return {
    name: !name,
    startDate: !startDate || !isPlanDateOnOrAfterToday(startDate),
    days: !Number.isFinite(days) || days < 1,
  }
}
