import { getPlanList } from '../../services/dashboardService'
import { resolveActivePlanId } from '../../services/planService'
import {
  MAX_GEAR_CHANNEL_LENGTH,
  MAX_GEAR_NAME_LENGTH,
  MAX_GEAR_REMARK_LENGTH,
  clampCalorieInputValue,
  clampTextLength,
  clampPriceInputValue,
  clampWeightInputValue,
  convertWeightDisplayValue,
  createGear,
  findGearByExactName,
  incrementGearQuantity,
  listGears,
  normalizeGearQuantity,
} from '../../services/gearService'
import {
  copyPackingToPlan,
  createPlanFromPacking,
  getCopyablePlanOptions,
  getPackingDraftItems,
  getSwitchablePlanOptions,
  hasCopyablePackingContent,
  savePackingToPlan,
} from '../../services/packingService'
import { softDeletePlan } from '../../services/planService'
import { formatWeight } from '../../services/unitService'
import {
  defaultGearFormErrors,
  defaultGearFormInputLimits,
  defaultGearFormView,
  gearFormInputFromView,
  isNumericInputExceeded,
  isTextLengthExceeded,
  validateGearFormView,
  type GearFormErrors,
  type GearFormInputLimits,
  type GearFormViewModel,
} from '../../utils/gearFormView'
import {
  GEAR_CATEGORY_COLORS,
  GEAR_CATEGORY_NAMES,
  GEAR_CATEGORY_OPTIONS,
  GEAR_CATEGORY_ORDER,
  GEAR_STATUS_NAMES,
  getStatusOptionsForCategory,
  resolveStatusForCategory,
} from '../../utils/gearMeta'
import type { Gear, GearCategory, GearStatus } from '../../utils/models'
import {
  finishInitialLoading,
  markInitialLoadingStart,
  resetInitialLoading,
} from '../../utils/pageInitialLoading'
import {
  clearTransitionLoading as clearTransitionLoadingState,
  startTransitionSwitchTab as startTransitionSwitchTabTo,
} from '../../utils/transitionLoading'

type DropTarget = 'bag' | 'nonBag'
type DragSource = 'library' | 'draft'

interface PackGear {
  id: string
  name: string
  category: GearCategory
  categoryName: string
  weight: string
  weightG: number
  priceCent: number
  status: string
  statusLabel: string
  ownedQuantity: number
  availableQuantity: number
}

interface PackCategory {
  id: GearCategory
  name: string
  count: number
  dotColor: string
  expanded: boolean
  caret: string
  gears: PackGear[]
}

interface DraftItem {
  gearId: string
  name: string
  category: GearCategory
  categoryName: string
  weightG: number
  weight: string
  calorieKcal: number
  quantity: number
  target: DropTarget
}

interface DraftSection {
  items: DraftItem[]
  count: number
  weight: string
}

interface DragState {
  active: boolean
  source: DragSource
  sourceTarget: DropTarget | ''
  gearId: string
  name: string
  x: number
  y: number
}

interface PendingDrop {
  gearId: string
  gearName: string
  target: DropTarget
  maxQuantity: number
}

interface PackingStats {
  tripQuantity: number
  tripWeight: string
  backpackWeight: string
  calorieKcal: number
}

interface DropRect {
  left: number
  right: number
  top: number
  bottom: number
}

const emptyDragState: DragState = {
  active: false,
  source: 'library',
  sourceTarget: '',
  gearId: '',
  name: '',
  x: 0,
  y: 0,
}

const emptyPendingDrop: PendingDrop = {
  gearId: '',
  gearName: '',
  target: 'bag',
  maxQuantity: 1,
}

const getCategoryColor = (category: GearCategory): string => {
  return GEAR_CATEGORY_COLORS[category] || GEAR_CATEGORY_COLORS.other
}

const getCategoryName = (category: GearCategory): string => {
  return GEAR_CATEGORY_NAMES[category] || GEAR_CATEGORY_NAMES.other
}

const getStatusLabel = (status: string): string => {
  if (status === 'using') return '使用中'
  if (status === 'idle') return '备用'
  if (status === 'wishlist') return '心愿'
  if (status === 'broken') return '损坏'
  if (status === 'borrowed') return '借出'

  return '备用'
}

const toPackGear = (gear: Gear, draftItems: DraftItem[]): PackGear => {
  const ownedQuantity = normalizeGearQuantity(gear.quantity)
  const availableQuantity = getAvailableQuantity(draftItems, gear)

  return {
    id: gear.id,
    name: gear.name,
    category: gear.category,
    categoryName: getCategoryName(gear.category),
    weight: formatWeight(gear.weight_g),
    weightG: gear.weight_g,
    priceCent: gear.price_cent,
    status: gear.status,
    statusLabel: getStatusLabel(gear.status),
    ownedQuantity,
    availableQuantity,
  }
}

const getDraftedQuantity = (draftItems: DraftItem[], gearId: string): number => {
  return draftItems
    .filter((item) => item.gearId === gearId)
    .reduce((sum, item) => sum + item.quantity, 0)
}

const getAvailableQuantity = (draftItems: DraftItem[], gear: Gear): number => {
  const owned = normalizeGearQuantity(gear.quantity)
  const drafted = getDraftedQuantity(draftItems, gear.id)

  return Math.max(owned - drafted, 0)
}

const getGearLibraryCount = (draftItems: DraftItem[]): number => {
  return listGears().reduce((sum, gear) => sum + getAvailableQuantity(draftItems, gear), 0)
}

const getAvailableGears = (draftItems: DraftItem[]): Gear[] => {
  return listGears().filter((gear) => getAvailableQuantity(draftItems, gear) > 0)
}

const compareGearByName = (left: Gear, right: Gear): number => {
  return left.name.localeCompare(right.name, 'zh-CN')
}

