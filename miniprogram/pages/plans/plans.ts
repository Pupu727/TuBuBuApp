import { getPlanPageHeader, getPlanPageSections } from '../../services/dashboardService'
import { getPlanById, softDeletePlan } from '../../services/planService'
import { isCompletedTripPlan } from '../../utils/planDate'
import { syncTabBar } from '../../utils/tabBar'
import {
  clearTransitionLoading as clearTransitionLoadingState,
  startTransitionNavigate as startTransitionNavigateTo,
} from '../../utils/transitionLoading'

const buildPageData = (showSnapshotHelpModal: boolean) => {
  const sections = getPlanPageSections()

  return {
    upcomingPlans: sections.upcomingPlans,
    completedPlans: sections.completedPlans,
    upcomingCount: sections.upcomingCount,
    completedCount: sections.completedCount,
    pageHeader: getPlanPageHeader(),
    showSnapshotHelpModal,
    showCompletedPlans: false,
    showDeleteConfirm: false,
    deletingPlanId: '',
    deleteConfirmTitle: '删除方案',
    deleteConfirmContent: '删除后方案列表不再显示，方案中的装备快照也会一并移除。',
    openSwipePlanId: '',
    swipingPlanId: '',
    swipeOffsetPx: 0,
    swipeRevealPx: 0,
  }
}

