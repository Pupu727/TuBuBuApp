import {
  MAX_GEAR_CHANNEL_LENGTH,
  MAX_GEAR_NAME_LENGTH,
  MAX_GEAR_REMARK_LENGTH,
  clampCalorieInputValue,
  clampTextLength,
  clampPriceInputValue,
  clampWeightInputValue,
  createGear,
  findGearByExactName,
  getGearById,
  gearToFormInput,
  incrementGearQuantity,
  convertWeightDisplayValue,
  parseCalorieKcal,
  parseWeightToGrams,
  softDeleteGear,
  updateGear,
} from '../../services/gearService'
import type { GearFormInput } from '../../services/gearService'
import { getGearList, getGearListForPlan, getGearSummaryByFilter, getGearSummaryForPlan, getGearHeaderInsight, getGearsForPlanHeader, getPlanList } from '../../services/dashboardService'
import { listGears } from '../../services/gearService'
import { resolveActivePlanId } from '../../services/planService'
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
  startTransitionNavigate as startTransitionNavigateTo,
  startTransitionSwitchTab as startTransitionSwitchTabTo,
} from '../../utils/transitionLoading'
import {
  finishInitialLoading,
  markInitialLoadingStart,
  resetInitialLoading,
} from '../../utils/pageInitialLoading'
import { consumeEquipmentPageViewIntent } from '../../utils/equipmentPageIntent'

type CategoryFilter = GearCategory | 'all'
type ViewMode = 'library' | 'plan'

interface CategoryTab {
  id: CategoryFilter
  name: string
  activeClass: string
  showCaret: boolean
}

interface PlanOption {
  id: string
  name: string
}

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

const buildFormView = (form: GearFormInput): FormViewModel => {
  const category = GEAR_CATEGORY_OPTIONS.find((item) => item.id === form.category) || GEAR_CATEGORY_OPTIONS[0]
  const status = resolveStatusForCategory(form.category, form.status)

  return {
    ...form,
    category: category.id,
    status,
    categoryLabel: category.name,
    statusLabel: GEAR_STATUS_NAMES[status],
  }
}

const validateFormView = (form: FormViewModel): FormErrors => {
  const weight_g = parseWeightToGrams(form.weightValue, form.weightUnit)
  const calorie_kcal = parseCalorieKcal(form.calorieKcalValue)

  return {
    name: !form.name.trim(),
    weight: weight_g === null,
    calorie: form.category === 'supply' && calorie_kcal === null,
  }
}

const fallbackPlan: PlanOption = {
  id: 'default',
  name: '空方案',
}

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

const getPlanOptions = (): PlanOption[] => {
  const plans = getPlanList()

  if (plans.length === 0) {
    return [fallbackPlan]
  }

  return plans.map((plan) => ({
    id: plan.id,
    name: plan.name,
  }))
}

const resolveDefaultPlanId = (): string => {
  const plans = getPlanList()

  if (plans.length === 0) {
    return fallbackPlan.id
  }

  const activePlan = plans.find((plan) => plan.id === resolveActivePlanId()) || plans[0]

  return activePlan.id
}

const resolveSelectedPlanId = (selectedPlanId: string): string => {
  const plans = getPlanList()

  if (plans.length === 0) {
    return fallbackPlan.id
  }

  if (plans.some((plan) => plan.id === selectedPlanId)) {
    return selectedPlanId
  }

  const activePlan = plans.find((plan) => plan.id === resolveActivePlanId()) || plans[0]

  return activePlan.id
}

const resolvePlanIndex = (planOptions: PlanOption[], selectedPlanId: string): number => {
  const planIndex = planOptions.findIndex((plan) => plan.id === selectedPlanId)

  return planIndex >= 0 ? planIndex : 0
}

const getCategoryOptionsFromGears = (
  gears: Array<{ category: GearCategory; categoryName: string }>
): Array<{ id: GearCategory; name: string }> => {
  const categoryIds: string[] = []

  return gears.reduce<Array<{ id: GearCategory; name: string }>>((options, gear) => {
    if (categoryIds.indexOf(gear.category) >= 0) {
      return options
    }

    categoryIds.push(gear.category)
    options.push({
      id: gear.category,
      name: gear.categoryName,
    })

    return options
  }, [])
}

