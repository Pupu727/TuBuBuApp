Component({
  properties: {
    value: {
      type: Number,
      value: 1,
    },
    min: {
      type: Number,
      value: 1,
    },
    max: {
      type: Number,
      value: 50,
    },
  },

  data: {
    inputText: '1',
    focused: false,
    isExceeded: false,
  },

  observers: {
    'value, min, max'() {
      if (!this.data.focused) {
        this.syncInputText(this.properties.value as number)
        this.updateLimitState(this.data.inputText as string)
      }
    },
  },

  lifetimes: {
    attached() {
      this.syncInputText(this.properties.value as number)
      this.updateLimitState(this.data.inputText as string)
    },
  },

  methods: {
    clampValue(nextValue: number): number {
      const min = this.properties.min as number
      const max = this.properties.max as number
      let resolved = Math.round(nextValue)

      if (!Number.isFinite(resolved)) {
        resolved = min
      }

      if (resolved < min) {
        return min
      }

      if (resolved > max) {
        return max
      }

      return resolved
    },

    isLimitExceeded(rawValue: string): boolean {
      const raw = rawValue.trim()

      if (!raw) {
        return false
      }

      const parsed = parseInt(raw, 10)
      const min = this.properties.min as number
      const max = this.properties.max as number

      if (!Number.isFinite(parsed)) {
        return false
      }

      return parsed > max || parsed < min
    },

    updateLimitState(rawValue: string) {
      const isExceeded = this.isLimitExceeded(rawValue)

      this.setData({ isExceeded })
      this.triggerEvent('limit', { exceeded: isExceeded })
    },

    syncInputText(nextValue: number) {
      const value = this.clampValue(nextValue)

      this.setData({
        inputText: String(value),
      })
    },

    emitChange(nextValue: number) {
      const value = this.clampValue(nextValue)

      this.setData({
        focused: false,
        inputText: String(value),
      })

      this.updateLimitState(String(value))

      if (value === this.properties.value) {
        return
      }

      this.triggerEvent('change', { value })
    },

    getCurrentValue(): number {
      if (this.data.focused) {
        const parsed = parseInt(this.data.inputText as string, 10)

        if (Number.isFinite(parsed)) {
          return this.clampValue(parsed)
        }
      }

      return this.properties.value as number
    },

    onMinus() {
      const value = this.getCurrentValue()
      const min = this.properties.min as number

      if (value <= min) {
        this.syncInputText(value)
        this.setData({ focused: false })
        this.updateLimitState(String(value))
        return
      }

      this.emitChange(value - 1)
    },

    onPlus() {
      const value = this.getCurrentValue()
      const max = this.properties.max as number

      if (value >= max) {
        this.syncInputText(value)
        this.setData({ focused: false })
        this.updateLimitState(String(value))
        return
      }

      this.emitChange(value + 1)
    },

    onInputFocus() {
      this.setData({
        focused: true,
      })
    },

    onInput(event: WechatMiniprogram.Input) {
      const raw = event.detail.value || ''
      const digits = raw.replace(/[^\d]/g, '')

      this.setData({
        inputText: digits,
      })

      this.updateLimitState(digits)
    },

    onInputBlur() {
      const raw = this.data.inputText as string
      const parsed = parseInt(raw, 10)
      const fallback = this.properties.value as number
      const nextValue = Number.isFinite(parsed) ? parsed : fallback

      this.setData({
        focused: false,
      })

      this.emitChange(nextValue)
    },
  },
})
