import {
  buildDayOptions,
  buildMonthOptions,
  buildYearOptions,
  clampDateParts,
  formatDateParts,
  getTodayParts,
  parseDateString,
  type DateParts,
} from '../../utils/datePicker'

interface PickerState {
  years: number[]
  months: number[]
  days: number[]
  pickerIndexes: number[]
  selectedParts: DateParts
}

const MIN_YEAR = 1990

const findIndex = (items: number[], target: number): number => {
  const index = items.indexOf(target)
  return index >= 0 ? index : 0
}

const buildPickerState = (parts: DateParts, maxParts: DateParts): PickerState => {
  const clamped = clampDateParts(parts, maxParts)
  const years = buildYearOptions(MIN_YEAR, maxParts.year)
  const months = buildMonthOptions(clamped.year, maxParts)
  const safeMonth = months.indexOf(clamped.month) >= 0 ? clamped.month : months[months.length - 1]
  const days = buildDayOptions(clamped.year, safeMonth, maxParts)
  const safeDay = days.indexOf(clamped.day) >= 0 ? clamped.day : days[days.length - 1]
  const selectedParts: DateParts = {
    year: clamped.year,
    month: safeMonth,
    day: safeDay,
  }

  return {
    years,
    months,
    days,
    pickerIndexes: [findIndex(years, selectedParts.year), findIndex(months, selectedParts.month), findIndex(days, selectedParts.day)],
    selectedParts,
  }
}

Component({
  properties: {
    value: {
      type: String,
      value: '',
    },
    placeholder: {
      type: String,
      value: '未设置',
    },
    error: {
      type: Boolean,
      value: false,
    },
    compact: {
      type: Boolean,
      value: false,
    },
    hideTrigger: {
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
    years: [] as number[],
    months: [] as number[],
    days: [] as number[],
    pickerIndexes: [0, 0, 0] as number[],
    selectedParts: getTodayParts(),
    maxParts: getTodayParts(),
  },

  observers: {
    value: function (nextValue: string) {
      this.setData({
        displayValue: nextValue || '',
      })
    },
  },

  lifetimes: {
    attached() {
      this.setData({
        maxParts: getTodayParts(),
      })
      this.syncDisplayValue()
    },
  },

  methods: {
    syncDisplayValue() {
      const value = this.properties.value as string

      this.setData({
        displayValue: value,
      })
    },

    getInitialParts(): DateParts {
      const parsed = parseDateString(this.properties.value as string)
      const maxParts = this.data.maxParts as DateParts

      if (parsed) {
        return clampDateParts(parsed, maxParts)
      }

      return { ...maxParts }
    },

    applyPickerState(parts: DateParts) {
      const maxParts = this.data.maxParts as DateParts
      const nextState = buildPickerState(parts, maxParts)

      this.setData({
        years: nextState.years,
        months: nextState.months,
        days: nextState.days,
        pickerIndexes: nextState.pickerIndexes,
        selectedParts: nextState.selectedParts,
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

      this.applyPickerState(this.getInitialParts())

      this.setData({
        open: true,
        maxParts: getTodayParts(),
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
      const maxParts = this.data.maxParts as DateParts
      const years = this.data.years as number[]
      const year = years[indexes[0]] || maxParts.year
      const months = buildMonthOptions(year, maxParts)
      const month = months[Math.min(indexes[1], months.length - 1)] || months[0]
      const days = buildDayOptions(year, month, maxParts)
      const day = days[Math.min(indexes[2], days.length - 1)] || days[0]

      this.applyPickerState({
        year,
        month,
        day,
      })
    },

    clearDate() {
      this.setData({
        open: false,
        displayValue: '',
      })

      this.triggerEvent('change', { value: '' }, { bubbles: true, composed: true })
    },

    confirmDate() {
      const selectedParts = this.data.selectedParts as DateParts
      const maxParts = getTodayParts()
      const safeParts = clampDateParts(selectedParts, maxParts)
      const nextValue = formatDateParts(safeParts)

      this.setData({
        open: false,
        displayValue: nextValue,
        maxParts,
      })

      this.triggerEvent('change', { value: nextValue }, { bubbles: true, composed: true })
    },
  },
})
