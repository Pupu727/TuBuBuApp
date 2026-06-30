import {
  GEAR_CATEGORY_NAMES,
  normalizeGearCategory,
  resolveStatusForCategory,
} from '../utils/gearMeta'
import type { GearCategory } from '../utils/models'
import {
  clampTextLength,
  createGear,
  findGearByExactName,
  incrementGearQuantity,
  MAX_GEAR_NAME_LENGTH,
  normalizeGearQuantity,
  type GearFormInput,
} from './gearService'
import { createTemporaryPlanItem, savePlanItems } from './planItemService'
import { getPlanById, resolveActivePlanId } from './planService'
import { centToYuan, formatWeight, kgToGrams, yuanToCent } from './unitService'

export type SmartParseSaveTarget = 'gear_library' | 'default_plan'

export interface SmartParseItem {
  lineIndex: number
  rawLine: string
  ok: boolean
  errorMessage: string
  name: string
  category: GearCategory
  categoryLabel: string
  weight_g: number | null
  weightLabel: string
  price_cent: number
  priceLabel: string
  quantity: number
  included: boolean
  rowClass: string
}

export interface SmartParseSaveResult {
  ok: boolean
  message: string
  savedCount: number
}

interface CategoryRule {
  category: GearCategory
  keywords: string[]
}

const CATEGORY_RULES: CategoryRule[] = [
  { category: 'carry', keywords: ['登山包', '重装包', '背负系统', '背包', '腰包', '包'] },
  { category: 'sleep', keywords: ['睡袋', '帐篷', '防潮垫', '气垫', '地垫', '内胆'] },
  { category: 'clothing', keywords: ['冲锋衣', '抓绒', '速干衣', '羽绒服', '软壳', '冲锋', '衣', '裤', '袜', '帽', '手套'] },
  { category: 'food', keywords: ['炉头', '气罐', '套锅', '钛杯', '饭盒', '炉', '锅', '灶', '杯'] },
  { category: 'safety', keywords: ['急救包', '医疗包', '求生', '哨子', '安全', '急救'] },
  { category: 'electronics', keywords: ['充电宝', '头灯', '手电', 'gps', 'GPS', '相机', '电子'] },
  { category: 'supply', keywords: ['能量胶', '能量棒', '路餐', '补给', '干粮', '食品', '能量', '胶', '棒'] },
]

const QUANTITY_SUFFIX_PATTERN = /\s*(?:[xX*×]\s*(\d+))\s*$/
const WEIGHT_PATTERN = /(\d+(?:\.\d+)?)\s*(kg|g)\b/i
const PRICE_PATTERN = /(\d+(?:\.\d+)?)\s*元/

const getCategoryLabel = (category: GearCategory): string => {
  return category === 'other' ? '杂项' : GEAR_CATEGORY_NAMES[category]
}

const inferCategory = (line: string): GearCategory => {
  const lower = line.toLowerCase()
  let bestMatch: { category: GearCategory; length: number } | null = null

  CATEGORY_RULES.forEach((rule) => {
    rule.keywords.forEach((keyword) => {
      if (!line.includes(keyword) && !lower.includes(keyword.toLowerCase())) {
        return
      }

      if (!bestMatch || keyword.length > bestMatch.length) {
        bestMatch = { category: rule.category, length: keyword.length }
      }
    })
  })

  return bestMatch ? bestMatch.category : 'other'
}

const parseWeightGrams = (match: RegExpMatchArray | null): number | null => {
  if (!match) {
    return null
  }

  const numeric = Number(match[1])

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null
  }

  const unit = match[2].toLowerCase()

  return unit === 'kg' ? kgToGrams(numeric) : Math.round(numeric)
}

const parsePriceCent = (match: RegExpMatchArray | null): number => {
  if (!match) {
    return 0
  }

  const numeric = Number(match[1])

  if (!Number.isFinite(numeric) || numeric < 0) {
    return 0
  }

  return yuanToCent(numeric)
}

const stripMatch = (text: string, match: RegExpMatchArray | null): string => {
  if (!match || match.index === undefined) {
    return text
  }

  return `${text.slice(0, match.index)} ${text.slice(match.index + match[0].length)}`.replace(/\s+/g, ' ').trim()
}