const buildCategories = (expandedCategoryId: string, draftItems: DraftItem[]): PackCategory[] => {
  const availableGears = getAvailableGears(draftItems).slice().sort(compareGearByName)
  const gearsByCategory: Partial<Record<GearCategory, Gear[]>> = {}

  availableGears.forEach((gear) => {
    const categoryId = gear.category
    const categoryGears = gearsByCategory[categoryId] || []

    categoryGears.push(gear)
    gearsByCategory[categoryId] = categoryGears
  })

  return GEAR_CATEGORY_ORDER.reduce<PackCategory[]>((categories, categoryId) => {
    const gears = gearsByCategory[categoryId]

    if (!gears || gears.length === 0) {
      return categories
    }

    const count = gears.reduce((sum, gear) => sum + getAvailableQuantity(draftItems, gear), 0)

    categories.push({
      id: categoryId,
      name: getCategoryName(categoryId),
      count,
      dotColor: getCategoryColor(categoryId),
      expanded: categoryId === expandedCategoryId,
      caret: categoryId === expandedCategoryId ? '⌄' : '›',
      gears: gears.map((gear) => toPackGear(gear, draftItems)),
    })

    return categories
  }, [])
}

const getActivePlanName = (planId?: string): string => {
  const plans = getPlanList()

  if (planId) {
    const selectedPlan = plans.find((plan) => plan.id === planId)
    if (selectedPlan) {
      return selectedPlan.name
    }
  }

  const activePlan = plans.find((plan) => plan.id === resolveActivePlanId()) || plans[0]

  return activePlan ? activePlan.name : '出行方案'
}

const getInitialPlanId = (planId?: string): string => {
  const plans = getPlanList()

  if (planId && plans.some((plan) => plan.id === planId)) {
    return planId
  }

  return resolveActivePlanId()
}

const resolveCopySourcePlanName = (planId: string, activePlanId: string): string => {
  const plan = getPlanList().find((item) => item.id === planId)

  if (!plan) {
    return getActivePlanName(activePlanId)
  }

  return plan.name
}

const getDraftItems = (draftItems: DraftItem[], target: DropTarget): DraftItem[] => {
  return draftItems.filter((item) => item.target === target)
}

const getDraftCount = (items: DraftItem[]): number => {
  return items.reduce((sum, item) => sum + item.quantity, 0)
}

const getDraftWeight = (items: DraftItem[]): number => {
  return items.reduce((sum, item) => sum + item.weightG * item.quantity, 0)
}

const getDraftCalorie = (items: DraftItem[]): number => {
  return items.reduce((sum, item) => {
    const calorieKcal = item.calorieKcal || 0

    if (calorieKcal <= 0) {
      return sum
    }

    return sum + calorieKcal * item.quantity
  }, 0)
}

const buildDraftSection = (draftItems: DraftItem[], target: DropTarget): DraftSection => {
  const items = getDraftItems(draftItems, target)

  return {
    items,
    count: getDraftCount(items),
    weight: formatWeight(getDraftWeight(items)),
  }
}

const buildStats = (draftItems: DraftItem[]): PackingStats => {
  const bagItems = getDraftItems(draftItems, 'bag')

  return {
    tripQuantity: getDraftCount(draftItems),
    tripWeight: formatWeight(getDraftWeight(draftItems)),
    backpackWeight: formatWeight(getDraftWeight(bagItems)),
    calorieKcal: Math.round(getDraftCalorie(draftItems)),
  }
}

const findGear = (gearId: string): Gear | undefined => {
  return listGears().find((gear) => gear.id === gearId)
}

const upsertDraftItem = (
  draftItems: DraftItem[],
  gear: Gear,
  target: DropTarget,
  addQuantity: number,
): DraftItem[] => {
  const quantityToAdd = Math.max(1, Math.round(addQuantity))
  let updated = false
  const nextItems = draftItems.map((item) => {
    if (item.gearId === gear.id && item.target === target) {
      updated = true
      const nextQuantity = item.quantity + quantityToAdd

      return {
        ...item,
        quantity: nextQuantity,
        weight: formatWeight(gear.weight_g * nextQuantity),
      }
    }

    return item
  })

  if (updated) {
    return nextItems
  }

  return [
    ...nextItems,
    {
      gearId: gear.id,
      name: gear.name,
      category: gear.category,
      categoryName: getCategoryName(gear.category),
      weightG: gear.weight_g,
      weight: formatWeight(gear.weight_g * quantityToAdd),
      calorieKcal: gear.calorie_kcal || 0,
      quantity: quantityToAdd,
      target,
    },
  ]
}

const removeDraftItem = (draftItems: DraftItem[], gearId: string, target: DropTarget): DraftItem[] => {
  return draftItems.filter((item) => item.gearId !== gearId || item.target !== target)
}

const moveDraftItem = (draftItems: DraftItem[], gearId: string, fromTarget: DropTarget, toTarget: DropTarget): DraftItem[] => {
  return draftItems.map((item) => {
    if (item.gearId === gearId && item.target === fromTarget) {
      return {
        ...item,
        target: toTarget,
      }
    }

    return item
  })
}

const pointInRect = (x: number, y: number, rect: DropRect): boolean => {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
}

const serializeDraftSnapshot = (draftItems: DraftItem[]): string => {
  const normalized = draftItems
    .map((item) => ({
      gearId: item.gearId,
      quantity: item.quantity,
      target: item.target,
    }))
    .sort((left, right) => {
      if (left.gearId !== right.gearId) {
        return left.gearId.localeCompare(right.gearId)
      }

      return left.target.localeCompare(right.target)
    })

  return JSON.stringify(normalized)
}

const isDraftDirty = (savedSnapshot: string, draftItems: DraftItem[]): boolean => {
  return savedSnapshot !== serializeDraftSnapshot(draftItems)
}

const toPackingDraftInputs = (draftItems: DraftItem[]) => {
  return draftItems.map((item) => ({
    gearId: item.gearId,
    quantity: item.quantity,
    target: item.target,
  }))
}

