export interface PieSliceInput {
  color: string
  label: string
  percent: string
  weight: string
  value: number
}

export interface PieSliceGeometry {
  startAngle: number
  endAngle: number
  midAngle: number
  color: string
  label: string
  percent: string
  weight: string
  value: number
}

export interface DonutLayout {
  cx: number
  cy: number
  innerRadius: number
  outerRadius: number
  midRadius: number
  ringWidth: number
}

export interface PieCanvasContext {
  fillStyle: string
  strokeStyle: string
  lineWidth: number
  lineCap: string
  lineJoin: string
  shadowColor: string
  shadowBlur: number
  shadowOffsetX: number
  shadowOffsetY: number
  save(): void
  restore(): void
  beginPath(): void
  closePath(): void
  moveTo(x: number, y: number): void
  lineTo(x: number, y: number): void
  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number, anticlockwise?: boolean): void
  ellipse(x: number, y: number, radiusX: number, radiusY: number, rotation: number, startAngle: number, endAngle: number): void
  fill(): void
  stroke(): void
  scale(x: number, y: number): void
  clearRect(x: number, y: number, width: number, height: number): void
}

const START_ANGLE = -Math.PI / 2
const FULL_CIRCLE_RAD = Math.PI * 2
const MIN_VISUAL_SLICE_DEG = 2
const MIN_VISUAL_SLICE_RAD = (FULL_CIRCLE_RAD * MIN_VISUAL_SLICE_DEG) / 360
const MIN_DRAWABLE_SLICE_RAD = 0.004

const resolveSliceSpan = (startAngle: number, endAngle: number): number => {
  return endAngle < startAngle ? startAngle - endAngle : endAngle - startAngle
}

const isSliceCounterClockwise = (startAngle: number, endAngle: number): boolean => {
  return endAngle < startAngle
}

const SELECTED_EDGE_COLOR = '#4c535b'
const SELECTED_UNDERLAY_COLOR = '#353b43'
const SELECTED_SHADOW_COLOR = 'rgba(17, 19, 24, 0.1)'

export const sortPieSlicesByValueAsc = (slices: PieSliceInput[]): PieSliceInput[] => {
  return slices.slice().sort((left, right) => {
    if (left.value !== right.value) {
      return left.value - right.value
    }

    return left.label.localeCompare(right.label, 'zh-CN')
  })
}

export const buildSliceGeometries = (slices: PieSliceInput[]): PieSliceGeometry[] => {
  const sortedSlices = sortPieSlicesByValueAsc(slices)
  const total = sortedSlices.reduce((sum, slice) => sum + slice.value, 0)

  if (total <= 0) {
    return []
  }

  const displayAngles = buildDisplayAngles(sortedSlices, total)
  let startAngle = START_ANGLE
  const geometries: PieSliceGeometry[] = []

  sortedSlices.forEach((slice, index) => {
    const sliceAngle = displayAngles[index]

    if (sliceAngle <= 0) {
      return
    }

    const endAngle = startAngle - sliceAngle
    const midAngle = startAngle - sliceAngle / 2

    geometries.push({
      startAngle,
      endAngle,
      midAngle,
      color: slice.color,
      label: slice.label,
      percent: slice.percent,
      weight: slice.weight,
      value: slice.value,
    })

    startAngle = endAngle
  })

  return geometries
}

const buildDisplayAngles = (slices: PieSliceInput[], total: number): number[] => {
  const rawAngles = slices.map((slice) => (
    slice.value > 0 ? (slice.value / total) * FULL_CIRCLE_RAD : 0
  ))
  const activeCount = rawAngles.filter((angle) => angle > 0).length

  if (activeCount <= 1) {
    return rawAngles
  }

  const minTotal = activeCount * MIN_VISUAL_SLICE_RAD

  if (minTotal >= FULL_CIRCLE_RAD) {
    const equalAngle = FULL_CIRCLE_RAD / activeCount

    return rawAngles.map((angle) => (angle > 0 ? equalAngle : 0))
  }

  const bumped = rawAngles.map((angle) => {
    if (angle <= 0) {
      return 0
    }

    return Math.max(angle, MIN_VISUAL_SLICE_RAD)
  })
  const bumpedSum = bumped.reduce((sum, angle) => sum + angle, 0)
  const scale = FULL_CIRCLE_RAD / bumpedSum

  return bumped.map((angle) => angle * scale)
}