const getOwnedCategoryOptions = (): Array<{ id: GearCategory; name: string }> => {
  return getCategoryOptionsFromGears(getGearList())
}

const getPlanOwnedCategoryOptions = (planId: string): Array<{ id: GearCategory; name: string }> => {
  return getCategoryOptionsFromGears(getGearListForPlan(planId))
}

const resolveActiveCategory = (
  activeCategory: CategoryFilter,
  ownedCategories: Array<{ id: GearCategory; name: string }>
): CategoryFilter => {
  if (activeCategory === 'all') {
    return 'all'
  }

  return ownedCategories.some((category) => category.id === activeCategory) ? activeCategory : 'all'
}

const buildCategoryTabs = (
  activeCategory: CategoryFilter,
  ownedCategories: Array<{ id: GearCategory; name: string }>
): CategoryTab[] => {
  if (ownedCategories.length === 0) {
    return []
  }

  const baseCategories: Array<{ id: CategoryFilter; name: string }> = [{ id: 'all', name: '全部' }]

  ownedCategories.forEach((category) => {
    baseCategories.push(category)
  })

  return baseCategories.map((category) => ({
    id: category.id,
    name: category.name,
    activeClass: category.id === activeCategory ? 'category-active' : '',
    showCaret: category.id === activeCategory,
  }))
}

interface PageState {
  viewMode: ViewMode
  activeCategory: CategoryFilter
  selectedPlanId: string
  searchKeyword: string
  showSmartPackModal: boolean
  showEditModal: boolean
  editingGearId: string
  editForm: FormViewModel
  editErrors: FormErrors
  editLimits: ReturnType<typeof defaultGearFormInputLimits>
  showEditErrors: boolean
  showDeleteConfirm: boolean
  editStatusOptions: Array<{ id: GearStatus; name: string }>
  showPlanPanel: boolean
  isBatchDeleteMode: boolean
  selectedGearIds: string[]
  showBatchDeleteConfirm: boolean
}

