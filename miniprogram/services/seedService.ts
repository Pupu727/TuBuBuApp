import { gearRepository, planItemRepository, tripPlanRepository } from '../repositories/storageRepository'
import { seedGears, seedPlanItems, seedTripPlans } from '../mock/seed'

const migrateDefaultPlanName = (): void => {
  const plans = tripPlanRepository.list()
  let changed = false
  const nextPlans = plans.map((plan) => {
    if (plan.id !== 'seed-plan-default' || plan.name !== 'Weekend overnight') {
      return plan
    }

    changed = true
    return {
      ...plan,
      name: '默认方案',
      updated_at: new Date().toISOString(),
    }
  })

  if (changed) {
    tripPlanRepository.saveAll(nextPlans)
  }
}

export const seedLocalDataIfNeeded = (): void => {
  const hasData =
    gearRepository.list().length > 0 ||
    tripPlanRepository.list().length > 0 ||
    planItemRepository.list().length > 0

  if (hasData) {
    migrateDefaultPlanName()
    return
  }

  gearRepository.saveAll(seedGears)
  tripPlanRepository.saveAll(seedTripPlans)
  planItemRepository.saveAll(seedPlanItems)
}
