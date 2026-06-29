import type { GearCategory, GearStatus } from './models'

export const GEAR_CATEGORY_ORDER: GearCategory[] = [
  'carry',
  'sleep',
  'clothing',
  'food',
  'safety',
  'electronics',
  'supply',
  'other',
]

export const GEAR_CATEGORY_NAMES: Record<GearCategory, string> = {
  carry: '背负系统',
  sleep: '睡眠系统',
  clothing: '服饰系统',
  food: '饮食系统',
  safety: '安全装备',
  electronics: '电子设备',
  supply: '食物补给',
  other: '其他',
}

export const GEAR_CATEGORY_COLORS: Record<GearCategory, string> = {
  carry: '#8067d8',
  sleep: '#4c9be8',
  clothing: '#34b979',
  food: '#ff9f30',
  safety: '#d94d90',
  electronics: '#5d6de8',
  supply: '#f3b23b',
  other: '#9aa0a6',
}

export const GEAR_STATUS_NAMES: Record<GearStatus, string> = {
  using: '使用中',
  idle: '备用',
  wishlist: '心愿单',
  broken: '损坏',
  borrowed: '借出',
}

export const GEAR_STATUS_ORDER: GearStatus[] = ['using', 'idle', 'wishlist', 'broken', 'borrowed']

export const GEAR_CATEGORY_OPTIONS = GEAR_CATEGORY_ORDER.map((id) => ({
  id,
  name: GEAR_CATEGORY_NAMES[id],
}))

export const GEAR_STATUS_OPTIONS = GEAR_STATUS_ORDER.map((id) => ({
  id,
  name: GEAR_STATUS_NAMES[id],
}))

const SUPPLY_STATUS_ORDER: GearStatus[] = ['idle', 'wishlist']

export const isSupplyCategory = (category: GearCategory | string): boolean => {
  return normalizeGearCategory(category) === 'supply'
}

export const getStatusOptionsForCategory = (category: GearCategory | string) => {
  if (isSupplyCategory(category)) {
    return SUPPLY_STATUS_ORDER.map((id) => ({
      id,
      name: GEAR_STATUS_NAMES[id],
    }))
  }

  return GEAR_STATUS_OPTIONS
}

export const resolveStatusForCategory = (category: GearCategory | string, status: GearStatus): GearStatus => {
  const options = getStatusOptionsForCategory(category)
  const matched = options.find((item) => item.id === status)

  if (matched) {
    return matched.id
  }

  return options[0].id
}

export const normalizeGearCategory = (category: string): GearCategory => {
  if (category === 'carry') return 'carry'
  if (category === 'sleep') return 'sleep'
  if (category === 'clothing') return 'clothing'
  if (category === 'food' || category === 'cook') return 'food'
  if (category === 'safety' || category === 'navigation' || category === 'medical') return 'safety'
  if (category === 'electronics') return 'electronics'
  if (category === 'supply') return 'supply'

  return 'other'
}

export const normalizeGearStatus = (status: string): GearStatus => {
  if (status === 'using') return 'using'
  if (status === 'idle') return 'idle'
  if (status === 'wishlist') return 'wishlist'
  if (status === 'broken') return 'broken'
  if (status === 'borrowed') return 'borrowed'
  if (status === 'retired') return 'idle'

  return 'idle'
}
