import {
  MAX_GEAR_CHANNEL_LENGTH,
  MAX_GEAR_NAME_LENGTH,
  MAX_GEAR_REMARK_LENGTH,
  clampCalorieInputValue,
  clampTextLength,
  clampPriceInputValue,
  clampWeightInputValue,
  createGear,
  convertWeightDisplayValue,
  findGearByExactName,
  incrementGearQuantity,
  parseCalorieKcal,
  parseWeightToGrams,
} from '../../services/gearService'
import type { GearFormInput } from '../../services/gearService'
import {
  GEAR_CATEGORY_OPTIONS,
  GEAR_STATUS_NAMES,
  getStatusOptionsForCategory,
  resolveStatusForCategory,
} from '../../utils/gearMeta'
import type { GearCategory, GearStatus } from '../../utils/models'
import {
  defaultGearFormInputLimits,
  isNumericInputExceeded,
  isTextLengthExceeded,
  type GearFormInputLimits,
} from '../../utils/gearFormView'
import { listPlans } from '../../services/planService'
import {
  getDefaultPlanLabel,
  parseSmartGearText,
  saveSmartParseItems,
  type SmartParseItem,
  type SmartParseSaveTarget,
} from '../../services/smartParseService'
import { syncTabBar } from '../../utils/tabBar'
import {
  clearTransitionLoading as clearTransitionLoadingState,
  startTransitionSwitchTab as startTransitionSwitchTabTo,
} from '../../utils/transitionLoading'

interface FormViewModel extends GearFormInput {
  categoryLabel: string
  statusLabel: string
}

interface FormErrors {
  name: boolean
  weight: boolean
  calorie: boolean
}

const defaultErrors = (): FormErrors => ({
  name: false,
  weight: false,
  calorie: false,
})

const defaultForm = (): FormViewModel => ({
  name: '',
  category: 'carry',
  weightValue: '',
  weightUnit: 'g',
  priceYuan: '',
  quantity: 1,
  status: 'using',
  purchase_date: '',
  channel: '',
  calorieKcalValue: '',
  remark: '',
  image_url: '',
  categoryLabel: GEAR_CATEGORY_OPTIONS[0].name,
  statusLabel: GEAR_STATUS_NAMES.using,
})

const formFromView = (form: FormViewModel): GearFormInput => ({
  name: form.name,
  category: form.category,
  weightValue: form.weightValue,
  weightUnit: form.weightUnit,
  priceYuan: form.priceYuan,
  quantity: form.quantity,
  status: resolveStatusForCategory(form.category, form.status),
  purchase_date: form.purchase_date,
  channel: form.channel,
  calorieKcalValue: form.calorieKcalValue,
  remark: form.remark,
  image_url: form.image_url,
})

const validateFormView = (form: FormViewModel): FormErrors => {
  const weight_g = parseWeightToGrams(form.weightValue, form.weightUnit)
  const calorie_kcal = parseCalorieKcal(form.calorieKcalValue)

  return {
    name: !form.name.trim(),
    weight: weight_g === null,
    calorie: form.category === 'supply' && calorie_kcal === null,
  }
}

const PARSE_EXAMPLE_TEXT = [
  '艾王35+5L 背包 1100g 125元',
  'MH500冲锋衣 450g 433元',
  '能量胶 40g 6元 x4',
  '测试装备 2.1kg 100元',
].join('\n')

const buildParseSummaryText = (items: SmartParseItem[]): string => {
  const validCount = items.filter((item) => item.ok).length
  const errorCount = items.length - validCount

  if (!items.length) {
    return '0 条结果'
  }

  if (errorCount <= 0) {
    return `${validCount} 条可保存`
  }

  return `${validCount} 条可保存 · ${errorCount} 条需修正`
}

const countSavableParseItems = (items: SmartParseItem[]): number => {
  return items.filter((item) => item.ok && item.included).length
}

const buildParseSaveConfirmContent = (items: SmartParseItem[], target: SmartParseSaveTarget): string => {
  const count = countSavableParseItems(items)
  const targetLabel = target === 'gear_library' ? '装备库' : `方案「${getDefaultPlanLabel()}」`

  return `将保存 ${count} 项到${targetLabel}，确认继续？`
}

const buildParseViewData = (input: {
  parseText: string
  parseItems: SmartParseItem[]
  showParsePreview: boolean
  saveTarget: SmartParseSaveTarget
  showParseSaveConfirm: boolean
}) => {
  const hasDefaultPlan = listPlans().length > 0
  const savableParseCount = countSavableParseItems(input.parseItems)

  return {
    parseText: input.parseText,
    parseItems: input.parseItems,
    showParsePreview: input.showParsePreview,
    saveTarget: input.saveTarget,
    hasDefaultPlan,
    defaultPlanLabel: getDefaultPlanLabel(),
    parseSummaryText: buildParseSummaryText(input.parseItems),
    savableParseCount,
    showParseSaveConfirm: input.showParseSaveConfirm,
    parseSaveConfirmContent: buildParseSaveConfirmContent(input.parseItems, input.saveTarget),
  }
}

