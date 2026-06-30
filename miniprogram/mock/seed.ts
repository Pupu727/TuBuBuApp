import { createPlanItemFromGear } from '../services/planItemService'
import type { Gear, TripPlan } from '../utils/models'
import { computePlanEndDate, getTodayDateString } from '../utils/planDate'

const timestamp = '2026-06-28T00:00:00.000Z'

const subtractDays = (dateString: string, days: number): string => {
  const parts = dateString.split('-')
  const year = Number(parts[0])
  const month = Number(parts[1])
  const day = Number(parts[2])

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return dateString
  }

  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() - Math.round(days))

  const nextMonth = `${date.getMonth() + 1}`.padStart(2, '0')
  const nextDay = `${date.getDate()}`.padStart(2, '0')
  return `${date.getFullYear()}-${nextMonth}-${nextDay}`
}

const addDays = (dateString: string, days: number): string => {
  const parts = dateString.split('-')
  const year = Number(parts[0])
  const month = Number(parts[1])
  const day = Number(parts[2])

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return dateString
  }

  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() + Math.round(days))

  const nextMonth = `${date.getMonth() + 1}`.padStart(2, '0')
  const nextDay = `${date.getDate()}`.padStart(2, '0')
  return `${date.getFullYear()}-${nextMonth}-${nextDay}`
}

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
  {
    id: 'seed-gear-tarp',
    name: 'Ultralight tarp',
    category: 'sleep',
    weight_g: 420,
    price_cent: 68000,
    status: 'using',
    purchase_date: '',
    channel: 'online',
    calorie_kcal: 0,
    remark: 'Shelter demo item',
    image_url: '',
    quantity: 1,
    deleted: false,
    created_at: timestamp,
    updated_at: timestamp,
  },
  {
    id: 'seed-gear-jacket',
    name: 'Rain jacket',
    category: 'clothing',
    weight_g: 310,
    price_cent: 49900,
    status: 'using',
    purchase_date: '',
    channel: 'online',
    calorie_kcal: 0,
    remark: 'Clothing demo item',
    image_url: '',
    quantity: 1,
    deleted: false,
    created_at: timestamp,
    updated_at: timestamp,
  },
]

const seedPlanStartDate = getTodayDateString()
const yesterday = subtractDays(seedPlanStartDate, 1)
const lastWeek = subtractDays(seedPlanStartDate, 7)
const nextWeek = addDays(seedPlanStartDate, 7)
const nextMonth = addDays(seedPlanStartDate, 30)

export const seedTripPlans: TripPlan[] = [
  {
    id: 'seed-plan-default',
    name: '周末轻装',
    route: 'Local mountain loop',
    start_date: seedPlanStartDate,
    end_date: computePlanEndDate(seedPlanStartDate, 2),
    days: 2,
    trip_type: 'overnight',
    weather_note: 'Mild weather demo plan',
    target_weight_g: 8000,
    remark: 'Default seed plan',
    is_default: false,
    deleted: false,
    created_at: timestamp,
    updated_at: timestamp,
  },
  {
    id: 'seed-plan-upcoming-next-week',
    name: '重装反穿',
    route: '反穿武功山',
    start_date: nextWeek,
    end_date: computePlanEndDate(nextWeek, 4),
    days: 4,
    trip_type: 'multi_day',
    weather_note: 'Windy and rainy',
    target_weight_g: 11000,
    remark: '带上雨衣，别忘了头灯',
    is_default: false,
    deleted: false,
    created_at: timestamp,
    updated_at: timestamp,
  },
  {
    id: 'seed-plan-upcoming-next-month',
    name: '长线穿越',
    route: '五台山逆朝台',
    start_date: nextMonth,
    end_date: computePlanEndDate(nextMonth, 5),
    days: 5,
    trip_type: 'multi_day',
    weather_note: 'Hot day, cold night',
    target_weight_g: 12000,
    remark: '',
    is_default: false,
    deleted: false,
    created_at: timestamp,
    updated_at: timestamp,
  },
  {
    id: 'seed-plan-unscheduled',
    name: '待定草案',
    route: '附近随走',
    start_date: '',
    end_date: '',
    days: 1,
    trip_type: 'day_hike',
    weather_note: '',
    target_weight_g: 0,
    remark: '还没定日期，先把装备想好',
    is_default: false,
    deleted: false,
    created_at: timestamp,
    updated_at: timestamp,
  },
  {
    id: 'seed-plan-completed-yesterday',
    name: '周末小环线（已出行）',
    route: '香山—鬼笑石',
    start_date: yesterday,
    end_date: computePlanEndDate(yesterday, 1),
    days: 1,
    trip_type: 'day_hike',
    weather_note: 'Sunny',
    target_weight_g: 6000,
    remark: '回来看脚底磨得厉害',
    is_default: false,
    deleted: false,
    created_at: timestamp,
    updated_at: timestamp,
  },
  {
    id: 'seed-plan-completed-last-week',
    name: '露营测试（已出行）',
    route: '郊外营地',
    start_date: lastWeek,
    end_date: computePlanEndDate(lastWeek, 2),
    days: 2,
    trip_type: 'camping',
    weather_note: 'Cold at night',
    target_weight_g: 9000,
    remark: '',
    is_default: false,
    deleted: false,
    created_at: timestamp,
    updated_at: timestamp,
  },
]

export const seedPlanItems = [
  ...seedGears.slice(0, 2).map((gear) =>
    createPlanItemFromGear({
      planId: seedTripPlans[0].id,
      gear,
    }),
  ),
  ...seedGears.slice(0, 4).map((gear) =>
    createPlanItemFromGear({
      planId: 'seed-plan-upcoming-next-week',
      gear,
    }),
  ),
  ...seedGears.slice(0, 3).map((gear) =>
    createPlanItemFromGear({
      planId: 'seed-plan-completed-yesterday',
      gear,
    }),
  ),
]
