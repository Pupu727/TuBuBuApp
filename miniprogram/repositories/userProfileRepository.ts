import { STORAGE_KEYS } from '../config/storage'

export interface UserBodyProfile {
  heightCm: string
  weightKg: string
}

const defaultProfile = (): UserBodyProfile => ({
  heightCm: '',
  weightKg: '',
})

const readProfile = (): UserBodyProfile => {
  const value = wx.getStorageSync(STORAGE_KEYS.userBodyProfile)

  if (!value || typeof value !== 'object') {
    return defaultProfile()
  }

  const record = value as Record<string, unknown>

  return {
    heightCm: typeof record.heightCm === 'string' ? record.heightCm : '',
    weightKg: typeof record.weightKg === 'string' ? record.weightKg : '',
  }
}

export const getUserBodyProfile = (): UserBodyProfile => {
  return readProfile()
}

export const saveUserBodyProfile = (input: UserBodyProfile): UserBodyProfile => {
  const profile: UserBodyProfile = {
    heightCm: input.heightCm.trim(),
    weightKg: input.weightKg.trim(),
  }

  wx.setStorageSync(STORAGE_KEYS.userBodyProfile, profile)

  return profile
}

export const getHomeActivePlanId = (): string => {
  const value = wx.getStorageSync(STORAGE_KEYS.homeActivePlanId)
  return typeof value === 'string' ? value : ''
}

export const setHomeActivePlanId = (planId: string): void => {
  wx.setStorageSync(STORAGE_KEYS.homeActivePlanId, planId)
}