Page({
  data: {
    form: defaultForm(),
    errors: defaultErrors(),
    limits: defaultGearFormInputLimits(),
    showErrors: false,
    categoryOptions: GEAR_CATEGORY_OPTIONS,
    statusOptions: getStatusOptionsForCategory('carry'),
    showTransitionLoading: false,
    transitionLoadingText: '',
    showDuplicateGearConfirm: false,
    duplicateGearConfirmContent: '',
    duplicateGearId: '',
    ...buildParseViewData({
      parseText: '',
      parseItems: [],
      showParsePreview: false,
      saveTarget: 'gear_library',
      showParseSaveConfirm: false,
    }),
  },

  _transitionTimer: 0,

  onShow() {
    syncTabBar(this, 2)
    this.setData(buildParseViewData({
      parseText: this.data.parseText as string,
      parseItems: (this.data.parseItems as SmartParseItem[]) || [],
      showParsePreview: Boolean(this.data.showParsePreview),
      saveTarget: (this.data.saveTarget as SmartParseSaveTarget) || 'gear_library',
      showParseSaveConfirm: Boolean(this.data.showParseSaveConfirm),
    }))
  },

  onHide() {
    this.clearTransitionLoading()
  },

  onUnload() {
    this.clearTransitionLoading()
  },

  clearTransitionLoading() {
    clearTransitionLoadingState(this)
  },

  startTransitionSwitchTab(url: string, text: string) {
    startTransitionSwitchTabTo(this, url, text)
  },

  onInputName(event: WechatMiniprogram.Input) {
    const raw = event.detail.value
    const name = clampTextLength(raw, MAX_GEAR_NAME_LENGTH)
    const updates: Record<string, unknown> = {
      'form.name': name,
      'limits.name': isTextLengthExceeded(raw, MAX_GEAR_NAME_LENGTH),
    }

    if (this.data.showErrors && this.data.errors.name) {
      updates['errors.name'] = false
    }

    this.setData(updates)
  },

  onInputWeight(event: WechatMiniprogram.Input) {
    const form = this.data.form as FormViewModel
    const raw = event.detail.value
    const weightValue = clampWeightInputValue(raw, form.weightUnit)
    const updates: Record<string, unknown> = {
      'form.weightValue': weightValue,
      'limits.weight': isNumericInputExceeded(raw, weightValue),
    }

    if (this.data.showErrors && this.data.errors.weight) {
      updates['errors.weight'] = false
    }

    this.setData(updates)
  },

  onInputPrice(event: WechatMiniprogram.Input) {
    const raw = event.detail.value
    const priceYuan = clampPriceInputValue(raw)

    this.setData({
      'form.priceYuan': priceYuan,
      'limits.price': isNumericInputExceeded(raw, priceYuan),
    })
  },

  onInputCalorie(event: WechatMiniprogram.Input) {
    const raw = event.detail.value
    const calorieKcalValue = clampCalorieInputValue(raw)
    const updates: Record<string, unknown> = {
      'form.calorieKcalValue': calorieKcalValue,
      'limits.calorie': isNumericInputExceeded(raw, calorieKcalValue),
    }

    if (this.data.showErrors && this.data.errors.calorie) {
      updates['errors.calorie'] = false
    }

    this.setData(updates)
  },

  onInputChannel(event: WechatMiniprogram.Input) {
    const raw = event.detail.value
    const channel = clampTextLength(raw, MAX_GEAR_CHANNEL_LENGTH)

    this.setData({
      'form.channel': channel,
      'limits.channel': isTextLengthExceeded(raw, MAX_GEAR_CHANNEL_LENGTH),
    })
  },

  onInputRemark(event: WechatMiniprogram.Input) {
    const raw = event.detail.value
    const remark = clampTextLength(raw, MAX_GEAR_REMARK_LENGTH)

    this.setData({
      'form.remark': remark,
      'limits.remark': isTextLengthExceeded(raw, MAX_GEAR_REMARK_LENGTH),
    })
  },

  onCategoryChange(event: WechatMiniprogram.CustomEvent) {
    const categoryId = event.detail.value as GearCategory
    const category = GEAR_CATEGORY_OPTIONS.find((item) => item.id === categoryId)

    if (!category) {
      return
    }

    const form = this.data.form as FormViewModel
    const nextStatus = resolveStatusForCategory(category.id, form.status)

    this.setData({
      'form.category': category.id,
      'form.categoryLabel': category.name,
      'form.status': nextStatus,
      'form.statusLabel': GEAR_STATUS_NAMES[nextStatus],
      statusOptions: getStatusOptionsForCategory(category.id),
      'errors.calorie': category.id === 'supply' ? this.data.errors.calorie : false,
      'limits.channel': false,
    })
  },

  onStatusChange(event: WechatMiniprogram.CustomEvent) {
    const statusId = event.detail.value as GearStatus
    const form = this.data.form as FormViewModel
    const statusOptions = getStatusOptionsForCategory(form.category)
    const status = statusOptions.find((item) => item.id === statusId)

    if (!status) {
      return
    }

    this.setData({
      'form.status': status.id,
      'form.statusLabel': status.name,
    })
  },

  onQuantityChange(event: WechatMiniprogram.CustomEvent<{ value: number }>) {
    const value = event.detail.value

    if (!Number.isFinite(value)) {
      return
    }

    this.setData({
      'form.quantity': value,
      'limits.quantity': false,
    })
  },

  onQuantityLimit(event: WechatMiniprogram.CustomEvent<{ exceeded: boolean }>) {
    this.setData({
      'limits.quantity': event.detail.exceeded,
    })
  },

  onWeightUnitTap(event: WechatMiniprogram.TouchEvent) {
    const weightUnit = event.currentTarget.dataset.unit as 'g' | 'kg'

    if (weightUnit !== 'g' && weightUnit !== 'kg') {
      return
    }

    const form = this.data.form as FormViewModel

    if (form.weightUnit === weightUnit) {
      return
    }

    const updates: Record<string, unknown> = {
      'form.weightUnit': weightUnit,
      'form.weightValue': convertWeightDisplayValue(form.weightValue, form.weightUnit, weightUnit),
      'limits.weight': false,
    }

    if (this.data.showErrors && this.data.errors.weight) {
      updates['errors.weight'] = false
    }

    this.setData(updates)
  },

  onPurchaseDateChange(event: WechatMiniprogram.CustomEvent) {
    const purchase_date = (event.detail && event.detail.value) ? (event.detail.value as string) : ''

    this.setData({
      'form.purchase_date': purchase_date,
    })
  },

  openAddDatePicker() {
    const picker = this.selectComponent('#addDatePicker') as WechatMiniprogram.Component.TrivialInstance | null

    if (picker && typeof picker.openPanel === 'function') {
      picker.openPanel()
    }
  },

  closeAddDatePickerPanel() {
    const picker = this.selectComponent('#addDatePicker') as WechatMiniprogram.Component.TrivialInstance | null

    if (picker && typeof picker.closePanel === 'function') {
      picker.closePanel()
    }
  },

  clearForm() {
    this.closeAddDatePickerPanel()
    this.setData({
      form: defaultForm(),
      errors: defaultErrors(),
      limits: defaultGearFormInputLimits(),
      showErrors: false,
      statusOptions: getStatusOptionsForCategory('carry'),
    })
  },

  saveGear() {
    const form = this.data.form as FormViewModel
    const errors = validateFormView(form)

    if (errors.name || errors.weight || errors.calorie) {
      this.setData({
        errors,
        showErrors: true,
      })
      wx.showToast({
        title: '请填写必填项',
        icon: 'none',
      })
      return
    }

    const limits = this.data.limits as GearFormInputLimits

    if (limits.quantity) {
      wx.showToast({
        title: '数量超出限制',
        icon: 'none',
      })
      return
    }

    const existingGear = findGearByExactName(form.name)

    if (existingGear) {
      this.setData({
        showDuplicateGearConfirm: true,
        duplicateGearConfirmContent: `装备「${existingGear.name}」已存在，是否为该装备增加 1 件数量？`,
        duplicateGearId: existingGear.id,
      })
      return
    }

    this.createNewGear()
  },

  closeDuplicateGearConfirm() {
    this.setData({
      showDuplicateGearConfirm: false,
      duplicateGearConfirmContent: '',
      duplicateGearId: '',
    })
  },

  confirmDuplicateGearQuantity() {
    const gearId = this.data.duplicateGearId as string

    if (!gearId) {
      this.closeDuplicateGearConfirm()
      return
    }

    const result = incrementGearQuantity(gearId, 1)

    if (!result.ok) {
      wx.showToast({
        title: result.message,
        icon: 'none',
      })
      return
    }

    this.closeDuplicateGearConfirm()
    wx.showToast({
      title: '数量已增加',
      icon: 'success',
    })
    this.resetFormAfterSave()
    this.startTransitionSwitchTab('/pages/equipment/equipment', '打开装备库...')
  },

  createNewGear() {
    const form = this.data.form as FormViewModel
    const result = createGear(formFromView(form))

    if (!result.ok) {
      wx.showToast({
        title: result.message,
        icon: 'none',
      })
      return
    }

    wx.showToast({
      title: '保存成功',
      icon: 'success',
    })

    this.resetFormAfterSave()
    this.startTransitionSwitchTab('/pages/equipment/equipment', '打开装备库...')
  },

  resetFormAfterSave() {
    this.setData({
      form: defaultForm(),
      errors: defaultErrors(),
      limits: defaultGearFormInputLimits(),
      showErrors: false,
      statusOptions: getStatusOptionsForCategory('carry'),
    })
  },

  onParseInput(event: WechatMiniprogram.Input) {
    this.setData({
      parseText: event.detail.value,
    })
  },

  fillParseExample() {
    this.setData({
      parseText: PARSE_EXAMPLE_TEXT,
    })
  },

  runSmartParse() {
    const parseText = (this.data.parseText as string) || ''
    const parseItems = parseSmartGearText(parseText)

    if (!parseText.trim()) {
      wx.showToast({
        title: '请输入装备文本',
        icon: 'none',
      })
    }

    this.setData(buildParseViewData({
      parseText,
      parseItems,
      showParsePreview: true,
      saveTarget: (this.data.saveTarget as SmartParseSaveTarget) || 'gear_library',
      showParseSaveConfirm: false,
    }))
  },

  toggleParseItem(event: WechatMiniprogram.TouchEvent) {
    const index = Number(event.currentTarget.dataset.index)

    if (!Number.isFinite(index)) {
      return
    }

    const parseItems = ((this.data.parseItems as SmartParseItem[]) || []).slice()
    const item = parseItems[index]

    if (!item || !item.ok) {
      return
    }

    item.included = !item.included
    parseItems[index] = item

    this.setData(buildParseViewData({
      parseText: (this.data.parseText as string) || '',
      parseItems,
      showParsePreview: Boolean(this.data.showParsePreview),
      saveTarget: (this.data.saveTarget as SmartParseSaveTarget) || 'gear_library',
      showParseSaveConfirm: false,
    }))
  },

  selectSaveTarget(event: WechatMiniprogram.TouchEvent) {
    const target = event.currentTarget.dataset.target as SmartParseSaveTarget | undefined

    if (target !== 'gear_library' && target !== 'default_plan') {
      return
    }

    if (target === 'default_plan' && !this.data.hasDefaultPlan) {
      wx.showToast({
        title: '请先创建出行方案',
        icon: 'none',
      })
      return
    }

    this.setData(buildParseViewData({
      parseText: (this.data.parseText as string) || '',
      parseItems: (this.data.parseItems as SmartParseItem[]) || [],
      showParsePreview: Boolean(this.data.showParsePreview),
      saveTarget: target,
      showParseSaveConfirm: false,
    }))
  },

  openSaveConfirm() {
    const parseItems = (this.data.parseItems as SmartParseItem[]) || []
    const savableParseCount = countSavableParseItems(parseItems)

    if (savableParseCount <= 0) {
      wx.showToast({
        title: '没有可保存的装备',
        icon: 'none',
      })
      return
    }

    const invalidIncluded = parseItems.some((item) => !item.ok && item.included)

    if (invalidIncluded) {
      wx.showToast({
        title: '请先修正无法解析的行',
        icon: 'none',
      })
      return
    }

    this.setData(buildParseViewData({
      parseText: (this.data.parseText as string) || '',
      parseItems,
      showParsePreview: true,
      saveTarget: (this.data.saveTarget as SmartParseSaveTarget) || 'gear_library',
      showParseSaveConfirm: true,
    }))
  },

  closeParseSaveConfirm() {
    this.setData(buildParseViewData({
      parseText: (this.data.parseText as string) || '',
      parseItems: (this.data.parseItems as SmartParseItem[]) || [],
      showParsePreview: Boolean(this.data.showParsePreview),
      saveTarget: (this.data.saveTarget as SmartParseSaveTarget) || 'gear_library',
      showParseSaveConfirm: false,
    }))
  },

  confirmSaveParse() {
    const parseItems = (this.data.parseItems as SmartParseItem[]) || []
    const saveTarget = (this.data.saveTarget as SmartParseSaveTarget) || 'gear_library'
    const result = saveSmartParseItems(parseItems, saveTarget)

    this.closeParseSaveConfirm()

    if (!result.ok) {
      wx.showToast({
        title: result.message,
        icon: 'none',
      })
      return
    }

    wx.showToast({
      title: result.message,
      icon: 'success',
    })

    this.setData(buildParseViewData({
      parseText: '',
      parseItems: [],
      showParsePreview: false,
      saveTarget,
      showParseSaveConfirm: false,
    }))

    if (saveTarget === 'default_plan') {
      this.startTransitionSwitchTab('/pages/plans/plans', '打开方案页...')
      return
    }

    this.startTransitionSwitchTab('/pages/equipment/equipment', '打开装备库...')
  },
})