const buildPageData = (
  expandedCategoryId: string,
  showHelpModal: boolean,
  activePlanId: string,
  draftItems: DraftItem[],
  dragState: DragState,
) => {
  const planOptions = getCopyablePlanOptions(activePlanId)
  const activePlanOptions = getSwitchablePlanOptions(activePlanId)

  return {
    planName: getActivePlanName(activePlanId),
    activePlanId,
    planOptions,
    activePlanOptions,
    hasMultiplePlans: planOptions.length > 1,
    hasMultipleActivePlans: activePlanOptions.length > 1,
    copySourcePlanName: resolveCopySourcePlanName(activePlanId, activePlanId),
    selectedCopyFromPlanId: activePlanId,
    canDeletePlan: activePlanId.length > 0,
    showDeleteConfirm: false,
    showCopyPlanPanel: false,
    showCopyPlanConfirm: false,
    showMissingBackpackConfirm: false,
    planPanelTop: 0,
    planPanelLeft: 0,
    planPanelWidth: 0,
    showActivePlanPanel: false,
    activePlanPanelTop: 0,
    activePlanPanelLeft: 0,
    activePlanPanelWidth: 0,
    pendingCopyFromPlanId: '',
    pendingCopyFromPlanName: '',
    gearCount: getGearLibraryCount(draftItems),
    categories: buildCategories(expandedCategoryId, draftItems),
    expandedCategoryId,
    isGearEmpty: getGearLibraryCount(draftItems) === 0,
    showHelpModal,
    draftItems,
    bagSection: buildDraftSection(draftItems, 'bag'),
    nonBagSection: buildDraftSection(draftItems, 'nonBag'),
    stats: buildStats(draftItems),
    dragState,
  }
}

const applyWorkbenchData = (
  page: WechatMiniprogram.Page.TrivialInstance,
  expandedCategoryId: string,
  showHelpModal: boolean,
  activePlanId: string,
  draftItems: DraftItem[],
  dragState: DragState,
  extra?: Record<string, unknown>,
) => {
  page.setData({
    ...buildPageData(expandedCategoryId, showHelpModal, activePlanId, draftItems, dragState),
    showAddGearModal: page.data.showAddGearModal,
    addGearForm: page.data.addGearForm,
    addGearErrors: page.data.addGearErrors,
    addGearLimits: page.data.addGearLimits,
    showAddGearErrors: page.data.showAddGearErrors,
    addStatusOptions: page.data.addStatusOptions,
    categoryOptions: GEAR_CATEGORY_OPTIONS,
    showCopyPlanConfirm: page.data.showCopyPlanConfirm,
    showCopyPlanPanel: page.data.showCopyPlanPanel,
    showActivePlanPanel: page.data.showActivePlanPanel,
    activePlanPanelTop: page.data.activePlanPanelTop,
    activePlanPanelLeft: page.data.activePlanPanelLeft,
    activePlanPanelWidth: page.data.activePlanPanelWidth,
    showMissingBackpackConfirm: page.data.showMissingBackpackConfirm,
    showLeaveConfirm: page.data.showLeaveConfirm,
    pageContainerShow: page.data.pageContainerShow,
    showDeleteConfirm: page.data.showDeleteConfirm,
    showDropQuantityModal: page.data.showDropQuantityModal,
    pendingDrop: page.data.pendingDrop,
    dropQuantity: page.data.dropQuantity,
    dropQuantityExceeded: page.data.dropQuantityExceeded,
    pendingCopyFromPlanId: page.data.pendingCopyFromPlanId,
    pendingCopyFromPlanName: page.data.pendingCopyFromPlanName,
    selectedCopyFromPlanId: page.data.selectedCopyFromPlanId || activePlanId,
    copySourcePlanName: resolveCopySourcePlanName(activePlanId, activePlanId),
    ...extra,
  })
}