export const resolveDonutLayout = (width: number, height: number): DonutLayout => {
  const side = Math.min(width, height)
  const outerRadius = side / 2 - 10
  const innerRadius = outerRadius * 0.58
  const ringWidth = outerRadius - innerRadius
  const midRadius = innerRadius + ringWidth / 2

  return {
    cx: width / 2,
    cy: height / 2,
    innerRadius,
    outerRadius,
    midRadius,
    ringWidth,
  }
}

export const drawDonutBaseShadow = (ctx: PieCanvasContext, layout: DonutLayout) => {
  ctx.save()
  ctx.fillStyle = 'rgba(17, 19, 24, 0.03)'
  ctx.beginPath()
  ctx.ellipse(
    layout.cx,
    layout.cy,
    layout.innerRadius * 0.52,
    layout.innerRadius * 0.14,
    0,
    0,
    Math.PI * 2,
  )
  ctx.fill()
  ctx.restore()
}

interface ParallelGapAngles {
  outerStart: number
  outerEnd: number
  innerStart: number
  innerEnd: number
}

const resolveParallelGapAngles = (
  startAngle: number,
  endAngle: number,
  innerRadius: number,
  outerRadius: number,
  gapPx: number,
): ParallelGapAngles | null => {
  if (gapPx <= 0) {
    return {
      outerStart: startAngle,
      outerEnd: endAngle,
      innerStart: startAngle,
      innerEnd: endAngle,
    }
  }

  const outerInset = (gapPx / 2) / outerRadius
  const innerInset = (gapPx / 2) / innerRadius
  const counterClockwise = isSliceCounterClockwise(startAngle, endAngle)

  if (counterClockwise) {
    const outerStart = startAngle - outerInset
    const outerEnd = endAngle + outerInset
    const innerStart = startAngle - innerInset
    const innerEnd = endAngle + innerInset

    if (outerEnd >= outerStart || innerEnd >= innerStart) {
      return null
    }

    return {
      outerStart,
      outerEnd,
      innerStart,
      innerEnd,
    }
  }

  const outerStart = startAngle + outerInset
  const outerEnd = endAngle - outerInset
  const innerStart = startAngle + innerInset
  const innerEnd = endAngle - innerInset

  if (outerEnd <= outerStart || innerEnd <= innerStart) {
    return null
  }

  return {
    outerStart,
    outerEnd,
    innerStart,
    innerEnd,
  }
}

const drawParallelGapSegment = (
  ctx: PieCanvasContext,
  cx: number,
  cy: number,
  innerRadius: number,
  outerRadius: number,
  startAngle: number,
  endAngle: number,
  gapPx: number,
): boolean => {
  const angles = resolveParallelGapAngles(startAngle, endAngle, innerRadius, outerRadius, gapPx)

  if (!angles) {
    return false
  }

  const innerEndX = cx + innerRadius * Math.cos(angles.innerEnd)
  const innerEndY = cy + innerRadius * Math.sin(angles.innerEnd)
  const outerStartX = cx + outerRadius * Math.cos(angles.outerStart)
  const outerStartY = cy + outerRadius * Math.sin(angles.outerStart)
  const counterClockwise = isSliceCounterClockwise(startAngle, endAngle)

  ctx.beginPath()

  if (counterClockwise) {
    ctx.arc(cx, cy, outerRadius, angles.outerStart, angles.outerEnd, true)
    ctx.lineTo(innerEndX, innerEndY)
    ctx.arc(cx, cy, innerRadius, angles.innerEnd, angles.innerStart, false)
    ctx.lineTo(outerStartX, outerStartY)
    ctx.closePath()
    return true
  }

  ctx.arc(cx, cy, outerRadius, angles.outerStart, angles.outerEnd)
  ctx.lineTo(innerEndX, innerEndY)
  ctx.arc(cx, cy, innerRadius, angles.innerEnd, angles.innerStart, true)
  ctx.lineTo(outerStartX, outerStartY)
  ctx.closePath()
  return true
}

