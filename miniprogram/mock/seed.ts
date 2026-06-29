import { createPlanItemFromGear } from '../services/planItemService'
import type { Gear, TripPlan } from '../utils/models'

const timestamp = '2026-06-28T00:00:00.000Z'

export const seedGears: Gear[] = [
  {
    id: 'seed-gear-pack',
    name: 'Gregory Baltoro 65L',
    category: 'carry',
    weight_g: 2100,
    price_cent: 230000,
    status: 'using',
    purchase_date: '',
    channel: 'offline',
    calorie_kcal: 0,
    remark: 'Main pack for overnight trips',
    image_url: '',
    quantity: 1,
    deleted: false,
    created_at: timestamp,
    updated_at: timestamp,
  },
  {
    id: 'seed-gear-quilt',
    name: 'Three-season quilt',
    category: 'sleep',
    weight_g: 780,
    price_cent: 128000,
    status: 'using',
    purchase_date: '',
    channel: 'online',
    calorie_kcal: 0,
    remark: 'Sleep system demo item',
    image_url: '',
    quantity: 1,
    deleted: false,
    created_at: timestamp,
    updated_at: timestamp,
  },
  {
    id: 'seed-gear-pot',
    name: 'Titanium pot 750ml',
    category: 'food',
    weight_g: 130,
    price_cent: 8900,
    status: 'idle',
    purchase_date: '',
    channel: 'online',
    calorie_kcal: 450,
    remark: 'Food and cooking system demo item',
    image_url: '',
    quantity: 1,
    deleted: false,
    created_at: timestamp,
    updated_at: timestamp,
  },
]

export const seedTripPlans: TripPlan[] = [
  {
    id: 'seed-plan-default',
    name: '默认方案',
    route: 'Local mountain loop',
    start_date: '',
    end_date: '',
    days: 2,
    trip_type: 'overnight',
    weather_note: 'Mild weather demo plan',
    target_weight_g: 8000,
    remark: 'Default seed plan',
    is_default: true,
    deleted: false,
    created_at: timestamp,
    updated_at: timestamp,
  },
]

export const seedPlanItems = seedGears.slice(0, 2).map((gear) =>
  createPlanItemFromGear({
    planId: seedTripPlans[0].id,
    gear,
  }),
)
