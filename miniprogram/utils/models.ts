export type GearCategory =
  | 'carry'
  | 'sleep'
  | 'clothing'
  | 'food'
  | 'safety'
  | 'electronics'
  | 'supply'
  | 'other'

export type GearStatus = 'using' | 'idle' | 'wishlist' | 'broken' | 'borrowed'

export type TripType = 'day_hike' | 'overnight' | 'multi_day' | 'camping' | 'other'

export type PlanItemSourceType = 'gear_library' | 'temporary'

export type CarryType = 'carried' | 'worn' | 'consumable' | 'shared'

export type PackedStatus = 'unpacked' | 'packed' | 'missing' | 'not_needed'

export interface BaseEntity {
  id: string
  deleted: boolean
  created_at: string
  updated_at: string
}

export interface Gear extends BaseEntity {
  name: string
  category: GearCategory
  weight_g: number
  price_cent: number
  quantity: number
  status: GearStatus
  purchase_date: string
  channel: string
  calorie_kcal: number
  remark: string
  image_url: string
}

export interface TripPlan extends BaseEntity {
  name: string
  route: string
  start_date: string
  end_date: string
  days: number
  trip_type: TripType
  weather_note: string
  target_weight_g: number
  remark: string
  is_default: boolean
}

export interface PlanItem extends BaseEntity {
  plan_id: string
  gear_id: string
  source_type: PlanItemSourceType
  name_snapshot: string
  category_snapshot: GearCategory
  weight_g_snapshot: number
  price_cent_snapshot: number
  calorie_kcal_snapshot?: number
  quantity: number
  carry_type: CarryType
  is_consumable: boolean
  packed_status: PackedStatus
  status_snapshot?: GearStatus
  remark: string
}
