type InitialLoadingPage = WechatMiniprogram.Page.TrivialInstance & {
  data: {
    initialLoading?: boolean
  }
  _initialLoadingTimer?: number
  _initialLoadingStartedAt?: number
}

const MIN_INITIAL_MS = 100

export const markInitialLoadingStart = (page: InitialLoadingPage) => {
  page._initialLoadingStartedAt = Date.now()
}

export const clearInitialLoadingTimer = (page: InitialLoadingPage) => {
  if (page._initialLoadingTimer) {
    clearTimeout(page._initialLoadingTimer)
    page._initialLoadingTimer = 0
  }
}

export const finishInitialLoading = (page: InitialLoadingPage) => {
  const startedAt = page._initialLoadingStartedAt || Date.now()
  const elapsed = Date.now() - startedAt
  const delay = Math.max(0, MIN_INITIAL_MS - elapsed)

  clearInitialLoadingTimer(page)

  page._initialLoadingTimer = setTimeout(() => {
    page._initialLoadingTimer = 0

    if (page.data.initialLoading) {
      page.setData({
        initialLoading: false,
      })
    }
  }, delay) as unknown as number
}

export const resetInitialLoading = (page: InitialLoadingPage) => {
  clearInitialLoadingTimer(page)
  page._initialLoadingStartedAt = 0

  if (page.data.initialLoading) {
    page.setData({
      initialLoading: false,
    })
  }
}