Page({
  data: {
    ...buildPageData(false),
    swipeActionWidthPx: 0,
    swipeDeleteThresholdPx: 0,
    showTransitionLoading: false,
    transitionLoadingText: '',
  },

  _touchPlanId: '',
  _touchStartX: 0,
  _touchStartY: 0,
  _touchBaseOffsetPx: 0,
  _touchMoved: false,
  _lastSwipeTime: 0,
  _transitionTimer: 0,

  onLoad() {
    const windowInfo = wx.getWindowInfo()
    const rpxRatio = windowInfo.windowWidth / 750
    const horizontalPadding = rpxRatio * 48
    const columnGap = rpxRatio * 12
    const cardWidthPx = (windowInfo.windowWidth - horizontalPadding - columnGap) / 2

    this.setData({
      swipeActionWidthPx: rpxRatio * 96,
      swipeDeleteThresholdPx: cardWidthPx * 0.4,
    })
  },

  onUnload() {
    this.clearTransitionLoading()
  },

  onHide() {
    this.clearTransitionLoading()
  },

  onShow() {
    this.clearTransitionLoading()
    syncTabBar(this, 2)
    this.refreshPlans()
  },

  refreshPlans() {
    const showSnapshotHelpModal = Boolean(this.data.showSnapshotHelpModal)
    const showDeleteConfirm = Boolean(this.data.showDeleteConfirm)
    const deletingPlanId = this.data.deletingPlanId as string
    const showCompletedPlans = Boolean(this.data.showCompletedPlans)
    const deleteConfirmTitle = this.data.deleteConfirmTitle as string
    const deleteConfirmContent = this.data.deleteConfirmContent as string
    const openSwipePlanId = this.data.openSwipePlanId as string
    const swipingPlanId = this.data.swipingPlanId as string
    const swipeOffsetPx = this.data.swipeOffsetPx as number
    const swipeRevealPx = this.data.swipeRevealPx as number

    this.setData({
      ...buildPageData(showSnapshotHelpModal),
      showCompletedPlans,
      showDeleteConfirm,
      deletingPlanId,
      deleteConfirmTitle,
      deleteConfirmContent,
      openSwipePlanId,
      swipingPlanId,
      swipeOffsetPx,
      swipeRevealPx,
    })
  },

  onPlanEditSaved() {
    this.refreshPlans()
  },

  openSnapshotHelp() {
    this.setData({
      showSnapshotHelpModal: true,
    })
  },

  closeSnapshotHelp() {
    this.setData({
      showSnapshotHelpModal: false,
    })
  },

  toggleCompletedPlans() {
    const completedCount = this.data.completedCount as number

    if (!completedCount) {
      return
    }

    this.closeSwipe()

    this.setData({
      showCompletedPlans: !Boolean(this.data.showCompletedPlans),
    })
  },

  openPacking(event: WechatMiniprogram.TouchEvent) {
    const planId = event.currentTarget.dataset.id as string

    if (!planId) {
      return
    }

    if (this.data.openSwipePlanId || Date.now() - this._lastSwipeTime < 260) {
      this.closeSwipe()
      return
    }

    const plan = getPlanById(planId)
    const isCompleted = plan ? isCompletedTripPlan(plan.start_date) : false

    if (isCompleted) {
      this.startTransitionNavigate('../plan-overview/plan-overview?planId=' + planId, '生成装备总览...')
      return
    }

    this.startTransitionNavigate('../packing/packing?planId=' + planId, '打开打包工作台...')
  },

  goPacking() {
    this.startTransitionNavigate('../packing/packing', '准备打包工作台...')
  },

  openCreatePlan() {
    this.closeSwipe()
    const modal = this.selectComponent('#planEditModal')

    if (modal) {
      modal.openCreate()
    }
  },

  openEditPlanById(planId: string) {
    const plan = planId ? getPlanById(planId) : undefined

    this.closeSwipe()

    if (!plan) {
      wx.showToast({
        title: '方案不存在或已删除',
        icon: 'none',
      })
      return
    }

    const modal = this.selectComponent('#planEditModal')

    if (modal) {
      modal.openEdit(planId)
    }
  },

  openEditPlan(event: WechatMiniprogram.TouchEvent) {
    const planId = event.currentTarget.dataset.id as string
    this.openEditPlanById(planId)
  },

  confirmDeletePlan(event: WechatMiniprogram.TouchEvent) {
    const planId = event.currentTarget.dataset.id as string

    if (!planId) {
      return
    }

    this.openDeleteConfirm(planId)
  },

  openDeleteConfirm(planId: string) {
    if (!planId) {
      return
    }

    const plan = getPlanById(planId)
    const isCompleted = plan ? isCompletedTripPlan(plan.start_date) : false

    this.setData({
      showDeleteConfirm: true,
      deletingPlanId: planId,
      deleteConfirmTitle: isCompleted ? '删除出行记录' : '删除方案',
      deleteConfirmContent: isCompleted
        ? '删除后将同时移除该次出行记录及装备快照，且无法恢复。'
        : '删除后方案列表不再显示，方案中的装备快照也会一并移除。',
      openSwipePlanId: '',
      swipingPlanId: '',
      swipeOffsetPx: 0,
      swipeRevealPx: 0,
    })
  },

  closeDeleteConfirm() {
    this.setData({
      showDeleteConfirm: false,
      deletingPlanId: '',
    })
  },

  executeDeletePlan() {
    const planId = this.data.deletingPlanId as string

    if (!planId) {
      this.closeDeleteConfirm()
      return
    }

    const deleteResult = softDeletePlan(planId)

    if (!deleteResult.ok) {
      wx.showToast({
        title: deleteResult.message,
        icon: 'none',
      })
      return
    }

    const showSnapshotHelpModal = Boolean(this.data.showSnapshotHelpModal)

    this.setData({
      ...buildPageData(showSnapshotHelpModal),
      showDeleteConfirm: false,
      deletingPlanId: '',
      openSwipePlanId: '',
      swipingPlanId: '',
      swipeOffsetPx: 0,
      swipeRevealPx: 0,
    })

    wx.showToast({
      title: '已删除',
      icon: 'success',
    })
  },

  openPlanOverview(event: WechatMiniprogram.TouchEvent) {
    const planId = event.currentTarget.dataset.id as string

    if (!planId) {
      return
    }

    this.startTransitionNavigate('../plan-overview/plan-overview?planId=' + planId, '生成装备总览...')
  },

  noop() {},

  clearTransitionLoading() {
    clearTransitionLoadingState(this)
  },

  startTransitionNavigate(url: string, text: string) {
    startTransitionNavigateTo(this, url, text)
  },

  closeSwipe() {
    this.setData({
      openSwipePlanId: '',
      swipingPlanId: '',
      swipeOffsetPx: 0,
      swipeRevealPx: 0,
    })
  },

  onPlanTouchStart(event: WechatMiniprogram.TouchEvent) {
    const planId = event.currentTarget.dataset.id as string
    const touch = event.touches[0]
    const openSwipePlanId = this.data.openSwipePlanId as string
    const swipeActionWidthPx = this.data.swipeActionWidthPx as number

    if (!planId || !touch) {
      return
    }

    this._touchPlanId = planId
    this._touchStartX = touch.clientX
    this._touchStartY = touch.clientY
    this._touchBaseOffsetPx = openSwipePlanId === planId ? -swipeActionWidthPx : 0
    this._touchMoved = false

    if (openSwipePlanId && openSwipePlanId !== planId) {
      this.closeSwipe()
    }
  },

  onPlanTouchMove(event: WechatMiniprogram.TouchEvent) {
    const touch = event.touches[0]
    const planId = this._touchPlanId
    const swipeActionWidthPx = this.data.swipeActionWidthPx as number
    const swipeDeleteThresholdPx = this.data.swipeDeleteThresholdPx as number

    if (!planId || !touch || swipeActionWidthPx <= 0 || swipeDeleteThresholdPx <= 0) {
      return
    }

    const dx = touch.clientX - this._touchStartX
    const dy = touch.clientY - this._touchStartY

    if (Math.abs(dy) > Math.abs(dx) && !this._touchMoved) {
      return
    }

    if (Math.abs(dx) < 8 && !this._touchMoved) {
      return
    }

    this._touchMoved = true

    let nextOffset = this._touchBaseOffsetPx + dx

    if (nextOffset < -swipeDeleteThresholdPx) {
      nextOffset = -swipeDeleteThresholdPx
    }

    if (nextOffset > 0) {
      nextOffset = 0
    }

    this.setData({
      swipingPlanId: planId,
      swipeOffsetPx: nextOffset,
      swipeRevealPx: -nextOffset,
    })
  },

  onPlanTouchEnd() {
    const planId = this._touchPlanId
    const swipeActionWidthPx = this.data.swipeActionWidthPx as number
    const swipeDeleteThresholdPx = this.data.swipeDeleteThresholdPx as number
    const swipeOffsetPx = this.data.swipeOffsetPx as number

    if (!planId) {
      return
    }

    if (!this._touchMoved) {
      this._touchPlanId = ''
      return
    }

    this._lastSwipeTime = Date.now()

    if (swipeDeleteThresholdPx > 0 && swipeOffsetPx <= -swipeDeleteThresholdPx) {
      this.closeSwipe()
      this._touchPlanId = ''
      this._touchMoved = false
      this.openDeleteConfirm(planId)
      return
    }

    this.setData({
      openSwipePlanId: swipeOffsetPx <= -swipeActionWidthPx * 0.45 ? planId : '',
      swipingPlanId: '',
      swipeOffsetPx: 0,
      swipeRevealPx: 0,
    })

    this._touchPlanId = ''
    this._touchMoved = false
  },
})
