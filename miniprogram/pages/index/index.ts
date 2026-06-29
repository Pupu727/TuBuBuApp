import {
  getHomeOverviewView,
} from '../../services/homeOverviewService'
import type {
  HomeOverviewMode,
  HomeOverviewScope,
} from '../../services/homeOverviewService'
import { getDashboardSummary } from '../../services/dashboardService'
import {
  findHomePlanCarouselIndex,
  getActiveHomePlan,
  getHomePlanCarouselItems,
  getHomePlanChecklistNote,
  rememberHomeActivePlanId,
  resolveHomeActivePlanId,
} from '../../services/homeService'
import type { HomePlanCarouselItem } from '../../services/homeService'
import { getUserBodyProfile, saveUserBodyProfile } from '../../repositories/userProfileRepository'
import { syncTabBar } from '../../utils/tabBar'
import {
  clearTransitionLoading as clearTransitionLoadingState,
  startTransitionNavigate as startTransitionNavigateTo,
  startTransitionSwitchTab as startTransitionSwitchTabTo,
} from '../../utils/transitionLoading'
import { requestEquipmentLibraryView } from '../../utils/equipmentPageIntent'

interface ComfortFormView {
  heightCm: string
  weightKg: string
}

interface ComfortFormErrors {
  heightCm: boolean
  weightKg: boolean
}

const GAUGE_START_ROTATE = -90
const GAUGE_ANIM_DELAY_MS = 60

const withGaugeAnimStart = (
  planCards: HomePlanCarouselItem[],
  activeIndex?: number,
): HomePlanCarouselItem[] => {
  return planCards.map((card, index) => {
    if (!card.comfort.gaugeVisible) {
      return card
    }

    if (activeIndex !== undefined && index !== activeIndex) {
      return card
    }

    return {
      ...card,
      comfort: {
        ...card.comfort,
        gaugeRotate: GAUGE_START_ROTATE,
        gaugeTransition: false,
      },
    }
  })
}

const withGaugeAnimEnd = (
  planCards: HomePlanCarouselItem[],
  activeIndex?: number,
): HomePlanCarouselItem[] => {
  const freshCards = getHomePlanCarouselItems()

  return freshCards.map((card, index) => {
    if (!card.comfort.gaugeVisible) {
      return card
    }

    if (activeIndex !== undefined && index !== activeIndex) {
      const existing = planCards.find((item) => item.id === card.id)
      return existing || card
    }

    return {
      ...card,
      comfort: {
        ...card.comfort,
        gaugeTransition: true,
      },
    }
  })
}

const buildPageData = (
  overviewScope: HomeOverviewScope,
  overviewMode: HomeOverviewMode,
  activePlanId: string,
) => {
  const summary = getDashboardSummary()
  const planCards = getHomePlanCarouselItems()
  const resolvedPlanId = activePlanId || resolveHomeActivePlanId()
  const activePlanIndex = findHomePlanCarouselIndex(resolvedPlanId, planCards)
  const activePlan = getActiveHomePlan(resolvedPlanId, planCards)
  const hasPlans = planCards.length > 0
  const planHasItems = activePlan ? activePlan.hasItems : false
  const overview = getHomeOverviewView(
    overviewScope,
    overviewMode,
    resolvedPlanId,
    summary.gearCount,
    hasPlans,
    planHasItems,
  )
  const planChecklistNote = getHomePlanChecklistNote(hasPlans, resolvedPlanId, planHasItems)

  if (activePlan) {
    rememberHomeActivePlanId(activePlan.id)
  }

  return {
    summary,
    overview,
    overviewScope,
    overviewMode,
    hasPlans,
    planCards,
    activePlanId: activePlan ? activePlan.id : '',
    activePlanIndex,
    activePlan,
    showPlanCarousel: planCards.length > 1,
    planChecklistNote,
    overviewPieSelectedIndex: -1,
  }
}

const buildInitialPageData = () => {
  const pageData = buildPageData('gear', 'weight', '')

  return {
    ...pageData,
    planCards: withGaugeAnimStart(pageData.planCards),
  }
}

const parsePositiveNumber = (value: string): number | null => {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }

  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null
  }

  return parsed
}

