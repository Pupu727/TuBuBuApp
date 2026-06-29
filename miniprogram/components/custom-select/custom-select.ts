interface SelectOption {
  id: string
  name: string
}

Component({
  properties: {
    options: {
      type: Array,
      value: [] as SelectOption[],
    },
    value: {
      type: String,
      value: '',
    },
    placeholder: {
      type: String,
      value: '请选择',
    },
    error: {
      type: Boolean,
      value: false,
    },
    compact: {
      type: Boolean,
      value: false,
    },
    elevated: {
      type: Boolean,
      value: false,
    },
    embedded: {
      type: Boolean,
      value: false,
    },
  },

  data: {
    open: false,
    displayLabel: '',
  },

  observers: {
    options() {
      if (this.data.open) {
        this.closeDropdown()
      }

      this.syncDisplayLabel()
    },

    value() {
      this.syncDisplayLabel()
    },
  },

  lifetimes: {
    attached() {
      this.syncDisplayLabel()
    },
  },

  methods: {
    syncDisplayLabel() {
      const value = this.properties.value as string
      const options = this.properties.options as SelectOption[]
      const matched = options.find((item) => item.id === value)

      this.setData({
        displayLabel: matched ? matched.name : '',
      })
    },

    toggleOpen() {
      if (this.data.open) {
        this.closeDropdown()
        return
      }

      this.setData({ open: true })
    },

    closeDropdown() {
      this.setData({ open: false })
    },

    noop() {},

    onSelect(event: WechatMiniprogram.TouchEvent) {
      const nextValue = event.currentTarget.dataset.id as string
      const options = this.properties.options as SelectOption[]
      const matched = options.find((item) => item.id === nextValue)

      this.setData({
        open: false,
        displayLabel: matched ? matched.name : '',
      })

      this.triggerEvent('change', { value: nextValue }, { bubbles: true, composed: true })
    },
  },
})
