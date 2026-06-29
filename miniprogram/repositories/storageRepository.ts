import { STORAGE_KEYS } from '../config/storage'
import type { BaseEntity, Gear, PlanItem, TripPlan } from '../utils/models'

type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS]
type EntityPatch<T extends BaseEntity> = Partial<Omit<T, 'id' | 'created_at'>>

const now = (): string => new Date().toISOString()

const readArray = <T>(key: StorageKey): T[] => {
  const value = wx.getStorageSync(key)
  return Array.isArray(value) ? (value as T[]) : []
}

const writeArray = <T>(key: StorageKey, items: T[]): void => {
  wx.setStorageSync(key, items)
}

const createItem = <T extends BaseEntity>(key: StorageKey, item: T): T => {
  const items = readArray<T>(key)
  writeArray(key, [...items, item])
  return item
}

const updateItem = <T extends BaseEntity>(
  key: StorageKey,
  id: string,
  patch: EntityPatch<T>,
): T | undefined => {
  let updated: T | undefined
  const items = readArray<T>(key)
  const nextItems = items.map((item) => {
    if (item.id !== id) {
      return item
    }

    updated = {
      ...item,
      ...patch,
      id: item.id,
      created_at: item.created_at,
      updated_at: now(),
    }
    return updated
  })

  if (updated) {
    writeArray(key, nextItems)
  }

  return updated
}

const softDeleteItem = <T extends BaseEntity>(key: StorageKey, id: string): T | undefined => {
  return updateItem<T>(key, id, { deleted: true } as EntityPatch<T>)
}

export const gearRepository = {
  list(): Gear[] {
    return readArray<Gear>(STORAGE_KEYS.gears)
  },
  saveAll(items: Gear[]): void {
    writeArray(STORAGE_KEYS.gears, items)
  },
  create(item: Gear): Gear {
    return createItem(STORAGE_KEYS.gears, item)
  },
  update(id: string, patch: EntityPatch<Gear>): Gear | undefined {
    return updateItem(STORAGE_KEYS.gears, id, patch)
  },
  softDelete(id: string): Gear | undefined {
    return softDeleteItem<Gear>(STORAGE_KEYS.gears, id)
  },
}

export const tripPlanRepository = {
  list(): TripPlan[] {
    return readArray<TripPlan>(STORAGE_KEYS.tripPlans)
  },
  saveAll(items: TripPlan[]): void {
    writeArray(STORAGE_KEYS.tripPlans, items)
  },
  create(item: TripPlan): TripPlan {
    return createItem(STORAGE_KEYS.tripPlans, item)
  },
  update(id: string, patch: EntityPatch<TripPlan>): TripPlan | undefined {
    return updateItem(STORAGE_KEYS.tripPlans, id, patch)
  },
  softDelete(id: string): TripPlan | undefined {
    return softDeleteItem<TripPlan>(STORAGE_KEYS.tripPlans, id)
  },
}

export const planItemRepository = {
  list(): PlanItem[] {
    return readArray<PlanItem>(STORAGE_KEYS.planItems)
  },
  saveAll(items: PlanItem[]): void {
    writeArray(STORAGE_KEYS.planItems, items)
  },
  create(item: PlanItem): PlanItem {
    return createItem(STORAGE_KEYS.planItems, item)
  },
  update(id: string, patch: EntityPatch<PlanItem>): PlanItem | undefined {
    return updateItem(STORAGE_KEYS.planItems, id, patch)
  },
  softDelete(id: string): PlanItem | undefined {
    return softDeleteItem<PlanItem>(STORAGE_KEYS.planItems, id)
  },
}
