import {
  MAX_TRIP_DAYS,
  buildTripDayOptions,
  clampTripDays,
  formatDayNight,
} from '../../utils/tripMeta'

const findIndex = (items: number[], target: number): number => {
  const index = items.indexOf(target)
  return index >= 0 ? index : 0
}

Component({
  properties: {
    days: {
      type: Number,
      value: 1,
    },
    maxDays: {
      type: Number,
      value: MAX_TRIP_DAYS,
    },
    placeholder: {
      type: String,
      value: '选择几天几夜',
    },
    error: {
      type: Boolean,
      value: false,
    },
    floating: {
      type: Boolean,
      value: false,
    },
  },

  data: {
    open: false,
    displayValue: '',
    dayOptions: [] as number[],
    pickerIndexes: [0] as number[],
    selectedDays: 1,
  },

  observers: {
    days: function () {
      this.syncDisplayValue()
    },
  },

  lifetimes: {
    attached() {
      this.syncDisplayValue()
    },
  },

  methods: {
    syncDisplayValue() {
      const days = this.properties.days as number
      const maxDays = this.properties.maxDays as number
      const safeDays = clampTripDays(days, maxDays)

      this.setData({
        displayValue: formatDayNight(safeDays),
      })
    },

    applyPickerState(days: number) {
      const maxDays = this.properties.maxDays as number
      const safeDays = clampTripDays(days, maxDays)
      const dayOptions = buildTripDayOptions(maxDays)

      this.setData({
        dayOptions,
        pickerIndexes: [findIndex(dayOptions, safeDays)],
        selectedDays: safeDays,
      })
    },

    toggleOpen() {
      if (this.data.open) {
        this.closePanel()
        return
      }

      this.openPanel()
    },

    openPanel() {
      if (this.data.open) {
        return
      }

      const days = this.properties.days as number
      this.applyPickerState(days)

      this.setData({
        open: true,
      })
    },

    closePanel() {
      this.setData({
        open: false,
      })
    },

    noop() {},

    onPickerChange(event: WechatMiniprogram.PickerViewChange) {
      const indexes = event.detail.value as number[]
      const dayOptions = this.data.dayOptions as number[]
      const days = dayOptions[indexes[0]] || 1

      this.applyPickerState(days)
    },

    confirmSelection() {
      const selectedDays = this.data.selectedDays as number
      const maxDays = this.properties.maxDays as number
      const safeDays = clampTripDays(selectedDays, maxDays)

      this.setData({
        open: false,
        displayValue: formatDayNight(safeDays),
      })

      this.triggerEvent('change', {
        days: safeDays,
      }, { bubbles: true, composed: true })
    },
  },
})