const extendAlong = (
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  distance: number,
): { x: number; y: number } => {
  const dx = toX - fromX
  const dy = toY - fromY
  const length = Math.sqrt(dx * dx + dy * dy)

  if (length <= 0) {
    return { x: toX, y: toY }
  }

  return {
    x: toX + (dx / length) * distance,
    y: toY + (dy / length) * distance,
  }
}

const drawSegmentGapEdges = (
  ctx: PieCanvasContext,
  cx: number,
  cy: number,
  innerRadius: number,
  outerRadius: number,
  startAngle: number,
  endAngle: number,
  gapPx: number,
  extendPx: number,
): boolean => {
  const angles = resolveParallelGapAngles(startAngle, endAngle, innerRadius, outerRadius, gapPx)

  if (!angles) {
    return false
  }

  const drawEdge = (outerAngle: number, innerAngle: number) => {
    const outerX = cx + outerRadius * Math.cos(outerAngle)
    const outerY = cy + outerRadius * Math.sin(outerAngle)
    const innerX = cx + innerRadius * Math.cos(innerAngle)
    const innerY = cy + innerRadius * Math.sin(innerAngle)
    const outerPoint = extendAlong(innerX, innerY, outerX, outerY, extendPx)
    const innerPoint = extendAlong(outerX, outerY, innerX, innerY, extendPx)

    ctx.beginPath()
    ctx.moveTo(outerPoint.x, outerPoint.y)
    ctx.lineTo(innerPoint.x, innerPoint.y)
    ctx.stroke()
  }

  drawEdge(angles.outerEnd, angles.innerEnd)
  drawEdge(angles.outerStart, angles.innerStart)
  return true
}

const drawSegmentCornerCaps = (
  ctx: PieCanvasContext,
  cx: number,
  cy: number,
  innerRadius: number,
  outerRadius: number,
  startAngle: number,
  endAngle: number,
  gapPx: number,
  capRadius: number,
) => {
  const angles = resolveParallelGapAngles(startAngle, endAngle, innerRadius, outerRadius, gapPx)

  if (!angles) {
    return
  }

  const corners = [
    { radius: outerRadius, angle: angles.outerStart },
    { radius: outerRadius, angle: angles.outerEnd },
    { radius: innerRadius, angle: angles.innerStart },
    { radius: innerRadius, angle: angles.innerEnd },
  ]

  corners.forEach((corner) => {
    const x = cx + corner.radius * Math.cos(corner.angle)
    const y = cy + corner.radius * Math.sin(corner.angle)

    ctx.beginPath()
    ctx.arc(x, y, capRadius, 0, Math.PI * 2)
    ctx.fill()
  })
}

const drawFullRingPath = (
  ctx: PieCanvasContext,
  cx: number,
  cy: number,
  outerRadius: number,
  innerRadius: number,
  color: string,
) => {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(cx, cy, outerRadius, 0, Math.PI * 2)
  ctx.arc(cx, cy, innerRadius, 0, Math.PI * 2, true)
  ctx.closePath()
  ctx.fill()
}

export const drawFullDonutRing = (
  ctx: PieCanvasContext,
  layout: DonutLayout,
  color: string,
  offsetX: number,
  offsetY: number,
  withShadow: boolean,
) => {
  const cx = layout.cx + offsetX
  const cy = layout.cy + offsetY

  ctx.save()

  if (withShadow) {
    ctx.shadowColor = SELECTED_SHADOW_COLOR
    ctx.shadowBlur = 10
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 0
    drawFullRingPath(ctx, cx, cy, layout.outerRadius + 2, layout.innerRadius - 2, SELECTED_UNDERLAY_COLOR)
    ctx.shadowColor = 'transparent'
  }

  drawFullRingPath(ctx, cx, cy, layout.outerRadius, layout.innerRadius, color)
  ctx.restore()
}