Page({
  data: {
    ...buildInitialPageData(),
    showTransitionLoading: false,
    transitionLoadingText: '',
    showComfortSettings: false,
    comfortForm: {
      heightCm: '',
      weightKg: '',
    } as ComfortFormView,
    comfortFormErrors: {
      heightCm: false,
      weightKg: false,
    } as ComfortFormErrors,
  },

  _transitionTimer: 0,
  _gaugeAnimTimer: 0,

  scheduleGaugeAnimation(callback: () => void) {
    if (this._gaugeAnimTimer) {
      clearTimeout(this._gaugeAnimTimer)
    }

    this._gaugeAnimTimer = setTimeout(() => {
      this._gaugeAnimTimer = 0
      callback()
    }, GAUGE_ANIM_DELAY_MS) as unknown as number
  },

  clearGaugeAnimation() {
    if (this._gaugeAnimTimer) {
      clearTimeout(this._gaugeAnimTimer)
      this._gaugeAnimTimer = 0
    }
  },

  applyPageDataWithGaugeAnim(
    overviewScope: HomeOverviewScope,
    overviewMode: HomeOverviewMode,
    activePlanId: string,
    animateActiveIndex?: number,
  ) {
    const pageData = buildPageData(overviewScope, overviewMode, activePlanId)
    const planCardsStart = withGaugeAnimStart(pageData.planCards, animateActiveIndex)

    this.setData({
      ...pageData,
      planCards: planCardsStart,
    })

    this.scheduleGaugeAnimation(() => {
      const latestPageData = buildPageData(overviewScope, overviewMode, activePlanId)
      const currentPlanCards = this.data.planCards as HomePlanCarouselItem[]
      const planCardsEnd = withGaugeAnimEnd(currentPlanCards, animateActiveIndex)

      this.setData({
        planCards: planCardsEnd,
        activePlanId: latestPageData.activePlanId,
        activePlanIndex: latestPageData.activePlanIndex,
        activePlan: latestPageData.activePlan,
        showPlanCarousel: latestPageData.showPlanCarousel,
        overview: latestPageData.overview,
        planChecklistNote: latestPageData.planChecklistNote,
      })
    })
  },

  refreshPageData() {
    const overviewScope = this.data.overviewScope as HomeOverviewScope
    const overviewMode = this.data.overviewMode as HomeOverviewMode
    const activePlanId = this.data.activePlanId as string

    this.applyPageDataWithGaugeAnim(overviewScope, overviewMode, activePlanId)
  },

  onShow() {
    this.clearTransitionLoading()
    syncTabBar(this, 0)
    this.refreshPageData()
  },

  onHide() {
    this.clearTransitionLoading()
  },

  onUnload() {
    this.clearTransitionLoading()
    this.clearGaugeAnimation()
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

  setOverviewScope(event: WechatMiniprogram.TouchEvent) {
    const overviewScope = event.currentTarget.dataset.scope as HomeOverviewScope

    if (overviewScope !== 'gear' && overviewScope !== 'plan') {
      return
    }

    const overviewMode = this.data.overviewMode as HomeOverviewMode
    const activePlanId = this.data.activePlanId as string
    this.setData(buildPageData(overviewScope, overviewMode, activePlanId))
  },

  cycleOverviewMode() {
    const overviewScope = this.data.overviewScope as HomeOverviewScope
    const overviewMode = this.data.overviewMode as HomeOverviewMode
    const activePlanId = this.data.activePlanId as string
    const nextMode: HomeOverviewMode = overviewMode === 'weight' ? 'value' : 'weight'

    this.setData(buildPageData(overviewScope, nextMode, activePlanId))
  },

  onOverviewPieSelect(event: WechatMiniprogram.CustomEvent<{ index: number }>) {
    const index = event.detail.index

    this.setData({
      overviewPieSelectedIndex: Number.isFinite(index) ? index : -1,
    })
  },

  onOverviewLegendTap(event: WechatMiniprogram.TouchEvent) {
    const index = Number(event.currentTarget.dataset.index)

    if (!Number.isFinite(index)) {
      return
    }

    const pie = this.selectComponent('#homeOverviewPie') as WechatMiniprogram.Component.TrivialInstance | null

    if (!pie || typeof (pie as WechatMiniprogram.IAnyObject).selectSlice !== 'function') {
      return
    }

    ;(pie as WechatMiniprogram.IAnyObject).selectSlice(index)
  },

  onPlanSwiperChange(event: WechatMiniprogram.SwiperChange) {
    const source = event.detail.source

    if (source !== 'touch' && source !== 'touch-out-of-bounds') {
      return
    }

    const current = event.detail.current
    const planCards = this.data.planCards as HomePlanCarouselItem[]
    const plan = planCards[current]

    if (!plan) {
      return
    }

    rememberHomeActivePlanId(plan.id)

    const overviewScope = this.data.overviewScope as HomeOverviewScope
    const overviewMode = this.data.overviewMode as HomeOverviewMode
    this.applyPageDataWithGaugeAnim(overviewScope, overviewMode, plan.id, current)
  },

  goGearLibrary() {
    requestEquipmentLibraryView()
    this.startTransitionSwitchTab('/pages/equipment/equipment', '打开装备库...')
  },

  goGear() {
    this.goGearLibrary()
  },

  openComfortSettings() {
    const profile = getUserBodyProfile()

    this.setData({
      showComfortSettings: true,
      comfortForm: {
        heightCm: profile.heightCm,
        weightKg: profile.weightKg,
      },
      comfortFormErrors: {
        heightCm: false,
        weightKg: false,
      },
    })
  },

  closeComfortSettings() {
    this.setData({
      showComfortSettings: false,
      comfortFormErrors: {
        heightCm: false,
        weightKg: false,
      },
    })
  },

  onComfortHeightInput(event: WechatMiniprogram.Input) {
    this.setData({
      'comfortForm.heightCm': event.detail.value,
      'comfortFormErrors.heightCm': false,
    })
  },

  onComfortWeightInput(event: WechatMiniprogram.Input) {
    this.setData({
      'comfortForm.weightKg': event.detail.value,
      'comfortFormErrors.weightKg': false,
    })
  },

  saveComfortSettings() {
    const form = this.data.comfortForm as ComfortFormView
    const height = parsePositiveNumber(form.heightCm)
    const weight = parsePositiveNumber(form.weightKg)

    if (!height || !weight) {
      this.setData({
        comfortFormErrors: {
          heightCm: !height,
          weightKg: !weight,
        },
      })
      return
    }

    saveUserBodyProfile({
      heightCm: String(height),
      weightKg: String(weight),
    })

    this.setData({
      showComfortSettings: false,
      comfortFormErrors: {
        heightCm: false,
        weightKg: false,
      },
    })

    this.refreshPageData()

    wx.showToast({
      title: '已保存体感设置',
      icon: 'success',
    })
  },

  openPlanOverview() {
    const activePlanId = this.data.activePlanId as string

    if (!activePlanId) {
      this.goPlans()
      return
    }

    this.startTransitionNavigate(
      '../plan-overview/plan-overview?planId=' + activePlanId,
      '生成装备总览...',
    )
  },

  openPlanEdit(event: WechatMiniprogram.TouchEvent) {
    const planId = event.currentTarget.dataset.id as string

    if (!planId) {
      return
    }

    rememberHomeActivePlanId(planId)

    const modal = this.selectComponent('#planEditModal')

    if (modal) {
      modal.openEdit(planId)
    }
  },

  onPlanEditSaved() {
    this.refreshPageData()
  },

  noop() {},

  onPlanChecklistTap() {
    const note = this.data.planChecklistNote as { tapAction: string }

    if (note.tapAction === 'plans') {
      this.goPlans()
      return
    }

    if (note.tapAction === 'packing') {
      this.goPacking()
      return
    }

    this.openPlanOverview()
  },

  onOverviewEmptyTap() {
    const empty = this.data.overview.empty as { ctaAction: string }

    if (empty.ctaAction === 'add') {
      this.goAdd()
      return
    }

    if (empty.ctaAction === 'plans') {
      this.goPlans()
      return
    }

    if (empty.ctaAction === 'packing') {
      this.goPacking()
      return
    }

    this.openPlanOverview()
  },

  goAdd() {
    this.startTransitionNavigate('../add/add', '打开新增装备...')
  },

  goPlans() {
    this.startTransitionSwitchTab('/pages/plans/plans', '打开出行方案...')
  },

  goPacking() {
    const activePlanId = this.data.activePlanId as string
    const url = activePlanId
      ? '../packing/packing?planId=' + activePlanId
      : '../packing/packing'

    this.startTransitionNavigate(url, '打开打包工作台...')
  },
})
