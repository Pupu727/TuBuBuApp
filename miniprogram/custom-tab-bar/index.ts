import { invokeTransitionSwitchTab } from '../utils/transitionLoading'

interface TabItem {
  pagePath: string
  text: string
  iconPath: string
  selectedIconPath: string
}

interface TabViewItem extends TabItem {
  activeClass: string
  currentIconPath: string
}

const tabLoadingTextMap: Record<string, string> = {
  'pages/index/index': '打开首页...',
  'pages/equipment/equipment': '打开装备库...',
  'pages/plans/plans': '打开出行方案...',
  'pages/profile/profile': '打开我的...',
}

const tabItems: TabItem[] = [
  {
    pagePath: 'pages/index/index',
    text: '首页',
    iconPath: '/assets/tabbar/home.png',
    selectedIconPath: '/assets/tabbar/home-active.png',
  },
  {
    pagePath: 'pages/equipment/equipment',
    text: '装备',
    iconPath: '/assets/tabbar/gear.png',
    selectedIconPath: '/assets/tabbar/gear-active.png',
  },
  {
    pagePath: 'pages/plans/plans',
    text: '方案',
    iconPath: '/assets/tabbar/plans.png',
    selectedIconPath: '/assets/tabbar/plans-active.png',
  },
  {
    pagePath: 'pages/profile/profile',
    text: '我的',
    iconPath: '/assets/tabbar/profile.png',
    selectedIconPath: '/assets/tabbar/profile-active.png',
  },
]

const resolveSelected = (): number => {
  const pages = getCurrentPages()
  const currentPage = pages[pages.length - 1]
  const currentRoute = currentPage ? currentPage.route : ''
  const selectedIndex = tabItems.findIndex((item) => item.pagePath === currentRoute)

  return selectedIndex >= 0 ? selectedIndex : 0
}

const buildTabItems = (selected: number): TabViewItem[] => {
  return tabItems.map((item, index) => ({
    pagePath: item.pagePath,
    text: item.text,
    iconPath: item.iconPath,
    selectedIconPath: item.selectedIconPath,
    activeClass: index === selected ? 'tab-active' : '',
    currentIconPath: index === selected ? item.selectedIconPath : item.iconPath,
  }))
}

Component({
  data: {
    selected: 0,
    list: buildTabItems(0),
  },

  lifetimes: {
    attached() {
      this.setSelected(resolveSelected())
    },
  },

  pageLifetimes: {
    show() {
      this.setSelected(resolveSelected())
    },
  },

  methods: {
    setSelected(selected: number) {
      this.setData({
        selected,
        list: buildTabItems(selected),
      })
    },

    switchTab(event: WechatMiniprogram.TouchEvent) {
      const selected = Number(event.currentTarget.dataset.index)
      const item = tabItems[selected]

      if (!item) {
        return
      }

      const currentRoute = getCurrentPages().slice(-1)[0]
        ? getCurrentPages()[getCurrentPages().length - 1].route
        : ''

      if (item.pagePath === currentRoute) {
        return
      }

      this.setSelected(selected)

      const loadingText = tabLoadingTextMap[item.pagePath] || '切换中...'
      invokeTransitionSwitchTab(`/${item.pagePath}`, loadingText)
    },
  },
})