export const drawDonutArcSegment = (
  ctx: PieCanvasContext,
  layout: DonutLayout,
  startAngle: number,
  endAngle: number,
  color: string,
  offsetX: number,
  offsetY: number,
  withShadow: boolean,
  gapPx: number,
) => {
  const span = resolveSliceSpan(startAngle, endAngle)

  if (span < MIN_DRAWABLE_SLICE_RAD) {
    return
  }

  const cx = layout.cx + offsetX
  const cy = layout.cy + offsetY

  ctx.save()

  if (withShadow) {
    ctx.strokeStyle = SELECTED_EDGE_COLOR
    ctx.lineWidth = 2
    ctx.lineCap = 'butt'
    ctx.shadowColor = SELECTED_SHADOW_COLOR
    ctx.shadowBlur = 8
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 0

    drawSegmentGapEdges(
      ctx,
      cx,
      cy,
      layout.innerRadius,
      layout.outerRadius,
      startAngle,
      endAngle,
      gapPx,
      2,
    )

    ctx.shadowColor = 'transparent'
    ctx.fillStyle = SELECTED_EDGE_COLOR
    drawSegmentCornerCaps(
      ctx,
      cx,
      cy,
      layout.innerRadius,
      layout.outerRadius,
      startAngle,
      endAngle,
      gapPx,
      1.5,
    )

    ctx.shadowColor = SELECTED_SHADOW_COLOR
    ctx.shadowBlur = 8
    ctx.fillStyle = SELECTED_UNDERLAY_COLOR

    if (drawParallelGapSegment(
      ctx,
      cx,
      cy,
      layout.innerRadius - 2,
      layout.outerRadius + 2,
      startAngle,
      endAngle,
      gapPx,
    )) {
      ctx.fill()
    }

    ctx.shadowColor = 'transparent'
  }

  if (!withShadow) {
    ctx.shadowColor = 'rgba(17, 19, 24, 0.04)'
    ctx.shadowBlur = 4
    ctx.shadowOffsetY = 2
  }

  ctx.fillStyle = color

  if (drawParallelGapSegment(
    ctx,
    cx,
    cy,
    layout.innerRadius,
    layout.outerRadius,
    startAngle,
    endAngle,
    gapPx,
  )) {
    ctx.fill()
  }

  if (withShadow) {
    ctx.strokeStyle = SELECTED_EDGE_COLOR
    ctx.lineWidth = 1
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'

    if (drawParallelGapSegment(
      ctx,
      cx,
      cy,
      layout.innerRadius,
      layout.outerRadius,
      startAngle,
      endAngle,
      gapPx,
    )) {
      ctx.stroke()
    }
  }

  ctx.restore()
}

export const getSegmentGapPx = (segmentCount: number): number => {
  if (segmentCount <= 1) {
    return 0
  }

  if (segmentCount === 2) {
    return 4
  }

  return 3
}

export const resolveSegmentGapPx = (spanRadians: number, segmentCount: number): number => {
  const baseGap = getSegmentGapPx(segmentCount)

  if (baseGap <= 0 || spanRadians < 0.06) {
    return 0
  }

  return baseGap
}

export const findSliceIndexAtPoint = (
  geometries: PieSliceGeometry[],
  x: number,
  y: number,
  layout: DonutLayout,
): number => {
  const dx = x - layout.cx
  const dy = y - layout.cy
  const distance = Math.sqrt(dx * dx + dy * dy)

  if (distance > layout.outerRadius || distance < layout.innerRadius) {
    return -1
  }

  let angle = Math.atan2(dy, dx)
  let offset = START_ANGLE - angle

  if (offset < 0) {
    offset += FULL_CIRCLE_RAD
  }

  if (offset >= FULL_CIRCLE_RAD) {
    offset -= FULL_CIRCLE_RAD
  }

  let cursor = 0

  for (let index = 0; index < geometries.length; index += 1) {
    const geometry = geometries[index]
    const span = resolveSliceSpan(geometry.startAngle, geometry.endAngle)
    const nextCursor = cursor + span

    if (offset >= cursor && offset < nextCursor) {
      return index
    }

    cursor = nextCursor
  }

  if (geometries.length > 0 && offset >= cursor - 0.0001) {
    return geometries.length - 1
  }

  return -1
}
