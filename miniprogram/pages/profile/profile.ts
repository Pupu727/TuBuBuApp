import { getDashboardSummary, getPlanList } from '../../services/dashboardService'
import { syncTabBar } from '../../utils/tabBar'
import {
  clearTransitionLoading as clearTransitionLoadingState,
  startTransitionNavigate as startTransitionNavigateTo,
  startTransitionSwitchTab as startTransitionSwitchTabTo,
} from '../../utils/transitionLoading'

const buildPageData = () => {
  const summary = getDashboardSummary()
  const plans = getPlanList()

  return {
    gearCount: summary.gearCount,
    planCount: plans.length,
    totalGearWeight: summary.totalGearWeight,
    defaultPlanName: summary.defaultPlanName,
    defaultPlanWeight: summary.defaultPlanWeight,
    storageMode: '本地存储',
    syncStatus: '未连接云开发或后端',
    versionLabel: 'TuBu MVP 1.0',
  }
}

Page({
  data: {
    ...buildPageData(),
    showTransitionLoading: false,
    transitionLoadingText: '',
  },

  _transitionTimer: 0,

  onShow() {
    this.clearTransitionLoading()
    syncTabBar(this, 3)
    this.setData(buildPageData())
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

  startTransitionNavigate(url: string, text: string) {
    startTransitionNavigateTo(this, url, text)
  },

  startTransitionSwitchTab(url: string, text: string) {
    startTransitionSwitchTabTo(this, url, text)
  },

  goEquipment() {
    this.startTransitionSwitchTab('/pages/equipment/equipment', '打开装备库...')
  },

  goPlans() {
    this.startTransitionSwitchTab('/pages/plans/plans', '打开出行方案...')
  },

  goPacking() {
    this.startTransitionNavigate('../packing/packing', '打开打包工作台...')
  },

  goAddGear() {
    this.startTransitionNavigate('../add/add', '打开新增装备...')
  },
})
