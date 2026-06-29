import { seedLocalDataIfNeeded } from './services/seedService'

App<IAppOption>({
  globalData: {},
  onLaunch() {
    seedLocalDataIfNeeded()
  },
})
