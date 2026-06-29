export type GearCategoryId =
  | 'carry'
  | 'sleep'
  | 'clothing'
  | 'food'
  | 'safety'
  | 'electronics'
  | 'supply'
  | 'other'

export interface GearCategory {
  id: GearCategoryId
  name: string
  color: string
  icon: string
}

export interface GearItem {
  id: string
  name: string
  categoryId: GearCategoryId
  categoryName: string
  weightKg: number
  price: number
  daysOwned: number
  status: 'using' | 'idle'
  imageUrl: string
  note: string
}

export interface GearStats {
  count: number
  totalWeightKg: string
  totalValue: number
  utilization: number
  activeCount: number
}

export interface CategoryWeightShare {
  id: GearCategoryId
  name: string
  color: string
  weightKg: string
  percent: string
}

export interface ParsedEquipment {
  name: string
  categoryId: GearCategoryId
  categoryName: string
  weightKg: string
  price: string
  note: string
}

export const gearCategories: GearCategory[] = [
  { id: 'carry', name: '背负系统', color: '#6f5edb', icon: 'bag' },
  { id: 'sleep', name: '睡眠系统', color: '#2d9cdb', icon: 'moon' },
  { id: 'clothing', name: '服饰系统', color: '#27ae60', icon: 'coat' },
  { id: 'food', name: '饮食系统', color: '#f2994a', icon: 'cook' },
  { id: 'safety', name: '安全装备', color: '#d946ef', icon: 'aid' },
  { id: 'electronics', name: '电子设备', color: '#56ccf2', icon: 'power' },
  { id: 'supply', name: '食物补给', color: '#f2c94c', icon: 'food' },
  { id: 'other', name: '其他', color: '#828282', icon: 'more' },
]

export const mockGearItems: GearItem[] = [
  {
    id: 'gear-1',
    name: '艾王 35+5L',
    categoryId: 'carry',
    categoryName: '背负系统',
    weightKg: 1.1,
    price: 125,
    daysOwned: 3,
    status: 'using',
    imageUrl: '',
    note: '默认方案主背包',
  },
  {
    id: 'gear-2',
    name: '三季信封睡袋',
    categoryId: 'sleep',
    categoryName: '睡眠系统',
    weightKg: 0.82,
    price: 268,
    daysOwned: 48,
    status: 'idle',
    imageUrl: '',
    note: '后续可替换为真实装备图片',
  },
  {
    id: 'gear-3',
    name: '轻量钛锅 750ml',
    categoryId: 'food',
    categoryName: '饮食系统',
    weightKg: 0.13,
    price: 89,
    daysOwned: 21,
    status: 'using',
    imageUrl: '',
    note: '饮食系统示例',
  },
]

const categoryKeywords: Record<GearCategoryId, string[]> = {
  carry: ['背包', '腰包', '防水袋', '收纳', '驮包', 'gregory', 'osprey', 'baltoro'],
  sleep: ['帐篷', '睡袋', '防潮垫', '枕头', '天幕', '地布'],
  clothing: ['冲锋衣', '保暖', '速干', '袜', '抓绒', '雨衣', '手套'],
  food: ['炉头', '锅', '气罐', '餐具', '挡风板', '打火机', '水袋', '水壶', '滤水'],
  safety: ['头灯', 'gps', '指南针', '地图', '手电', '急救', '药', '求生毯', '绷带', '创可贴'],
  electronics: ['充电宝', '相机', '线材', '电池', '手机'],
  supply: ['食物', '能量胶', '干粮', '补给', '餐包'],
  other: [],
}

export const getCategoryById = (id: GearCategoryId) => {
  return gearCategories.find((category) => category.id === id) || gearCategories[gearCategories.length - 1]
}

export const summarizeGear = (items: GearItem[]): GearStats => {
  const totalWeight = items.reduce((sum, item) => sum + item.weightKg, 0)
  const totalValue = items.reduce((sum, item) => sum + item.price, 0)
  const activeCount = items.filter((item) => item.status === 'using').length
  const utilization = items.length ? Math.round((activeCount / items.length) * 100) : 0

  return {
    count: items.length,
    totalWeightKg: totalWeight.toFixed(1),
    totalValue,
    utilization,
    activeCount,
  }
}

export const getCategoryWeightShares = (items: GearItem[]): CategoryWeightShare[] => {
  const totalWeight = items.reduce((sum, item) => sum + item.weightKg, 0)

  return gearCategories
    .map((category) => {
      const weight = items
        .filter((item) => item.categoryId === category.id)
        .reduce((sum, item) => sum + item.weightKg, 0)
      const percent = totalWeight ? (weight / totalWeight) * 100 : 0

      return {
        id: category.id,
        name: category.name,
        color: category.color,
        weightKg: weight.toFixed(1),
        percent: percent.toFixed(1),
      }
    })
    .filter((share) => Number(share.weightKg) > 0)
}

export const parseEquipmentInput = (input: string): ParsedEquipment => {
  const normalized = input.trim()
  const lowerInput = normalized.toLowerCase()
  const matchedCategory =
    gearCategories.find((category) => {
      const keywords = categoryKeywords[category.id]
      return keywords.some((keyword) => lowerInput.includes(keyword.toLowerCase()))
    }) || getCategoryById('other')
  const weightMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(kg|KG|千克|公斤|g|G|克)/)
  const priceMatch =
    normalized.match(/[¥￥]\s*(\d+(?:\.\d+)?)/) ||
    normalized.match(/(\d+(?:\.\d+)?)\s*(元|块|rmb|RMB)/)
  let weightKg = ''

  if (weightMatch) {
    const value = Number(weightMatch[1])
    const unit = weightMatch[2].toLowerCase()
    weightKg = unit === 'g' || unit === '克' ? (value / 1000).toFixed(2) : value.toString()
  }

  const name = normalized
    .replace(/(\d+(?:\.\d+)?)\s*(kg|KG|千克|公斤|g|G|克)/g, '')
    .replace(/[¥￥]\s*(\d+(?:\.\d+)?)/g, '')
    .replace(/(\d+(?:\.\d+)?)\s*(元|块|rmb|RMB)/g, '')
    .replace(new RegExp(matchedCategory.name, 'g'), '')
    .trim()

  return {
    name: name || normalized || '未命名装备',
    categoryId: matchedCategory.id,
    categoryName: matchedCategory.name,
    weightKg,
    price: priceMatch ? priceMatch[1] : '',
    note: normalized ? '本地规则解析，后续可继续校准参数。' : '',
  }
}
