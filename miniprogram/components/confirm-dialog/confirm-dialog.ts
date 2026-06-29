Component({
  properties: {
    show: {
      type: Boolean,
      value: false,
    },
    title: {
      type: String,
      value: '确认',
    },
    content: {
      type: String,
      value: '',
    },
    confirmText: {
      type: String,
      value: '确定',
    },
    danger: {
      type: Boolean,
      value: false,
    },
  },

  methods: {
    noop() {},

    onCancel() {
      this.triggerEvent('cancel')
    },

    onConfirm() {
      this.triggerEvent('confirm')
    },
  },
})
