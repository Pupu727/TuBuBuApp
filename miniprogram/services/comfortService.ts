import { getUserBodyProfile } from '../repositories/userProfileRepository'
import { getPlanOverview } from './planOverviewService'

export interface ComfortView {
  score: number | null
  label: string
  level: number
  hint: string
  gaugeRotate: number
  gaugeVisible: boolean
  gaugeTransition: boolean
}

const emptyComfort = (hint: string): ComfortView => ({
  score: null,
  label: '--',
  level: 0,
  hint,
  gaugeRotate: -90,
  gaugeVisible: false,
  gaugeTransition: false,
})

const parsePositiveNumber = (raw: string): number | null => {
  const trimmed = raw.trim()

  if (!trimmed) {
    return null
  }

  const value = Number(trimmed)

  if (!Number.isFinite(value) || value <= 0) {
    return null
  }

  return value
}

const resolveBodyFactor = (bmi: number): number => {
  if (bmi < 18.5) {
    return 0.9
  }

  if (bmi < 24) {
    return 1
  }

  if (bmi < 28) {
    return 1.05
  }

  return 1
}

const resolveComfortLabel = (adjustedRatePercent: number): string => {
  if (adjustedRatePercent <= 8) {
    return '极轻松'
  }

  if (adjustedRatePercent <= 12) {
    return '舒适'
  }

  if (adjustedRatePercent <= 15) {
    return '可接受'
  }

  if (adjustedRatePercent <= 20) {
    return '偏重'
  }

  if (adjustedRatePercent <= 25) {
    return '重装'
  }

  if (adjustedRatePercent <= 30) {
    return '极限背负'
  }

  return '高风险'
}

const resolveComfortScore = (adjustedRatePercent: number): number => {
  if (adjustedRatePercent <= 8) {
    return 100
  }

  if (adjustedRatePercent <= 30) {
    return 100 - ((adjustedRatePercent - 8) / 22) * 80
  }

  return Math.max(0, 20 - (adjustedRatePercent - 30) * 2)
}

const resolveGaugeRotate = (score: number): number => {
  const clamped = Math.max(0, Math.min(100, score))
  return 90 - (clamped / 100) * 180
}

const formatRatePercent = (value: number): string => {
  return value.toFixed(1)
}

export const evaluateComfortForPlan = (planId: string): ComfortView => {
  if (!planId) {
    return emptyComfort('还没有出行方案')
  }

  const profile = getUserBodyProfile()
  const overview = getPlanOverview(planId)

  if (overview.planName === '方案不存在') {
    return emptyComfort('方案不存在或已删除')
  }

  if (!profile.heightCm || !profile.weightKg) {
    return emptyComfort('点击右上角设置身高体重')
  }

  if (overview.isEmpty) {
    return emptyComfort('方案暂无装备，先去打包')
  }

  const heightCm = parsePositiveNumber(profile.heightCm)
  const weightKg = parsePositiveNumber(profile.weightKg)

  if (!heightCm || !weightKg) {
    return emptyComfort('请填写有效的身高和体重')
  }

  const loadKg = overview.tripWeightG / 1000

  if (loadKg <= 0) {
    return emptyComfort('方案暂无有效重量')
  }

  const carryRatePercent = (loadKg / weightKg) * 100
  const heightM = heightCm / 100
  const bmi = weightKg / (heightM * heightM)
  const bodyFactor = resolveBodyFactor(bmi)
  const adjustedRatePercent = carryRatePercent / bodyFactor
  const score = Math.round(resolveComfortScore(adjustedRatePercent))
  const label = resolveComfortLabel(adjustedRatePercent)

  return {
    score,
    label,
    level: score,
    hint: `修正背负率 ${formatRatePercent(adjustedRatePercent)}% · 舒适度 ${score}`,
    gaugeRotate: resolveGaugeRotate(score),
    gaugeVisible: true,
    gaugeTransition: true,
  }
}
