export const gramsToKg = (weight_g: number): number => weight_g / 1000

export const kgToGrams = (weightKg: number): number => Math.round(weightKg * 1000)

export const centToYuan = (price_cent: number): number => price_cent / 100

export const yuanToCent = (priceYuan: number): number => Math.round(priceYuan * 100)

export const formatWeight = (weight_g: number): string => {
  if (weight_g >= 1000) {
    return `${gramsToKg(weight_g).toFixed(2)} kg`
  }

  return `${Math.round(weight_g)} g`
}

export const formatPrice = (price_cent: number): string => {
  return `${centToYuan(price_cent).toFixed(2)} yuan`
}
