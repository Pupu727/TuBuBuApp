interface TabBarLike {
  setData(data: { selected: number }): void
  setSelected?: (selected: number) => void
}

interface PageWithTabBar {
  getTabBar?: () => TabBarLike | null
}

export const syncTabBar = (page: unknown, selected: number): void => {
  const currentPage = page as PageWithTabBar
  const tabBar = typeof currentPage.getTabBar === 'function' ? currentPage.getTabBar() : null

  if (!tabBar) {
    return
  }

  if (typeof tabBar.setSelected === 'function') {
    tabBar.setSelected(selected)
    return
  }

  tabBar.setData({ selected })
}