const buildPageData = (state: PageState) => {
  const isPlanView = state.viewMode === 'plan' && getPlanList().length > 0
  const planOptions = getPlanOptions()
  const hasPlans = getPlanList().length > 0
  const resolvedPlanId = resolveSelectedPlanId(state.selectedPlanId)
  state.selectedPlanId = resolvedPlanId
  const activePlanIndex = resolvePlanIndex(planOptions, resolvedPlanId)
  const activePlan = planOptions[activePlanIndex] || fallbackPlan
  const keyword = state.searchKeyword.trim()
  const ownedCategories = isPlanView ? getPlanOwnedCategoryOptions(resolvedPlanId) : getOwnedCategoryOptions()
  const resolvedCategory = resolveActiveCategory(state.activeCategory, ownedCategories)
  const effectiveCategoryFilter = resolvedCategory === 'all' ? undefined : resolvedCategory
  const allGears = isPlanView
    ? getGearListForPlan(resolvedPlanId)
    : getGearList()
  const rawGears = isPlanView
    ? getGearListForPlan(resolvedPlanId, effectiveCategoryFilter, keyword || undefined)
    : getGearList(effectiveCategoryFilter, keyword || undefined)
  const allGearIds = allGears.map((gear) => gear.id)
  const selectedGearIds = state.selectedGearIds.filter((gearId) => allGearIds.indexOf(gearId) >= 0)
  const gears = rawGears.map((gear) => {
    const isSelected = selectedGearIds.indexOf(gear.id) >= 0

    return {
      ...gear,
      batchSelectedClass: isSelected ? 'is-selected' : '',
      batchCheckClass: isSelected ? 'is-active' : '',
      batchCheckText: isSelected ? '✓' : '',
    }
  })
  state.selectedGearIds = selectedGearIds
  const summary = isPlanView
    ? getGearSummaryForPlan(resolvedPlanId, effectiveCategoryFilter, keyword || undefined)
    : getGearSummaryByFilter(effectiveCategoryFilter, keyword || undefined)
  const hasAnyGear = allGears.length > 0
  const showNoResults = hasAnyGear && gears.length === 0
  const noResultsText = keyword ? '未找到匹配的装备' : '当前筛选下暂无装备'
  const hasActiveFilter = resolvedCategory !== 'all' || Boolean(keyword)
  const showClearFilters = showNoResults && hasActiveFilter
  const isPlanEmpty = isPlanView && !hasAnyGear
  const emptyTitle = isPlanEmpty ? '当前方案还没有装备' : '还没有装备'
  const emptyDesc = isPlanEmpty
    ? '去打包页把装备加入当前方案'
    : '可手动新增，或用智能解析批量录入'
  const headerGears = isPlanView ? getGearsForPlanHeader(resolvedPlanId) : listGears()
  const headerInsight = getGearHeaderInsight(headerGears, resolvedCategory, {
    eyebrow: isPlanView ? activePlan.name : '全部装备',
    isPlanEmpty,
  })

  return {
    viewMode: state.viewMode,
    summary,
    headerInsight,
    categories: buildCategoryTabs(resolvedCategory, ownedCategories),
    activeCategory: resolvedCategory,
    planOptions,
    hasPlans,
    activePlanIndex,
    activePlanId: activePlan.id,
    activePlanName: hasPlans ? activePlan.name : '空方案',
    searchKeyword: state.searchKeyword,
    gears,
    isGearEmpty: !hasAnyGear,
    isPlanView,
    isPlanEmpty,
    emptyTitle,
    emptyDesc,
    showNoResults,
    noResultsText,
    showClearFilters,
    showCategoryRail: ownedCategories.length > 0,
    showSmartPackModal: state.showSmartPackModal,
    showEditModal: state.showEditModal,
    editingGearId: state.editingGearId,
    editForm: state.editForm,
    editErrors: state.editErrors,
    editLimits: state.editLimits,
    showEditErrors: state.showEditErrors,
    showDeleteConfirm: state.showDeleteConfirm,
    editStatusOptions: state.editStatusOptions,
    categoryOptions: GEAR_CATEGORY_OPTIONS,
    showPlanPanel: state.showPlanPanel,
    isBatchDeleteMode: state.isBatchDeleteMode,
    selectedGearIds,
    selectedGearCount: selectedGearIds.length,
    showBatchDeleteConfirm: state.showBatchDeleteConfirm,
  }
}

const getPageState = (page: WechatMiniprogram.Page.TrivialInstance): PageState => ({
  viewMode: (page.data.viewMode as ViewMode) || 'library',
  activeCategory: page.data.activeCategory as CategoryFilter,
  selectedPlanId: page.data.activePlanId as string,
  searchKeyword: (page.data.searchKeyword as string) || '',
  showSmartPackModal: Boolean(page.data.showSmartPackModal),
  showEditModal: Boolean(page.data.showEditModal),
  editingGearId: (page.data.editingGearId as string) || '',
  editForm: (page.data.editForm as FormViewModel) || defaultForm(),
  editErrors: (page.data.editErrors as FormErrors) || defaultErrors(),
  editLimits: (page.data.editLimits as ReturnType<typeof defaultGearFormInputLimits>) || defaultGearFormInputLimits(),
  showEditErrors: Boolean(page.data.showEditErrors),
  showDeleteConfirm: Boolean(page.data.showDeleteConfirm),
  editStatusOptions: (page.data.editStatusOptions as Array<{ id: GearStatus; name: string }>) || getStatusOptionsForCategory('carry'),
  showPlanPanel: Boolean(page.data.showPlanPanel),
  isBatchDeleteMode: Boolean(page.data.isBatchDeleteMode),
  selectedGearIds: ((page.data.selectedGearIds as string[]) || []).slice(),
  showBatchDeleteConfirm: Boolean(page.data.showBatchDeleteConfirm),
})

