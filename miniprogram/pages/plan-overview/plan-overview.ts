import {
  collectExpandedCategoryIds,
  expandPlanOverviewSection,
  getPlanOverview,
  mergePlanOverviewSectionExpanded,
  togglePlanOverviewSection,
} from '../../services/planOverviewService'
import type { PlanOverviewAnchorView, PlanOverviewView } from '../../services/planOverviewService'
import type { GearCategory } from '../../utils/models'
import {
  finishInitialLoading,
  markInitialLoadingStart,
  resetInitialLoading,
} from '../../utils/pageInitialLoading'
import {
  clearTransitionLoading as clearTransitionLoadingState,
  startTransitionNavigate as startTransitionNavigateTo,
} from '../../utils/transitionLoading'
import { sortPieSlicesByValueAsc } from '../../utils/pieChart'

type CategoryOverviewMode = 'weight' | 'value'

interface CategoryOverviewSwitch {
  mode: CategoryOverviewMode
  label: string
  activeClass: string
}

const emptyOverview = (): PlanOverviewView => {
  return getPlanOverview('')
}

const buildCategoryOverviewSwitches = (mode: CategoryOverviewMode): CategoryOverviewSwitch[] => {
  const items: Array<{ mode: CategoryOverviewMode; label: string }> = [
    { mode: 'weight', label: '重量' },
    { mode: 'value', label: '价值' },
  ]

  return items.map((item) => ({
    mode: item.mode,
    label: item.label,
    activeClass: item.mode === mode ? 'active' : '',
  }))
}

const buildCategoryOverviewData = (overview: PlanOverviewView, mode: CategoryOverviewMode) => {
  if (mode === 'value') {
    return {
      categoryOverviewMode: mode,
      categoryOverviewSwitches: buildCategoryOverviewSwitches(mode),
      categoryPieSlices: sortPieSlicesByValueAsc(overview.sections.map((section) => ({
        color: section.dotColor,
        label: section.name,
        percent: section.valuePercent,
        weight: section.value,
        value: section.valueCent,
      }))),
      categoryCenterValue: overview.totalValue,
      categoryCenterLabel: '总价值',
    }
  }

  return {
    categoryOverviewMode: mode,
    categoryOverviewSwitches: buildCategoryOverviewSwitches(mode),
    categoryPieSlices: overview.categoryPieSlices,
    categoryCenterValue: overview.tripWeight,
    categoryCenterLabel: '总重量',
  }
}

const buildAnchorsWithActive = (
  anchors: PlanOverviewAnchorView[],
  sections: PlanOverviewView['sections'],
): PlanOverviewAnchorView[] => {
  const expandedCategoryIds = collectExpandedCategoryIds(sections)

  return anchors.map((anchor) => ({
    ...anchor,
    active: expandedCategoryIds.indexOf(anchor.categoryId) >= 0,
  }))
}

const attachAnchorActiveState = (overview: PlanOverviewView): PlanOverviewView => {
  return {
    ...overview,
    anchors: buildAnchorsWithActive(overview.anchors, overview.sections),
  }
}

const syncSectionState = (
  page: WechatMiniprogram.Page.TrivialInstance,
  overview: PlanOverviewView,
  sections: PlanOverviewView['sections'],
) => {
  page.setData({
    'overview.sections': sections,
    'overview.anchors': buildAnchorsWithActive(overview.anchors, sections),
  })
}

Page({
  data: {
    overview: emptyOverview(),
    categoryOverviewMode: 'weight' as CategoryOverviewMode,
    categoryOverviewSwitches: buildCategoryOverviewSwitches('weight'),
    categoryPieSlices: [] as PlanOverviewView['categoryPieSlices'],
    categoryCenterValue: '--',
    categoryCenterLabel: '总重量',
    showTransitionLoading: false,
    transitionLoadingText: '',
    initialLoading: true,
    initialLoadingText: '生成装备总览...',
  },

  _transitionTimer: 0,

  onLoad(options: Record<string, string | undefined>) {
    markInitialLoadingStart(this)
    const planId = options.planId || ''
    this.applyOverview(planId)
  },

  onUnload() {
    this.clearTransitionLoading()
    resetInitialLoading(this)
  },

  onHide() {
    this.clearTransitionLoading()
    resetInitialLoading(this)
  },

  onShow() {
    const overview = this.data.overview as PlanOverviewView

    if (overview.planId) {
      this.applyOverview(overview.planId)
    }
  },

  applyOverview(planId: string) {
    const prevOverview = this.data.overview as PlanOverviewView
    const overview = getPlanOverview(planId)

    if (!planId || overview.planName === '方案不存在') {
      finishInitialLoading(this)

      wx.showToast({
        title: '方案不存在或已删除',
        icon: 'none',
      })

      setTimeout(() => {
        wx.navigateBack()
      }, 500)
      return
    }

    if (prevOverview.planId === planId && prevOverview.sections.length > 0) {
      const expandedCategoryIds = collectExpandedCategoryIds(prevOverview.sections)
      overview.sections = mergePlanOverviewSectionExpanded(
        overview.sections,
        overview.useAccordion,
        expandedCategoryIds,
      )
    }

    wx.setNavigationBarTitle({
      title: '装备总览',
    })

    this.setData({
      overview: attachAnchorActiveState(overview),
      ...buildCategoryOverviewData(overview, this.data.categoryOverviewMode as CategoryOverviewMode),
    })

    finishInitialLoading(this)
  },

  setCategoryOverviewMode(event: WechatMiniprogram.TouchEvent) {
    const mode = event.currentTarget.dataset.mode as CategoryOverviewMode
    const overview = this.data.overview as PlanOverviewView

    if (mode !== 'weight' && mode !== 'value') {
      return
    }

    this.setData(buildCategoryOverviewData(overview, mode))
  },

  toggleSection(event: WechatMiniprogram.TouchEvent) {
    const categoryId = event.currentTarget.dataset.category as GearCategory
    const overview = this.data.overview as PlanOverviewView

    if (!categoryId || !overview.useAccordion) {
      return
    }

    const sections = togglePlanOverviewSection(overview.sections, categoryId)
    const targetSection = sections.find((section) => section.id === categoryId)

    syncSectionState(this, overview, sections)

    if (targetSection && targetSection.expanded) {
      setTimeout(() => {
        wx.pageScrollTo({
          selector: `#section-${categoryId}`,
          duration: 280,
          offsetTop: -16,
        })
      }, 50)
    }
  },

  onAnchorTap(event: WechatMiniprogram.TouchEvent) {
    const anchorId = event.currentTarget.dataset.anchor as string
    const categoryId = event.currentTarget.dataset.category as GearCategory
    const overview = this.data.overview as PlanOverviewView

    if (!anchorId || !categoryId) {
      return
    }

    const sections = expandPlanOverviewSection(overview.sections, categoryId)

    syncSectionState(this, overview, sections)

    setTimeout(() => {
      wx.pageScrollTo({
        selector: `#${anchorId}`,
        duration: 280,
        offsetTop: -16,
      })
    }, 50)
  },

  clearTransitionLoading() {
    clearTransitionLoadingState(this)
  },

  startTransitionNavigate(url: string, text: string) {
    startTransitionNavigateTo(this, url, text)
  },

  goPacking() {
    const overview = this.data.overview as PlanOverviewView
    const planId = overview.planId

    if (!planId) {
      this.startTransitionNavigate('../packing/packing', '打开打包工作台...')
      return
    }

    this.startTransitionNavigate('../packing/packing?planId=' + planId, '打开打包工作台...')
  },
})
