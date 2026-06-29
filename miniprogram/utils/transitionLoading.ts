const TRANSITION_DELAY_MS = 120

export type TransitionLoadingPage = WechatMiniprogram.Page.TrivialInstance & {
  data: {
    showTransitionLoading?: boolean
    transitionLoadingText?: string
  }
  _transitionTimer?: number
}

export const clearTransitionLoading = (page: TransitionLoadingPage) => {
  if (page._transitionTimer) {
    clearTimeout(page._transitionTimer)
    page._transitionTimer = 0
  }

  page.setData({
    showTransitionLoading: false,
    transitionLoadingText: '',
  })
}

export const startTransitionNavigate = (page: TransitionLoadingPage, url: string, text: string) => {
  if (page.data.showTransitionLoading) {
    return
  }

  page.setData({
    showTransitionLoading: true,
    transitionLoadingText: text,
  })

  page._transitionTimer = setTimeout(() => {
    page._transitionTimer = 0

    wx.navigateTo({
      url,
      success: () => {
        clearTransitionLoading(page)
      },
      fail: () => {
        clearTransitionLoading(page)
        wx.showToast({
          title: '页面打开失败',
          icon: 'none',
        })
      },
    })
  }, TRANSITION_DELAY_MS) as unknown as number
}

export const startTransitionSwitchTab = (page: TransitionLoadingPage, url: string, text: string) => {
  if (page.data.showTransitionLoading) {
    return
  }

  page.setData({
    showTransitionLoading: true,
    transitionLoadingText: text,
  })

  page._transitionTimer = setTimeout(() => {
    page._transitionTimer = 0

    wx.switchTab({
      url,
      success: () => {
        clearTransitionLoading(page)
      },
      fail: () => {
        clearTransitionLoading(page)
        wx.showToast({
          title: '页面打开失败',
          icon: 'none',
        })
      },
    })
  }, TRANSITION_DELAY_MS) as unknown as number
}

export const invokeTransitionSwitchTab = (url: string, text: string) => {
  const pages = getCurrentPages()
  const current = pages[pages.length - 1] as TransitionLoadingPage

  if (!current) {
    wx.switchTab({ url })
    return
  }

  startTransitionSwitchTab(current, url, text)
}