const parseLine = (rawLine: string, lineIndex: number): SmartParseItem => {
  const baseItem: SmartParseItem = {
    lineIndex,
    rawLine,
    ok: false,
    errorMessage: '',
    name: '',
    category: 'other',
    categoryLabel: '杂项',
    weight_g: null,
    weightLabel: '--',
    price_cent: 0,
    priceLabel: '--',
    quantity: 1,
    included: false,
    rowClass: 'is-error',
  }

  const trimmed = rawLine.trim()

  if (!trimmed) {
    return {
      ...baseItem,
      errorMessage: '空行已跳过',
    }
  }

  let working = trimmed
  const quantityMatch = working.match(QUANTITY_SUFFIX_PATTERN)
  const quantity = quantityMatch ? normalizeGearQuantity(Number(quantityMatch[1])) : 1

  working = stripMatch(working, quantityMatch)

  const weightMatch = working.match(WEIGHT_PATTERN)
  const weight_g = parseWeightGrams(weightMatch)

  working = stripMatch(working, weightMatch)

  const priceMatch = working.match(PRICE_PATTERN)
  const price_cent = parsePriceCent(priceMatch)

  working = stripMatch(working, priceMatch)

  const category = inferCategory(trimmed)
  const name = clampTextLength(working.trim(), MAX_GEAR_NAME_LENGTH)

  if (!name) {
    return {
      ...baseItem,
      category,
      categoryLabel: getCategoryLabel(category),
      quantity,
      errorMessage: '未识别装备名称',
    }
  }

  if (weight_g === null) {
    return {
      ...baseItem,
      name,
      category,
      categoryLabel: getCategoryLabel(category),
      price_cent,
      priceLabel: price_cent > 0 ? `${centToYuan(price_cent).toFixed(0)}元` : '--',
      quantity,
      errorMessage: '缺少重量，请补全后保存',
    }
  }

  return {
    lineIndex,
    rawLine,
    ok: true,
    errorMessage: '',
    name,
    category: normalizeGearCategory(category),
    categoryLabel: getCategoryLabel(normalizeGearCategory(category)),
    weight_g,
    weightLabel: formatWeight(weight_g),
    price_cent,
    priceLabel: price_cent > 0 ? `${centToYuan(price_cent).toFixed(0)}元` : '--',
    quantity,
    included: true,
    rowClass: '',
  }
}

export const parseSmartGearText = (text: string): SmartParseItem[] => {
  const lines = text.split(/\r?\n/)
  const items: SmartParseItem[] = []

  lines.forEach((line, index) => {
    const parsed = parseLine(line, index + 1)

    if (!line.trim()) {
      return
    }

    items.push(parsed)
  })

  return items
}

const parseItemToGearInput = (item: SmartParseItem): GearFormInput => {
  const category = normalizeGearCategory(item.category)
  const status = resolveStatusForCategory(category, 'using')
  const useKg = (item.weight_g || 0) >= 1000 && (item.weight_g || 0) % 1000 === 0

  return {
    name: item.name,
    category,
    weightValue: useKg ? String((item.weight_g || 0) / 1000) : String(item.weight_g || 0),
    weightUnit: useKg ? 'kg' : 'g',
    priceYuan: item.price_cent > 0 ? String(centToYuan(item.price_cent)) : '',
    quantity: item.quantity,
    status,
    purchase_date: '',
    channel: '',
    calorieKcalValue: category === 'supply' ? '1' : '',
    remark: '',
    image_url: '',
  }
}

const resolveDefaultPlanId = (): string | null => {
  const planId = resolveActivePlanId()

  return planId || null
}

const saveItemToGearLibrary = (item: SmartParseItem): SmartParseSaveResult => {
  const existingGear = findGearByExactName(item.name)

  if (existingGear) {
    const result = incrementGearQuantity(existingGear.id, item.quantity)

    if (!result.ok) {
      return { ok: false, message: result.message, savedCount: 0 }
    }

    return { ok: true, message: '已增加数量', savedCount: 1 }
  }

  const result = createGear(parseItemToGearInput(item))

  if (!result.ok) {
    return { ok: false, message: result.message, savedCount: 0 }
  }

  return { ok: true, message: '已保存', savedCount: 1 }
}

export const saveSmartParseItems = (
  items: SmartParseItem[],
  target: SmartParseSaveTarget
): SmartParseSaveResult => {
  const selectedItems = items.filter((item) => item.ok && item.included)

  if (!selectedItems.length) {
    return { ok: false, message: '请选择可保存的装备', savedCount: 0 }
  }

  if (target === 'default_plan') {
    const planId = resolveDefaultPlanId()

    if (!planId || !getPlanById(planId)) {
      return { ok: false, message: '请先创建出行方案', savedCount: 0 }
    }

    const planItems = selectedItems.map((item) => createTemporaryPlanItem({
      planId,
      name: item.name,
      category: item.category,
      weight_g: item.weight_g || 0,
      price_cent: item.price_cent,
      quantity: item.quantity,
      isConsumable: item.category === 'supply',
    }))

    savePlanItems(planItems)

    return {
      ok: true,
      message: `已加入方案 ${selectedItems.length} 项`,
      savedCount: selectedItems.length,
    }
  }

  let savedCount = 0

  for (const item of selectedItems) {
    const result = saveItemToGearLibrary(item)

    if (!result.ok) {
      return {
        ok: false,
        message: `「${item.name}」保存失败：${result.message}`,
        savedCount,
      }
    }

    savedCount += result.savedCount
  }

  return {
    ok: true,
    message: `已保存 ${savedCount} 项到装备库`,
    savedCount,
  }
}

export const getDefaultPlanLabel = (): string => {
  const planId = resolveDefaultPlanId()

  if (!planId) {
    return '暂无方案'
  }

  const plan = getPlanById(planId)

  return plan ? plan.name : '暂无方案'
}
