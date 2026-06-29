import {
  MAX_PLAN_NAME_LENGTH,
  MAX_PLAN_REMARK_LENGTH,
  MAX_PLAN_ROUTE_LENGTH,
  clampTextLength,
  createPlan,
  getPlanById,
  planToFormInput,
  updatePlan,
} from '../../services/planService'
import type { PlanFormInput } from '../../services/planService'
import { resolveDayNightMaxDays } from '../../utils/tripMeta'
import {
  buildCreatePlanInput,
  defaultPlanEditForm,
  defaultPlanEditFormErrors,
  defaultPlanEditFormInputLimits,
  isPlanTextLengthExceeded,
  validatePlanEditForm,
} from '../../utils/planEditForm'
import type { PlanEditFormView } from '../../utils/planEditForm'

Component({
  data: {
    show: false,
    isCreating: false,
    editingPlanId: '',
    editForm: defaultPlanEditForm(),
    editErrors: defaultPlanEditFormErrors(),
    showEditErrors: false,
    editLimits: defaultPlanEditFormInputLimits(),
  },

  methods: {
    noop() {},

    onMaskTap() {
      this.close()
    },

    close() {
      wx.hideKeyboard()

      this.setData({
        show: false,
        isCreating: false,
        editingPlanId: '',
        editForm: defaultPlanEditForm(),
        editErrors: defaultPlanEditFormErrors(),
        showEditErrors: false,
        editLimits: defaultPlanEditFormInputLimits(),
      })
    },

    openCreate() {
      this.setData({
        show: true,
        isCreating: true,
        editingPlanId: '',
        editForm: defaultPlanEditForm(),
        editErrors: defaultPlanEditFormErrors(),
        showEditErrors: false,
        editLimits: defaultPlanEditFormInputLimits(),
      })
    },

    openEdit(planId: string) {
      const plan = planId ? getPlanById(planId) : undefined

      if (!plan) {
        wx.showToast({
          title: '方案不存在或已删除',
          icon: 'none',
        })
        return
      }

      const input = planToFormInput(plan)

      this.setData({
        show: true,
        isCreating: false,
        editingPlanId: planId,
        editForm: {
          name: input.name,
          route: input.route,
          days: input.days,
          maxTripDays: resolveDayNightMaxDays(input.days),
          remark: input.remark,
        },
        editErrors: defaultPlanEditFormErrors(),
        showEditErrors: false,
        editLimits: defaultPlanEditFormInputLimits(),
      })
    },

    onEditNameInput(event: WechatMiniprogram.Input) {
      const raw = event.detail.value
      const updates: Record<string, unknown> = {
        'editForm.name': clampTextLength(raw, MAX_PLAN_NAME_LENGTH),
        'editLimits.name': isPlanTextLengthExceeded(raw, MAX_PLAN_NAME_LENGTH),
      }

      if (this.data.showEditErrors && this.data.editErrors.name) {
        updates['editErrors.name'] = false
      }

      this.setData(updates)
    },

    onEditRouteInput(event: WechatMiniprogram.Input) {
      const raw = event.detail.value
      this.setData({
        'editForm.route': clampTextLength(raw, MAX_PLAN_ROUTE_LENGTH),
        'editLimits.route': isPlanTextLengthExceeded(raw, MAX_PLAN_ROUTE_LENGTH),
      })
    },

    onEditDaysChange(event: WechatMiniprogram.CustomEvent<{ days: number }>) {
      const days = event.detail.days

      if (!Number.isFinite(days) || days < 1) {
        return
      }

      const updates: Record<string, unknown> = {
        'editForm.days': days,
      }

      if (this.data.showEditErrors && this.data.editErrors.days) {
        updates['editErrors.days'] = false
      }

      this.setData(updates)
    },

    onEditRemarkInput(event: WechatMiniprogram.Input) {
      const raw = event.detail.value
      this.setData({
        'editForm.remark': clampTextLength(raw, MAX_PLAN_REMARK_LENGTH),
        'editLimits.remark': isPlanTextLengthExceeded(raw, MAX_PLAN_REMARK_LENGTH),
      })
    },

    save() {
      const isCreating = this.data.isCreating as boolean
      const editingPlanId = this.data.editingPlanId as string
      const editForm = this.data.editForm as PlanEditFormView
      const editErrors = validatePlanEditForm(editForm)

      if (editErrors.name || editErrors.days) {
        this.setData({
          editErrors,
          showEditErrors: true,
        })
        wx.showToast({
          title: '请填写必填项',
          icon: 'none',
        })
        return
      }

      if (isCreating) {
        const result = createPlan(buildCreatePlanInput(editForm))

        if (!result.ok) {
          wx.showToast({
            title: result.message,
            icon: 'none',
          })
          return
        }

        wx.hideKeyboard()
        this.close()

        wx.showToast({
          title: '已创建',
          icon: 'success',
        })

        this.triggerEvent('saved', {
          isCreating: true,
          planId: result.plan.id,
        })
        return
      }

      const plan = getPlanById(editingPlanId)

      if (!plan) {
        wx.showToast({
          title: '方案不存在或已删除',
          icon: 'none',
        })
        this.close()
        return
      }

      const name = editForm.name.trim()
      const days = editForm.days
      const baseInput = planToFormInput(plan)
      const input: PlanFormInput = {
        ...baseInput,
        name,
        route: editForm.route.trim(),
        days,
        remark: editForm.remark.trim(),
      }
      const result = updatePlan(editingPlanId, input)

      if (!result.ok) {
        wx.showToast({
          title: result.message,
          icon: 'none',
        })
        return
      }

      wx.hideKeyboard()
      this.close()

      wx.showToast({
        title: '已保存',
        icon: 'success',
      })

      this.triggerEvent('saved', {
        isCreating: false,
        planId: editingPlanId,
      })
    },
  },
})