Page({
  data: {
    ...buildPageData({
    viewMode: 'library',
    activeCategory: 'all',
    selectedPlanId: resolveDefaultPlanId(),
    searchKeyword: '',
    showSmartPackModal: false,
    showEditModal: false,
    editingGearId: '',
    editForm: defaultForm(),
    editErrors: defaultErrors(),
    editLimits: defaultGearFormInputLimits(),
    showEditErrors: false,
    showDeleteConfirm: false,
    editStatusOptions: getStatusOptionsForCategory('carry'),
    showPlanPanel: false,
    isBatchDeleteMode: false,
    selectedGearIds: [],
    showBatchDeleteConfirm: false,
    showDuplicateGearConfirm: false,
    duplicateGearConfirmContent: '',
    duplicateGearId: '',
    }),
    showTransitionLoading: false,
    transitionLoadingText: '',
    initialLoading: true,
    initialLoadingText: '读取装备库...',
    showBackToTop: false,
    pageScrollTop: 0,
  },

  _transitionTimer: 0,
  _hasPreparedInitialView: false,

  onUnload() {
    this.clearTransitionLoading()
    resetInitialLoading(this)
  },

  onHide() {
    this.clearTransitionLoading()
    resetInitialLoading(this)
  },

  onShow() {
    this.clearTransitionLoading()

    const isFirstPrepare = !this._hasPreparedInitialView

    if (isFirstPrepare) {
      markInitialLoadingStart(this)
      this.setData({
        initialLoading: true,
      })
    }

    syncTabBar(this, 1)

    const state = getPageState(this)
    state.showEditModal = false
    state.editingGearId = ''
    state.editForm = defaultForm()
    state.editErrors = defaultErrors()
    state.editLimits = defaultGearFormInputLimits()
    state.showEditErrors = false
    state.showDeleteConfirm = false
    state.showPlanPanel = false
    state.isBatchDeleteMode = false
    state.selectedGearIds = []
    state.showBatchDeleteConfirm = false

    if (consumeEquipmentPageViewIntent() === 'library') {
      state.viewMode = 'library'
      state.activeCategory = 'all'
      state.showPlanPanel = false
    }

    this.setData(buildPageData(state))

    if (isFirstPrepare) {
      this._hasPreparedInitialView = true
      finishInitialLoading(this)
    }
  },

  onPageScroll(event: WechatMiniprogram.ScrollViewScroll) {
    const detail = event && (event as WechatMiniprogram.ScrollViewScroll).detail
    const top = detail && typeof detail.scrollTop === 'number' ? detail.scrollTop : 0
    const show = top >= 420
    if (show !== Boolean(this.data.showBackToTop)) {
      this.setData({
        showBackToTop: show,
      })
    }
  },

  scrollToTop() {
    const current = Number(this.data.pageScrollTop) || 0
    // scroll-view 通过 scroll-top 回顶；先写入一个微小不同值，避免某些机型不触发
    this.setData({ pageScrollTop: current === 0 ? 1 : 0 }, () => {
      this.setData({
        pageScrollTop: 0,
        showBackToTop: false,
      })
    })
  },

  onSearchInput(event: WechatMiniprogram.Input) {
    const state = getPageState(this)
    state.searchKeyword = event.detail.value

    this.setData(buildPageData(state))
  },

  clearSearch() {
    const state = getPageState(this)
    state.searchKeyword = ''

    this.setData(buildPageData(state))
  },

  clearAllFilters() {
    const state = getPageState(this)
    state.searchKeyword = ''
    state.activeCategory = 'all'

    this.setData(buildPageData(state))
  },

  selectCategory(event: WechatMiniprogram.TouchEvent) {
    const currentDataset = event.currentTarget.dataset
    const targetDataset = event.target.dataset
    const activeCategory = (currentDataset.category || currentDataset.id || targetDataset.category || targetDataset.id) as
      | CategoryFilter
      | undefined

    if (!activeCategory) {
      return
    }

    const state = getPageState(this)
    state.activeCategory = activeCategory

    this.setData(buildPageData(state))
  },

  selectLibraryView() {
    const state = getPageState(this)

    if (state.viewMode === 'library') {
      return
    }

    state.viewMode = 'library'
    state.activeCategory = 'all'
    state.showPlanPanel = false

    this.setData(buildPageData(state))
  },

  onPlanSegmentTap() {
    if (this.data.isBatchDeleteMode) {
      this.closeBatchDeleteMode()
      return
    }

    if (!getPlanList().length) {
      const state = getPageState(this)
      state.showSmartPackModal = true
      this.setData(buildPageData(state))
      return
    }

    const state = getPageState(this)
    const planOptions = getPlanOptions()

    if (state.viewMode !== 'plan') {
      state.viewMode = 'plan'
      state.selectedPlanId = resolveSelectedPlanId(state.selectedPlanId)
      state.activeCategory = 'all'
      state.showPlanPanel = false
      this.setData(buildPageData(state))
      return
    }

    if (planOptions.length > 1) {
      state.showPlanPanel = !state.showPlanPanel
      this.setData(buildPageData(state))
    }
  },

  closePlanPanel() {
    const state = getPageState(this)

    if (!state.showPlanPanel) {
      return
    }

    state.showPlanPanel = false
    this.setData(buildPageData(state))
  },

  selectPlanFromPanel(event: WechatMiniprogram.TouchEvent) {
    const planId = event.currentTarget.dataset.id as string

    if (!planId) {
      return
    }

    const state = getPageState(this)

    if (planId === state.selectedPlanId) {
      state.showPlanPanel = false
      this.setData(buildPageData(state))
      return
    }

    state.viewMode = 'plan'
    state.selectedPlanId = planId
    state.activeCategory = 'all'
    state.showPlanPanel = false

    this.setData(buildPageData(state))
  },

  clearTransitionLoading() {
    clearTransitionLoadingState(this)
  },

  startTransitionNavigate(url: string, text: string) {
    startTransitionNavigateTo(this, url, text)
  },

  startTransitionSwitchTab(url: string, text: string) {
    startTransitionSwitchTabTo(this, url, text)
  },

  goPlansPage() {
    const state = getPageState(this)
    state.showPlanPanel = false
    this.setData(buildPageData(state))

    this.startTransitionSwitchTab('/pages/plans/plans', '打开出行方案...')
  },

  noop() {},

  toggleBatchDeleteMode() {
    if (this.data.isBatchDeleteMode) {
      this.closeBatchDeleteMode()
      return
    }

    this.openBatchDeleteMode()
  },

  openBatchDeleteMode() {
    if (getGearList().length === 0) {
      wx.showToast({
        title: '还没有装备可删除',
        icon: 'none',
      })
      return
    }

    const state = getPageState(this)
    state.viewMode = 'library'
    state.showPlanPanel = false
    state.showSmartPackModal = false
    state.isBatchDeleteMode = true
    state.selectedGearIds = []
    state.showBatchDeleteConfirm = false

    this.setData(buildPageData(state))
  },

  closeBatchDeleteMode() {
    const state = getPageState(this)
    state.isBatchDeleteMode = false
    state.selectedGearIds = []
    state.showBatchDeleteConfirm = false

    this.setData(buildPageData(state))
  },

  handleGearCardTap(event: WechatMiniprogram.TouchEvent) {
    if (this.data.isBatchDeleteMode) {
      this.toggleBatchGear(event)
      return
    }

    this.openEditModal(event)
  },

  toggleBatchGear(event: WechatMiniprogram.TouchEvent) {
    const gearId = event.currentTarget.dataset.id as string

    if (!gearId) {
      return
    }

    const state = getPageState(this)
    const selectedGearIds = state.selectedGearIds.slice()
    const selectedIndex = selectedGearIds.indexOf(gearId)

    if (selectedIndex >= 0) {
      selectedGearIds.splice(selectedIndex, 1)
    } else {
      selectedGearIds.push(gearId)
    }

    state.selectedGearIds = selectedGearIds

    this.setData(buildPageData(state))
  },

  confirmBatchDelete() {
    const selectedGearIds = (this.data.selectedGearIds as string[]) || []

    if (selectedGearIds.length === 0) {
      wx.showToast({
        title: '请先选择装备',
        icon: 'none',
      })
      return
    }

    this.setData({
      showBatchDeleteConfirm: true,
    })
  },

  closeBatchDeleteConfirm() {
    this.setData({
      showBatchDeleteConfirm: false,
    })
  },

  executeBatchDeleteGear() {
    const selectedGearIds = ((this.data.selectedGearIds as string[]) || []).slice()

    if (selectedGearIds.length === 0) {
      this.closeBatchDeleteConfirm()
      return
    }

    let failedCount = 0

    selectedGearIds.forEach((gearId) => {
      const deleteResult = softDeleteGear(gearId)

      if (!deleteResult.ok) {
        failedCount += 1
      }
    })

    const state = getPageState(this)
    state.isBatchDeleteMode = false
    state.selectedGearIds = []
    state.showBatchDeleteConfirm = false

    this.setData(buildPageData(state))

    wx.showToast({
      title: failedCount > 0 ? '部分删除失败' : '已删除',
      icon: failedCount > 0 ? 'none' : 'success',
    })
  },

  openCreateGearModal() {
    const state = getPageState(this)
    const editForm = defaultForm()

    state.showEditModal = true
    state.editingGearId = ''
    state.editForm = editForm
    state.editErrors = defaultErrors()
    state.editLimits = defaultGearFormInputLimits()
    state.showEditErrors = false
    state.showDeleteConfirm = false
    state.editStatusOptions = getStatusOptionsForCategory(editForm.category)

    this.setData(buildPageData(state))
  },

  openEditModal(event: WechatMiniprogram.TouchEvent) {
    const gearId = event.currentTarget.dataset.id as string
    const gear = getGearById(gearId)

    if (!gear) {
      wx.showToast({
        title: '装备不存在',
        icon: 'none',
      })
      return
    }

    const state = getPageState(this)
    state.showEditModal = true
    state.editingGearId = gearId
    state.editForm = buildFormView(gearToFormInput(gear))
    state.editErrors = defaultErrors()
    state.editLimits = defaultGearFormInputLimits()
    state.showEditErrors = false
    state.showDeleteConfirm = false
    state.editStatusOptions = getStatusOptionsForCategory(state.editForm.category)

    this.setData(buildPageData(state))
  },

  closeEditDatePickerPanel() {
    const picker = this.selectComponent('#editDatePicker') as WechatMiniprogram.Component.TrivialInstance | null

    if (picker && typeof picker.closePanel === 'function') {
      picker.closePanel()
    }
  },

  openEditDatePicker() {
    const picker = this.selectComponent('#editDatePicker') as WechatMiniprogram.Component.TrivialInstance | null

    if (picker && typeof picker.openPanel === 'function') {
      picker.openPanel()
    }
  },

  closeEditModal() {
    this.closeEditDatePickerPanel()
    wx.hideKeyboard()
    const state = getPageState(this)
    state.showEditModal = false
    state.editingGearId = ''
    state.editForm = defaultForm()
    state.editErrors = defaultErrors()
    state.editLimits = defaultGearFormInputLimits()
    state.showEditErrors = false
    state.showDeleteConfirm = false
    state.editStatusOptions = getStatusOptionsForCategory('carry')

    this.setData(buildPageData(state))
  },

  onEditInputName(event: WechatMiniprogram.Input) {
    const raw = event.detail.value
    const name = clampTextLength(raw, MAX_GEAR_NAME_LENGTH)
    const updates: Record<string, unknown> = {
      'editForm.name': name,
      'editLimits.name': isTextLengthExceeded(raw, MAX_GEAR_NAME_LENGTH),
    }

    if (this.data.showEditErrors && this.data.editErrors.name) {
      updates['editErrors.name'] = false
    }

    this.setData(updates)
  },

  onEditInputWeight(event: WechatMiniprogram.Input) {
    const editForm = this.data.editForm as FormViewModel
    const raw = event.detail.value
    const weightValue = clampWeightInputValue(raw, editForm.weightUnit)
    const updates: Record<string, unknown> = {
      'editForm.weightValue': weightValue,
      'editLimits.weight': isNumericInputExceeded(raw, weightValue),
    }

    if (this.data.showEditErrors && this.data.editErrors.weight) {
      updates['editErrors.weight'] = false
    }

    this.setData(updates)
  },

  onEditInputPrice(event: WechatMiniprogram.Input) {
    const raw = event.detail.value
    const priceYuan = clampPriceInputValue(raw)

    this.setData({
      'editForm.priceYuan': priceYuan,
      'editLimits.price': isNumericInputExceeded(raw, priceYuan),
    })
  },

  onEditInputCalorie(event: WechatMiniprogram.Input) {
    const raw = event.detail.value
    const calorieKcalValue = clampCalorieInputValue(raw)
    const updates: Record<string, unknown> = {
      'editForm.calorieKcalValue': calorieKcalValue,
      'editLimits.calorie': isNumericInputExceeded(raw, calorieKcalValue),
    }

    if (this.data.showEditErrors && this.data.editErrors.calorie) {
      updates['editErrors.calorie'] = false
    }

    this.setData(updates)
  },

  onEditInputChannel(event: WechatMiniprogram.Input) {
    const raw = event.detail.value
    const channel = clampTextLength(raw, MAX_GEAR_CHANNEL_LENGTH)

    this.setData({
      'editForm.channel': channel,
      'editLimits.channel': isTextLengthExceeded(raw, MAX_GEAR_CHANNEL_LENGTH),
    })
  },

  onEditInputRemark(event: WechatMiniprogram.Input) {
    const raw = event.detail.value
    const remark = clampTextLength(raw, MAX_GEAR_REMARK_LENGTH)

    this.setData({
      'editForm.remark': remark,
      'editLimits.remark': isTextLengthExceeded(raw, MAX_GEAR_REMARK_LENGTH),
    })
  },

  onEditCategoryChange(event: WechatMiniprogram.CustomEvent) {
    const categoryId = event.detail.value as GearCategory
    const category = GEAR_CATEGORY_OPTIONS.find((item) => item.id === categoryId)

    if (!category) {
      return
    }

    const editForm = this.data.editForm as FormViewModel
    const nextStatus = resolveStatusForCategory(category.id, editForm.status)

    this.setData({
      'editForm.category': category.id,
      'editForm.categoryLabel': category.name,
      'editForm.status': nextStatus,
      'editForm.statusLabel': GEAR_STATUS_NAMES[nextStatus],
      editStatusOptions: getStatusOptionsForCategory(category.id),
      'editErrors.calorie': category.id === 'supply' ? this.data.editErrors.calorie : false,
      'editLimits.channel': false,
    })
  },

  onEditStatusChange(event: WechatMiniprogram.CustomEvent) {
    const statusId = event.detail.value as GearStatus
    const editForm = this.data.editForm as FormViewModel
    const statusOptions = getStatusOptionsForCategory(editForm.category)
    const status = statusOptions.find((item) => item.id === statusId)

    if (!status) {
      return
    }

    this.setData({
      'editForm.status': status.id,
      'editForm.statusLabel': status.name,
    })
  },

  onEditQuantityChange(event: WechatMiniprogram.CustomEvent<{ value: number }>) {
    const value = event.detail.value

    if (!Number.isFinite(value)) {
      return
    }

    this.setData({
      'editForm.quantity': value,
      'editLimits.quantity': false,
    })
  },

  onEditQuantityLimit(event: WechatMiniprogram.CustomEvent<{ exceeded: boolean }>) {
    this.setData({
      'editLimits.quantity': event.detail.exceeded,
    })
  },

  onEditWeightUnitTap(event: WechatMiniprogram.TouchEvent) {
    const weightUnit = event.currentTarget.dataset.unit as 'g' | 'kg'

    if (weightUnit !== 'g' && weightUnit !== 'kg') {
      return
    }

    const editForm = this.data.editForm as FormViewModel

    if (editForm.weightUnit === weightUnit) {
      return
    }

    const updates: Record<string, unknown> = {
      'editForm.weightUnit': weightUnit,
      'editForm.weightValue': convertWeightDisplayValue(editForm.weightValue, editForm.weightUnit, weightUnit),
      'editLimits.weight': false,
    }

    if (this.data.showEditErrors && this.data.editErrors.weight) {
      updates['editErrors.weight'] = false
    }

    this.setData(updates)
  },

  onEditPurchaseDateChange(event: WechatMiniprogram.CustomEvent) {
    const purchase_date = (event.detail && event.detail.value) ? (event.detail.value as string) : ''

    this.setData({
      'editForm.purchase_date': purchase_date,
    })
  },

  saveEdit() {
    const gearId = this.data.editingGearId as string
    const editForm = this.data.editForm as FormViewModel
    const editErrors = validateFormView(editForm)

    if (editErrors.name || editErrors.weight || editErrors.calorie) {
      this.setData({
        editErrors,
        showEditErrors: true,
      })
      wx.showToast({
        title: '请填写必填项',
        icon: 'none',
      })
      return
    }

    const editLimits = this.data.editLimits as GearFormInputLimits

    if (editLimits.quantity) {
      wx.showToast({
        title: '数量超出限制',
        icon: 'none',
      })
      return
    }

    if (!gearId) {
      const existingGear = findGearByExactName(editForm.name)

      if (existingGear) {
        this.setData({
          showDuplicateGearConfirm: true,
          duplicateGearConfirmContent: `装备「${existingGear.name}」已存在，是否为该装备增加 1 件数量？`,
          duplicateGearId: existingGear.id,
        })
        return
      }
    }

    this.executeSaveEdit()
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
    wx.hideKeyboard()

    const state = getPageState(this)
    state.showEditModal = false
    state.editingGearId = ''
    state.editForm = defaultForm()
    state.editErrors = defaultErrors()
    state.editLimits = defaultGearFormInputLimits()
    state.showEditErrors = false
    state.showDeleteConfirm = false

    this.setData(buildPageData(state))
  },

  executeSaveEdit() {
    const gearId = this.data.editingGearId as string
    const editForm = this.data.editForm as FormViewModel

    const result = gearId
      ? updateGear(gearId, formFromView(editForm))
      : createGear(formFromView(editForm))

    if (!result.ok) {
      wx.showToast({
        title: result.message,
        icon: 'none',
      })
      return
    }

    wx.showToast({
      title: gearId ? '已保存' : '已新增',
      icon: 'success',
    })

    wx.hideKeyboard()

    const state = getPageState(this)
    state.showEditModal = false
    state.editingGearId = ''
    state.editForm = defaultForm()
    state.editErrors = defaultErrors()
    state.editLimits = defaultGearFormInputLimits()
    state.showEditErrors = false
    state.showDeleteConfirm = false

    this.setData(buildPageData(state))
  },

  confirmDeleteGear() {
    this.setData({
      showDeleteConfirm: true,
    })
  },

  closeDeleteConfirm() {
    this.setData({
      showDeleteConfirm: false,
    })
  },

  executeDeleteGear() {
    const gearId = this.data.editingGearId as string
    const deleteResult = softDeleteGear(gearId)

    if (!deleteResult.ok) {
      wx.showToast({
        title: deleteResult.message,
        icon: 'none',
      })
      return
    }

    wx.showToast({
      title: '已删除',
      icon: 'success',
    })

    wx.hideKeyboard()

    const state = getPageState(this)
    state.showEditModal = false
    state.editingGearId = ''
    state.editForm = defaultForm()
    state.editErrors = defaultErrors()
    state.editLimits = defaultGearFormInputLimits()
    state.showEditErrors = false
    state.showDeleteConfirm = false

    this.setData(buildPageData(state))
  },

  openSmartPackModal() {
    const state = getPageState(this)
    state.showSmartPackModal = true

    this.setData(buildPageData(state))
  },

  closeSmartPackModal() {
    const state = getPageState(this)
    state.showSmartPackModal = false

    this.setData(buildPageData(state))
  },

  goPackingWorkbench() {
    const state = getPageState(this)
    state.showSmartPackModal = false

    this.setData(buildPageData(state))

    const planId = state.selectedPlanId
    const hasPlans = getPlanList().length > 0
    const url = hasPlans && planId ? `../packing/packing?planId=${planId}` : '../packing/packing'

    this.startTransitionNavigate(url, '打开打包工作台...')
  },

  goAdd() {
    this.openCreateGearModal()
  },
})