Page({
  data: {
    ...buildPageData('', false, '', [], emptyDragState),
    showAddGearModal: false,
    addGearForm: defaultGearFormView(),
    addGearErrors: defaultGearFormErrors(),
    addGearLimits: defaultGearFormInputLimits(),
    showAddGearErrors: false,
    categoryOptions: GEAR_CATEGORY_OPTIONS,
    addStatusOptions: getStatusOptionsForCategory('carry'),
    showDropQuantityModal: false,
    pendingDrop: emptyPendingDrop,
    dropQuantity: 1,
    dropQuantityExceeded: false,
    initialLoading: true,
    initialLoadingText: '整理打包清单...',
    showTransitionLoading: false,
    transitionLoadingText: '',
    showDuplicateGearConfirm: false,
    duplicateGearConfirmContent: '',
    duplicateGearId: '',
    pageContainerShow: true,
    showLeaveConfirm: false,
    leaveIntent: 'back' as 'back' | 'switch',
    pendingSwitchPlanId: '',
    showMissingBackpackConfirm: false,
  },

  _transitionTimer: 0,
  _savedDraftSnapshot: '',
  _skipLeaveGuard: false,

  onLoad(options: Record<string, string | undefined>) {
    markInitialLoadingStart(this)

    const planId = getInitialPlanId(options.planId)
    const draftItems = getPackingDraftItems(planId)

    this._savedDraftSnapshot = serializeDraftSnapshot(draftItems)
    this._skipLeaveGuard = false

    applyWorkbenchData(this, '', false, planId, draftItems, emptyDragState, {
      pageContainerShow: true,
      showLeaveConfirm: false,
    })
    finishInitialLoading(this)
  },

  onUnload() {
    resetInitialLoading(this)
    this.clearTransitionLoading()
  },

  onHide() {
    resetInitialLoading(this)
    this.clearTransitionLoading()
  },

  onShow() {
    const expandedCategoryId = this.data.expandedCategoryId as string
    const showHelpModal = this.data.showHelpModal as boolean
    const activePlanId = this.data.activePlanId as string
    const draftItems = this.data.draftItems as DraftItem[]
    const dragState = this.data.dragState as DragState

    applyWorkbenchData(this, expandedCategoryId, showHelpModal, activePlanId, draftItems, dragState)
  },

  clearTransitionLoading() {
    clearTransitionLoadingState(this)
  },

  startTransitionSwitchTab(url: string, text: string) {
    startTransitionSwitchTabTo(this, url, text)
  },

  toggleCategory(event: WechatMiniprogram.TouchEvent) {
    const categoryId = event.currentTarget.dataset.category as string
    const expandedCategoryId = this.data.expandedCategoryId as string
    const nextCategoryId = expandedCategoryId === categoryId ? '' : categoryId
    const activePlanId = this.data.activePlanId as string
    const draftItems = this.data.draftItems as DraftItem[]

    applyWorkbenchData(this, nextCategoryId, false, activePlanId, draftItems, emptyDragState)
  },

  startDrag(event: WechatMiniprogram.TouchEvent) {
    const gearId = event.currentTarget.dataset.id as string
    const gear = findGear(gearId)
    const touch = event.touches[0]

    if (!gear || !touch) {
      return
    }

    const expandedCategoryId = this.data.expandedCategoryId as string
    const showHelpModal = this.data.showHelpModal as boolean
    const activePlanId = this.data.activePlanId as string
    const draftItems = this.data.draftItems as DraftItem[]
    const availableQuantity = getAvailableQuantity(draftItems, gear)
    const dragState: DragState = {
      active: true,
      source: 'library',
      sourceTarget: '',
      gearId: gear.id,
      name: availableQuantity > 1 ? `${gear.name} x${availableQuantity}` : gear.name,
      x: touch.clientX,
      y: touch.clientY,
    }

    applyWorkbenchData(this, expandedCategoryId, showHelpModal, activePlanId, draftItems, dragState)
  },

  startDraftDrag(event: WechatMiniprogram.TouchEvent) {
    const gearId = event.currentTarget.dataset.id as string
    const sourceTarget = event.currentTarget.dataset.target as DropTarget
    const touch = event.touches[0]
    const draftItems = this.data.draftItems as DraftItem[]
    const draftItem = draftItems.find((item) => item.gearId === gearId && item.target === sourceTarget)

    if (!draftItem || !touch) {
      return
    }

    const dragState: DragState = {
      active: true,
      source: 'draft',
      sourceTarget,
      gearId: draftItem.gearId,
      name: draftItem.name,
      x: touch.clientX,
      y: touch.clientY,
    }

    this.setData({ dragState })
  },

  moveDrag(event: WechatMiniprogram.TouchEvent) {
    const touch = event.touches[0]
    const dragState = this.data.dragState as DragState

    if (!touch || !dragState.active) {
      return
    }

    this.setData({
      'dragState.x': touch.clientX,
      'dragState.y': touch.clientY,
    })
  },

  endDrag(event: WechatMiniprogram.TouchEvent) {
    const dragState = this.data.dragState as DragState
    const changedTouch = event.changedTouches[0]

    if (!dragState.active || !changedTouch) {
      this.resetDragState()
      return
    }

    const query = wx.createSelectorQuery().in(this)
    query.select('#libraryDrop').boundingClientRect()
    query.select('#bagDrop').boundingClientRect()
    query.select('#nonBagDrop').boundingClientRect()
    query.exec((results) => {
      const libraryRect = results[0] as DropRect
      const bagRect = results[1] as DropRect
      const nonBagRect = results[2] as DropRect
      const x = changedTouch.clientX
      const y = changedTouch.clientY

      if (libraryRect && pointInRect(x, y, libraryRect)) {
        this.dropToLibrary()
        return
      }

      if (bagRect && pointInRect(x, y, bagRect)) {
        this.dropToTarget('bag')
        return
      }

      if (nonBagRect && pointInRect(x, y, nonBagRect)) {
        this.dropToTarget('nonBag')
        return
      }

      this.resetDragState()
    })
  },

  dropToTarget(target: DropTarget) {
    const dragState = this.data.dragState as DragState

    if (dragState.source === 'draft') {
      this.moveDraggedDraftItem(target)
      return
    }

    const gear = findGear(dragState.gearId)

    if (!gear) {
      this.resetDragState()
      return
    }

    const draftItems = this.data.draftItems as DraftItem[]
    const availableQuantity = getAvailableQuantity(draftItems, gear)

    if (availableQuantity <= 0) {
      this.resetDragState()
      return
    }

    if (availableQuantity === 1) {
      this.commitLibraryDrop(target, gear.id, 1)
      return
    }

    this.setData({
      dragState: emptyDragState,
      showDropQuantityModal: true,
      pendingDrop: {
        gearId: gear.id,
        gearName: gear.name,
        target,
        maxQuantity: availableQuantity,
      },
      dropQuantity: 1,
      dropQuantityExceeded: false,
    })
  },

  commitLibraryDrop(target: DropTarget, gearId: string, quantity: number) {
    const gear = findGear(gearId)

    if (!gear) {
      this.resetDragState()
      return
    }

    const expandedCategoryId = this.data.expandedCategoryId as string
    const showHelpModal = this.data.showHelpModal as boolean
    const activePlanId = this.data.activePlanId as string
    const draftItems = this.data.draftItems as DraftItem[]
    const availableQuantity = getAvailableQuantity(draftItems, gear)

    if (availableQuantity <= 0) {
      this.resetDragState()
      return
    }

    const quantityToAdd = Math.min(Math.max(1, Math.round(quantity)), availableQuantity)
    const nextDraftItems = upsertDraftItem(draftItems, gear, target, quantityToAdd)

    applyWorkbenchData(this, expandedCategoryId, showHelpModal, activePlanId, nextDraftItems, emptyDragState)
  },

  closeDropQuantityModal() {
    this.setData({
      showDropQuantityModal: false,
      pendingDrop: emptyPendingDrop,
      dropQuantity: 1,
      dropQuantityExceeded: false,
    })
  },

  onDropQuantityChange(event: WechatMiniprogram.CustomEvent<{ value: number }>) {
    const value = event.detail.value

    if (!Number.isFinite(value)) {
      return
    }

    this.setData({
      dropQuantity: value,
      dropQuantityExceeded: false,
    })
  },

  onDropQuantityLimit(event: WechatMiniprogram.CustomEvent<{ exceeded: boolean }>) {
    this.setData({
      dropQuantityExceeded: event.detail.exceeded,
    })
  },

  confirmDropQuantity() {
    const pendingDrop = this.data.pendingDrop as PendingDrop

    if (!pendingDrop.gearId) {
      this.closeDropQuantityModal()
      return
    }

    if (this.data.dropQuantityExceeded) {
      wx.showToast({
        title: '数量超出限制',
        icon: 'none',
      })
      return
    }

    const dropQuantity = this.data.dropQuantity as number
    const target = pendingDrop.target
    const gearId = pendingDrop.gearId

    this.closeDropQuantityModal()
    this.commitLibraryDrop(target, gearId, dropQuantity)
  },

  moveDraggedDraftItem(target: DropTarget) {
    const dragState = this.data.dragState as DragState

    if (dragState.sourceTarget === target || !dragState.sourceTarget) {
      this.resetDragState()
      return
    }

    const expandedCategoryId = this.data.expandedCategoryId as string
    const showHelpModal = this.data.showHelpModal as boolean
    const activePlanId = this.data.activePlanId as string
    const draftItems = this.data.draftItems as DraftItem[]
    const nextDraftItems = moveDraftItem(draftItems, dragState.gearId, dragState.sourceTarget, target)

    applyWorkbenchData(this, expandedCategoryId, showHelpModal, activePlanId, nextDraftItems, emptyDragState)
  },

  dropToLibrary() {
    const dragState = this.data.dragState as DragState

    if (dragState.source !== 'draft' || !dragState.sourceTarget) {
      this.resetDragState()
      return
    }

    const expandedCategoryId = this.data.expandedCategoryId as string
    const showHelpModal = this.data.showHelpModal as boolean
    const activePlanId = this.data.activePlanId as string
    const draftItems = this.data.draftItems as DraftItem[]
    const nextDraftItems = removeDraftItem(draftItems, dragState.gearId, dragState.sourceTarget)

    applyWorkbenchData(this, expandedCategoryId, showHelpModal, activePlanId, nextDraftItems, emptyDragState)
  },

  removeDraftItem(event: WechatMiniprogram.TouchEvent) {
    const gearId = event.currentTarget.dataset.id as string
    const target = event.currentTarget.dataset.target as DropTarget
    const expandedCategoryId = this.data.expandedCategoryId as string
    const showHelpModal = this.data.showHelpModal as boolean
    const activePlanId = this.data.activePlanId as string
    const draftItems = this.data.draftItems as DraftItem[]
    const nextDraftItems = removeDraftItem(draftItems, gearId, target)

    applyWorkbenchData(this, expandedCategoryId, showHelpModal, activePlanId, nextDraftItems, emptyDragState)
  },

  resetWorkbench() {
    const expandedCategoryId = this.data.expandedCategoryId as string
    const activePlanId = this.data.activePlanId as string

    applyWorkbenchData(this, expandedCategoryId, false, activePlanId, [], emptyDragState)
  },

  isWorkbenchDirty(): boolean {
    const draftItems = this.data.draftItems as DraftItem[]

    return isDraftDirty(this._savedDraftSnapshot, draftItems)
  },

  syncSavedDraftSnapshot() {
    const draftItems = this.data.draftItems as DraftItem[]

    this._savedDraftSnapshot = serializeDraftSnapshot(draftItems)
  },

  applySwitchPlan(nextPlanId: string) {
    if (!nextPlanId) {
      return
    }

    const draftItems = getPackingDraftItems(nextPlanId)
    this._savedDraftSnapshot = serializeDraftSnapshot(draftItems)
    this._skipLeaveGuard = false

    applyWorkbenchData(this, '', false, nextPlanId, draftItems, emptyDragState, {
      showLeaveConfirm: false,
      leaveIntent: 'back',
      pendingSwitchPlanId: '',
      showActivePlanPanel: false,
      showCopyPlanPanel: false,
      showCopyPlanConfirm: false,
      pendingCopyFromPlanId: '',
      pendingCopyFromPlanName: '',
    })
  },

  onActivePlanTriggerTap() {
    if (!this.data.hasMultipleActivePlans) {
      return
    }

    if (this.data.showActivePlanPanel) {
      this.closeActivePlanPanel()
      return
    }

    this.closeCopyPlanPanel()

    const query = wx.createSelectorQuery().in(this)
    query.select('#activePlanTrigger').boundingClientRect()
    query.exec((results) => {
      const rect = results[0] as { left: number; bottom: number; width: number } | null
      if (!rect) {
        return
      }

      this.setData({
        showActivePlanPanel: true,
        activePlanPanelTop: rect.bottom + 4,
        activePlanPanelLeft: rect.left,
        activePlanPanelWidth: rect.width,
      })
    })
  },

  closeActivePlanPanel() {
    if (!this.data.showActivePlanPanel) {
      return
    }

    this.setData({
      showActivePlanPanel: false,
    })
  },

  selectActivePlanFromPanel(event: WechatMiniprogram.TouchEvent) {
    const nextPlanId = event.currentTarget.dataset.id as string
    const activePlanId = this.data.activePlanId as string

    this.setData({
      showActivePlanPanel: false,
    })

    if (!nextPlanId || nextPlanId === activePlanId) {
      return
    }

    if (this.isWorkbenchDirty()) {
      this.setData({
        leaveIntent: 'switch',
        pendingSwitchPlanId: nextPlanId,
        showLeaveConfirm: true,
      })
      return
    }

    this.applySwitchPlan(nextPlanId)
  },

  completePageLeave() {
    if (this._skipLeaveGuard) {
      return
    }

    this._skipLeaveGuard = true

    this.setData({
      pageContainerShow: false,
      showLeaveConfirm: false,
    })

    wx.nextTick(() => {
      wx.navigateBack()
    })
  },

  onPageBeforeLeave() {
    if (this._skipLeaveGuard) {
      return true
    }

    if (!this.isWorkbenchDirty()) {
      this.completePageLeave()
      // 由 completePageLeave 自己处理 navigateBack，取消默认离开
      return false
    }

    this.setData({
      leaveIntent: 'back',
      showLeaveConfirm: true,
    })

    // 由弹窗处理下一步，取消默认离开
    return false
  },

  closeLeaveConfirm() {
    this.setData({
      showLeaveConfirm: false,
      pendingSwitchPlanId: '',
      leaveIntent: 'back',
      pageContainerShow: true,
    })
  },

  discardLeaveChanges() {
    const intent = this.data.leaveIntent as 'back' | 'switch'
    const pendingSwitchPlanId = this.data.pendingSwitchPlanId as string

    if (intent === 'switch' && pendingSwitchPlanId) {
      this.setData({
        showLeaveConfirm: false,
      }, () => {
        this.applySwitchPlan(pendingSwitchPlanId)
      })
      return
    }

    this.completePageLeave()
  },

  saveLeaveChanges() {
    const activePlanId = this.data.activePlanId as string
    const draftItems = this.data.draftItems as DraftItem[]
    const result = savePackingToPlan(activePlanId, toPackingDraftInputs(draftItems))

    if (!result.ok) {
      wx.showToast({
        title: result.message,
        icon: 'none',
      })
      this.setData({
        showLeaveConfirm: false,
      })
      return
    }

    this.syncSavedDraftSnapshot()

    const intent = this.data.leaveIntent as 'back' | 'switch'
    const pendingSwitchPlanId = this.data.pendingSwitchPlanId as string

    if (intent === 'switch' && pendingSwitchPlanId) {
      this.setData({
        showLeaveConfirm: false,
      }, () => {
        this.applySwitchPlan(pendingSwitchPlanId)
      })

      wx.showToast({
        title: '已保存到方案',
        icon: 'success',
        duration: 650,
      })
      return
    }

    this._skipLeaveGuard = true

    this.setData({
      showLeaveConfirm: false,
      pageContainerShow: false,
    })

    wx.showToast({
      title: '已保存到方案',
      icon: 'success',
      duration: 700,
    })

    setTimeout(() => {
      wx.nextTick(() => {
        wx.navigateBack()
      })
    }, 700)
  },

  // legacy: 切换方案改为面板触发器（见 selectActivePlanFromPanel）

  resetDragState() {
    this.setData({
      dragState: emptyDragState,
    })
  },

  openHelp() {
    const expandedCategoryId = this.data.expandedCategoryId as string
    const activePlanId = this.data.activePlanId as string
    const draftItems = this.data.draftItems as DraftItem[]

    applyWorkbenchData(this, expandedCategoryId, true, activePlanId, draftItems, emptyDragState)
  },

  closeHelp() {
    const expandedCategoryId = this.data.expandedCategoryId as string
    const activePlanId = this.data.activePlanId as string
    const draftItems = this.data.draftItems as DraftItem[]

    applyWorkbenchData(this, expandedCategoryId, false, activePlanId, draftItems, emptyDragState)
  },

  noop() {},

  openDeleteConfirm() {
    const activePlanId = this.data.activePlanId as string

    if (!activePlanId) {
      wx.showToast({
        title: '当前没有可删除的方案',
        icon: 'none',
      })
      return
    }

    this.setData({
      showDeleteConfirm: true,
    })
  },

  closeDeleteConfirm() {
    this.setData({
      showDeleteConfirm: false,
    })
  },

  closeCopyPlanConfirm() {
    const activePlanId = this.data.activePlanId as string

    this.setData({
      showCopyPlanConfirm: false,
      pendingCopyFromPlanId: '',
      pendingCopyFromPlanName: '',
      selectedCopyFromPlanId: activePlanId,
      copySourcePlanName: resolveCopySourcePlanName(activePlanId, activePlanId),
    })
  },

  onCopyPlanSegmentTap() {
    if (!this.data.hasMultiplePlans) {
      return
    }

    if (this.data.showCopyPlanPanel) {
      this.closeCopyPlanPanel()
      return
    }

    wx.createSelectorQuery()
      .in(this)
      .select('#copyPlanTrigger')
      .boundingClientRect((rect) => {
        if (!rect) {
          return
        }

        this.setData({
          showCopyPlanPanel: true,
          planPanelTop: rect.bottom + 4,
          planPanelLeft: rect.left,
          planPanelWidth: rect.width,
        })
      })
      .exec()
  },

  closeCopyPlanPanel() {
    if (!this.data.showCopyPlanPanel) {
      return
    }

    this.setData({
      showCopyPlanPanel: false,
    })
  },

  selectCopyPlanFromPanel(event: WechatMiniprogram.TouchEvent) {
    const sourcePlanId = event.currentTarget.dataset.id as string
    const activePlanId = this.data.activePlanId as string

    if (!sourcePlanId || sourcePlanId === activePlanId) {
      this.setData({
        showCopyPlanPanel: false,
        selectedCopyFromPlanId: activePlanId,
        copySourcePlanName: resolveCopySourcePlanName(activePlanId, activePlanId),
      })
      return
    }

    const sourcePlan = getPlanList().find((plan) => plan.id === sourcePlanId)

    if (!sourcePlan) {
      this.setData({
        showCopyPlanPanel: false,
        selectedCopyFromPlanId: activePlanId,
        copySourcePlanName: resolveCopySourcePlanName(activePlanId, activePlanId),
      })
      return
    }

    if (!hasCopyablePackingContent(sourcePlanId)) {
      this.setData({
        showCopyPlanPanel: false,
      })
      wx.showToast({
        title: '该方案没有可复制的打包内容',
        icon: 'none',
      })
      return
    }

    this.setData({
      showCopyPlanPanel: false,
      showCopyPlanConfirm: true,
      pendingCopyFromPlanId: sourcePlan.id,
      pendingCopyFromPlanName: sourcePlan.name,
      selectedCopyFromPlanId: activePlanId,
      copySourcePlanName: resolveCopySourcePlanName(activePlanId, activePlanId),
    })
  },

  confirmCopyPlanPacking() {
    const activePlanId = this.data.activePlanId as string
    const sourcePlanId = this.data.pendingCopyFromPlanId as string
    const sourcePlanName = this.data.pendingCopyFromPlanName as string

    if (!activePlanId || !sourcePlanId || sourcePlanId === activePlanId) {
      this.closeCopyPlanConfirm()
      return
    }

    const result = copyPackingToPlan(activePlanId, sourcePlanId)

    if (!result.ok) {
      wx.showToast({
        title: result.message,
        icon: 'none',
      })
      this.closeCopyPlanConfirm()
      return
    }

    const expandedCategoryId = this.data.expandedCategoryId as string
    const showHelpModal = this.data.showHelpModal as boolean

    applyWorkbenchData(this, expandedCategoryId, showHelpModal, activePlanId, result.items, emptyDragState, {
      showCopyPlanConfirm: false,
      pendingCopyFromPlanId: '',
      pendingCopyFromPlanName: '',
      selectedCopyFromPlanId: activePlanId,
      copySourcePlanName: resolveCopySourcePlanName(activePlanId, activePlanId),
    })

    const toastTitle = result.skippedGearCount > 0
      ? `已应用${sourcePlanName}的打包方式，${result.skippedGearCount}件装备已不在装备库`
      : `已应用${sourcePlanName}的打包方式`

    wx.showToast({
      title: toastTitle,
      icon: 'success',
    })
  },

  closeMissingBackpackConfirm() {
    this.setData({
      showMissingBackpackConfirm: false,
    })
  },

  confirmMissingBackpackContinue() {
    this.setData({
      showMissingBackpackConfirm: false,
    })
    this.doConfirmPacking()
  },

  doConfirmPacking() {
    const activePlanId = this.data.activePlanId as string
    const planName = this.data.planName as string
    const draftItems = this.data.draftItems as DraftItem[]
    const result = createPlanFromPacking({
      name: planName,
      sourcePlanId: activePlanId,
      items: draftItems.map((item) => ({
        gearId: item.gearId,
        quantity: item.quantity,
        target: item.target,
      })),
    })

    if (!result.ok) {
      wx.showToast({
        title: result.message,
        icon: 'none',
      })
      return
    }

    this._skipLeaveGuard = true
    this.syncSavedDraftSnapshot()

    wx.showToast({
      title: result.mode === 'updated' ? '已更新方案' : '已生成方案',
      icon: 'success',
      duration: 800,
    })

    setTimeout(() => {
      this.startTransitionSwitchTab('/pages/plans/plans', '返回出行方案...')
    }, 800)
  },

  executeDeletePlan() {
    const activePlanId = this.data.activePlanId as string

    if (!activePlanId) {
      this.closeDeleteConfirm()
      return
    }

    const result = softDeletePlan(activePlanId)

    this.setData({
      showDeleteConfirm: false,
    })

    if (!result.ok) {
      wx.showToast({
        title: result.message,
        icon: 'none',
      })
      return
    }

    this._skipLeaveGuard = true

    wx.showToast({
      title: '已删除方案',
      icon: 'success',
      duration: 800,
    })

    setTimeout(() => {
      this.startTransitionSwitchTab('/pages/plans/plans', '返回出行方案...')
    }, 800)
  },

  confirmPacking() {
    const draftItems = this.data.draftItems as DraftItem[]
    const bagCount = getDraftCount(getDraftItems(draftItems, 'bag'))
    if (bagCount > 0) {
      const nonBagItems = getDraftItems(draftItems, 'nonBag')
      const hasBackpack = nonBagItems.some((item) => item.category === 'carry')

      if (!hasBackpack) {
        this.setData({
          showMissingBackpackConfirm: true,
        })
        return
      }
    }

    this.doConfirmPacking()
  },

  goAdd() {
    this.openAddGearModal()
  },

  openAddGearModal() {
    this.setData({
      showAddGearModal: true,
      addGearForm: defaultGearFormView(),
      addGearErrors: defaultGearFormErrors(),
      addGearLimits: defaultGearFormInputLimits(),
      showAddGearErrors: false,
      addStatusOptions: getStatusOptionsForCategory('carry'),
    })
  },

  closeAddGearModal() {
    const picker = this.selectComponent('#packingAddDatePicker') as WechatMiniprogram.Component.TrivialInstance | null

    if (picker && typeof picker.closePanel === 'function') {
      picker.closePanel()
    }

    wx.hideKeyboard()

    this.setData({
      showAddGearModal: false,
      addGearForm: defaultGearFormView(),
      addGearErrors: defaultGearFormErrors(),
      addGearLimits: defaultGearFormInputLimits(),
      showAddGearErrors: false,
      addStatusOptions: getStatusOptionsForCategory('carry'),
    })
  },

  onAddGearInputName(event: WechatMiniprogram.Input) {
    const raw = event.detail.value
    const name = clampTextLength(raw, MAX_GEAR_NAME_LENGTH)
    const updates: Record<string, unknown> = {
      'addGearForm.name': name,
      'addGearLimits.name': isTextLengthExceeded(raw, MAX_GEAR_NAME_LENGTH),
    }

    if (this.data.showAddGearErrors && (this.data.addGearErrors as GearFormErrors).name) {
      updates['addGearErrors.name'] = false
    }

    this.setData(updates)
  },

  onAddGearInputWeight(event: WechatMiniprogram.Input) {
    const form = this.data.addGearForm as GearFormViewModel
    const raw = event.detail.value
    const weightValue = clampWeightInputValue(raw, form.weightUnit)
    const updates: Record<string, unknown> = {
      'addGearForm.weightValue': weightValue,
      'addGearLimits.weight': isNumericInputExceeded(raw, weightValue),
    }

    if (this.data.showAddGearErrors && (this.data.addGearErrors as GearFormErrors).weight) {
      updates['addGearErrors.weight'] = false
    }

    this.setData(updates)
  },

  onAddGearInputPrice(event: WechatMiniprogram.Input) {
    const raw = event.detail.value
    const priceYuan = clampPriceInputValue(raw)

    this.setData({
      'addGearForm.priceYuan': priceYuan,
      'addGearLimits.price': isNumericInputExceeded(raw, priceYuan),
    })
  },

  onAddGearInputCalorie(event: WechatMiniprogram.Input) {
    const raw = event.detail.value
    const calorieKcalValue = clampCalorieInputValue(raw)
    const updates: Record<string, unknown> = {
      'addGearForm.calorieKcalValue': calorieKcalValue,
      'addGearLimits.calorie': isNumericInputExceeded(raw, calorieKcalValue),
    }

    if (this.data.showAddGearErrors && (this.data.addGearErrors as GearFormErrors).calorie) {
      updates['addGearErrors.calorie'] = false
    }

    this.setData(updates)
  },

  onAddGearInputChannel(event: WechatMiniprogram.Input) {
    const raw = event.detail.value
    const channel = clampTextLength(raw, MAX_GEAR_CHANNEL_LENGTH)

    this.setData({
      'addGearForm.channel': channel,
      'addGearLimits.channel': isTextLengthExceeded(raw, MAX_GEAR_CHANNEL_LENGTH),
    })
  },

  onAddGearInputRemark(event: WechatMiniprogram.Input) {
    const raw = event.detail.value
    const remark = clampTextLength(raw, MAX_GEAR_REMARK_LENGTH)

    this.setData({
      'addGearForm.remark': remark,
      'addGearLimits.remark': isTextLengthExceeded(raw, MAX_GEAR_REMARK_LENGTH),
    })
  },

  onAddGearCategoryChange(event: WechatMiniprogram.CustomEvent) {
    const categoryId = event.detail.value as GearCategory
    const category = GEAR_CATEGORY_OPTIONS.find((item) => item.id === categoryId)

    if (!category) {
      return
    }

    const form = this.data.addGearForm as GearFormViewModel
    const nextStatus = resolveStatusForCategory(category.id, form.status)

    this.setData({
      'addGearForm.category': category.id,
      'addGearForm.categoryLabel': category.name,
      'addGearForm.status': nextStatus,
      'addGearForm.statusLabel': GEAR_STATUS_NAMES[nextStatus],
      addStatusOptions: getStatusOptionsForCategory(category.id),
      'addGearErrors.calorie': category.id === 'supply' ? (this.data.addGearErrors as GearFormErrors).calorie : false,
      'addGearLimits.channel': false,
    })
  },

  onAddGearStatusChange(event: WechatMiniprogram.CustomEvent) {
    const statusId = event.detail.value as GearStatus
    const form = this.data.addGearForm as GearFormViewModel
    const statusOptions = getStatusOptionsForCategory(form.category)
    const status = statusOptions.find((item) => item.id === statusId)

    if (!status) {
      return
    }

    this.setData({
      'addGearForm.status': status.id,
      'addGearForm.statusLabel': status.name,
    })
  },

  onAddGearQuantityChange(event: WechatMiniprogram.CustomEvent<{ value: number }>) {
    const value = event.detail.value

    if (!Number.isFinite(value)) {
      return
    }

    this.setData({
      'addGearForm.quantity': value,
      'addGearLimits.quantity': false,
    })
  },

  onAddGearQuantityLimit(event: WechatMiniprogram.CustomEvent<{ exceeded: boolean }>) {
    this.setData({
      'addGearLimits.quantity': event.detail.exceeded,
    })
  },

  onAddGearWeightUnitTap(event: WechatMiniprogram.TouchEvent) {
    const weightUnit = event.currentTarget.dataset.unit as 'g' | 'kg'

    if (weightUnit !== 'g' && weightUnit !== 'kg') {
      return
    }

    const form = this.data.addGearForm as GearFormViewModel

    if (form.weightUnit === weightUnit) {
      return
    }

    const updates: Record<string, unknown> = {
      'addGearForm.weightUnit': weightUnit,
      'addGearForm.weightValue': convertWeightDisplayValue(form.weightValue, form.weightUnit, weightUnit),
      'addGearLimits.weight': false,
    }

    if (this.data.showAddGearErrors && (this.data.addGearErrors as GearFormErrors).weight) {
      updates['addGearErrors.weight'] = false
    }

    this.setData(updates)
  },

  onAddGearPurchaseDateChange(event: WechatMiniprogram.CustomEvent) {
    const purchase_date = (event.detail && event.detail.value) ? (event.detail.value as string) : ''

    this.setData({
      'addGearForm.purchase_date': purchase_date,
    })
  },

  openAddGearDatePicker() {
    const picker = this.selectComponent('#packingAddDatePicker') as WechatMiniprogram.Component.TrivialInstance | null

    if (picker && typeof picker.openPanel === 'function') {
      picker.openPanel()
    }
  },

  saveAddGear() {
    const form = this.data.addGearForm as GearFormViewModel
    const errors = validateGearFormView(form)

    if (errors.name || errors.weight || errors.calorie) {
      this.setData({
        addGearErrors: errors,
        showAddGearErrors: true,
      })
      wx.showToast({
        title: '请填写必填项',
        icon: 'none',
      })
      return
    }

    const addGearLimits = this.data.addGearLimits as GearFormInputLimits

    if (addGearLimits.quantity) {
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

    this.executeSaveAddGear()
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

    const expandedCategoryId = this.data.expandedCategoryId as string
    const activePlanId = this.data.activePlanId as string
    const draftItems = this.data.draftItems as DraftItem[]

    wx.hideKeyboard()

    applyWorkbenchData(this, expandedCategoryId, false, activePlanId, draftItems, emptyDragState, {
      showAddGearModal: false,
      addGearForm: defaultGearFormView(),
      addGearErrors: defaultGearFormErrors(),
      addGearLimits: defaultGearFormInputLimits(),
      showAddGearErrors: false,
      addStatusOptions: getStatusOptionsForCategory('carry'),
    })

    wx.showToast({
      title: '数量已增加',
      icon: 'success',
    })
  },

  executeSaveAddGear() {
    const form = this.data.addGearForm as GearFormViewModel
    const result = createGear(gearFormInputFromView(form))

    if (!result.ok) {
      wx.showToast({
        title: result.message,
        icon: 'none',
      })
      return
    }

    const expandedCategoryId = this.data.expandedCategoryId as string
    const activePlanId = this.data.activePlanId as string
    const draftItems = this.data.draftItems as DraftItem[]

    wx.hideKeyboard()

    applyWorkbenchData(this, expandedCategoryId, false, activePlanId, draftItems, emptyDragState, {
      showAddGearModal: false,
      addGearForm: defaultGearFormView(),
      addGearErrors: defaultGearFormErrors(),
      addGearLimits: defaultGearFormInputLimits(),
      showAddGearErrors: false,
      addStatusOptions: getStatusOptionsForCategory('carry'),
    })

    wx.showToast({
      title: '已添加装备',
      icon: 'success',
    })
  },
})
