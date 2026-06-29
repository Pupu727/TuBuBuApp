export type EquipmentPageViewIntent = 'library'

let pendingViewIntent: EquipmentPageViewIntent | null = null

export const requestEquipmentLibraryView = (): void => {
  pendingViewIntent = 'library'
}

export const consumeEquipmentPageViewIntent = (): EquipmentPageViewIntent | null => {
  const intent = pendingViewIntent
  pendingViewIntent = null
  return intent
}
