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
  },

  _transitionTimer: 0,

  onShow() {
    syncTabBar(this, 2)
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

    this.setData({
      form: defaultForm(),
      errors: defaultErrors(),
      limits: defaultGearFormInputLimits(),
      showErrors: false,
      statusOptions: getStatusOptionsForCategory('carry'),
    })

    this.startTransitionSwitchTab('/pages/equipment/equipment', '打开装备库...')
  },

  showParseHint() {
    wx.showToast({
      title: '智能解析将在 Stage 08 接入',
      icon: 'none',
    })
  },
})
