import {
  buildDayOptions,
  buildMonthOptions,
  buildYearOptions,
  clampDateParts,
  clampDatePartsBetween,
  formatDateParts,
  getFutureLimitParts,
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

const LEGACY_MIN_YEAR = 1990

const findIndex = (items: number[], target: number): number => {
  const index = items.indexOf(target)
  return index >= 0 ? index : 0
}

const buildPickerState = (parts: DateParts, minParts: DateParts, maxParts: DateParts): PickerState => {
  const clamped = clampDatePartsBetween(parts, minParts, maxParts)
  const years = buildYearOptions(minParts.year, maxParts.year)
  const months = buildMonthOptions(clamped.year, maxParts, minParts)
  const safeMonth = months.indexOf(clamped.month) >= 0 ? clamped.month : months[months.length - 1]
  const days = buildDayOptions(clamped.year, safeMonth, maxParts, minParts)
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
    pickerIndexes: [
      findIndex(years, selectedParts.year),
      findIndex(months, selectedParts.month),
      findIndex(days, selectedParts.day),
    ],
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
    embedded: {
      type: Boolean,
      value: false,
    },
    futureOnly: {
      type: Boolean,
      value: false,
    },
    allowClear: {
      type: Boolean,
      value: true,
    },
    panelTitle: {
      type: String,
      value: '',
    },
    panelTip: {
      type: String,
      value: '',
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
    minParts: { year: LEGACY_MIN_YEAR, month: 1, day: 1 } as DateParts,
    maxParts: getTodayParts(),
    resolvedPanelTitle: '选择日期',
    resolvedPanelTip: '',
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

    resolveBounds(): { minParts: DateParts; maxParts: DateParts } {
      const futureOnly = Boolean(this.properties.futureOnly)

      if (futureOnly) {
        return {
          minParts: getTodayParts(),
          maxParts: getFutureLimitParts(),
        }
      }

      return {
        minParts: { year: LEGACY_MIN_YEAR, month: 1, day: 1 },
        maxParts: getTodayParts(),
      }
    },

    resolvePanelCopy(): { title: string; tip: string } {
      const futureOnly = Boolean(this.properties.futureOnly)
      const panelTitle = (this.properties.panelTitle as string) || ''
      const panelTip = (this.properties.panelTip as string) || ''

      if (panelTitle && panelTip) {
        return { title: panelTitle, tip: panelTip }
      }

      if (futureOnly) {
        return {
          title: panelTitle || '选择出行日期',
          tip: panelTip || '只能选择今天及以后',
        }
      }

      return {
        title: panelTitle || '选择购买日期',
        tip: panelTip || '不可超过今天',
      }
    },

    getInitialParts(minParts: DateParts, maxParts: DateParts): DateParts {
      const parsed = parseDateString(this.properties.value as string)

      if (parsed) {
        return clampDatePartsBetween(parsed, minParts, maxParts)
      }

      if (Boolean(this.properties.futureOnly)) {
        return { ...minParts }
      }

      return { ...maxParts }
    },

    applyPickerState(parts: DateParts, minParts?: DateParts, maxParts?: DateParts) {
      const resolvedMin = minParts || (this.data.minParts as DateParts)
      const resolvedMax = maxParts || (this.data.maxParts as DateParts)
      const nextState = buildPickerState(parts, resolvedMin, resolvedMax)

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

      const bounds = this.resolveBounds()
      const panelCopy = this.resolvePanelCopy()
      const initialParts = this.getInitialParts(bounds.minParts, bounds.maxParts)
      const nextState = buildPickerState(initialParts, bounds.minParts, bounds.maxParts)

      this.setData({
        open: true,
        minParts: bounds.minParts,
        maxParts: bounds.maxParts,
        resolvedPanelTitle: panelCopy.title,
        resolvedPanelTip: panelCopy.tip,
        years: nextState.years,
        months: nextState.months,
        days: nextState.days,
        pickerIndexes: nextState.pickerIndexes,
        selectedParts: nextState.selectedParts,
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
      const minParts = this.data.minParts as DateParts
      const maxParts = this.data.maxParts as DateParts
      const years = this.data.years as number[]
      const year = years[indexes[0]] || maxParts.year
      const months = buildMonthOptions(year, maxParts, minParts)
      const month = months[Math.min(indexes[1], months.length - 1)] || months[0]
      const days = buildDayOptions(year, month, maxParts, minParts)
      const day = days[Math.min(indexes[2], days.length - 1)] || days[0]

      this.applyPickerState({
        year,
        month,
        day,
      })
    },

    clearDate() {
      if (!this.properties.allowClear) {
        return
      }

      this.setData({
        open: false,
        displayValue: '',
      })

      this.triggerEvent('change', { value: '' }, { bubbles: true, composed: true })
    },

    confirmDate() {
      const selectedParts = this.data.selectedParts as DateParts
      const bounds = this.resolveBounds()
      const safeParts = clampDatePartsBetween(selectedParts, bounds.minParts, bounds.maxParts)
      const nextValue = formatDateParts(safeParts)

      this.setData({
        open: false,
        displayValue: nextValue,
        minParts: bounds.minParts,
        maxParts: bounds.maxParts,
      })

      this.triggerEvent('change', { value: nextValue }, { bubbles: true, composed: true })
    },
  },
})
