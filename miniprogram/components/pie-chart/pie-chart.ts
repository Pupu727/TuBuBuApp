import {
  buildSliceGeometries,
  drawDonutArcSegment,
  drawDonutBaseShadow,
  drawFullDonutRing,
  findSliceIndexAtPoint,
  resolveSegmentGapPx,
  sortPieSlicesByValueAsc,
  type PieCanvasContext,
  resolveDonutLayout,
  type PieSliceGeometry,
  type PieSliceInput,
} from '../../utils/pieChart'

const BASE_EXPLODE_DISTANCE = 2
const SELECTED_EXPLODE_DISTANCE = 5

const areSlicesEqual = (left: PieSliceInput[], right: PieSliceInput[]): boolean => {
  if (left.length !== right.length) {
    return false
  }

  for (let index = 0; index < left.length; index += 1) {
    const current = left[index]
    const next = right[index]

    if (
      current.color !== next.color
      || current.label !== next.label
      || current.percent !== next.percent
      || current.weight !== next.weight
      || current.value !== next.value
    ) {
      return false
    }
  }

  return true
}

Component({
  properties: {
    slices: {
      type: Array,
      value: [] as PieSliceInput[],
    },
    size: {
      type: Number,
      value: 240,
    },
    chartKey: {
      type: String,
      value: '',
    },
    centerValue: {
      type: String,
      value: '--',
    },
    centerLabel: {
      type: String,
      value: '总重量',
    },
    showLegend: {
      type: Boolean,
      value: true,
    },
  },

  data: {
    canvasId: '',
    imageSrc: '',
    chartImages: [] as string[],
    selectedIndex: -1,
    displaySlices: [] as PieSliceInput[],
    centerWidth: 0,
    centerValueSize: 30,
    centerLabelSize: 18,
    fading: false,
  },

  lifetimes: {
    attached() {
      const chartKey = this.properties.chartKey as string
      const suffix = chartKey || String(Date.now())
      const size = this.properties.size as number
      const sortedSlices = sortPieSlicesByValueAsc(this.properties.slices as PieSliceInput[])

      ;(this as any).cachedSlices = sortedSlices

      this.setData({
        canvasId: `pie-canvas-${suffix}`,
        displaySlices: sortedSlices,
      })

      this.updateCenterMetrics(size)

      setTimeout(() => {
        this.drawChart()
      }, 60)
    },
  },

  observers: {
    size(size: number) {
      this.updateCenterMetrics(size)
    },
    centerValue() {
      this.updateCenterMetrics(this.properties.size as number)
    },
    slices(newSlices: PieSliceInput[]) {
      const sortedSlices = sortPieSlicesByValueAsc(newSlices)
      const cachedSlices = (this as any).cachedSlices as PieSliceInput[] | undefined

      if (
        cachedSlices
        && areSlicesEqual(cachedSlices, sortedSlices)
        && this.data.imageSrc
      ) {
        return
      }

      ;(this as any).cachedSlices = sortedSlices

      this.setData({
        displaySlices: sortedSlices,
        imageSrc: '',
        chartImages: [],
        selectedIndex: -1,
        fading: true,
      })

      setTimeout(() => {
        this.drawChart()
      }, 60)
    },
  },

  methods: {
    updateCenterMetrics(size: number) {
      const chartSize = size > 0 ? size : 240
      const outerRadius = chartSize / 2 - 10
      const innerRadius = outerRadius * 0.58
      const innerDiameter = innerRadius * 2
      const centerValue = String(this.properties.centerValue || '')
      let centerValueSize = Math.round(Math.min(innerDiameter * 0.18, 28))

      if (centerValue.length >= 9) {
        centerValueSize = Math.round(centerValueSize * 0.88)
      } else if (centerValue.length >= 7) {
        centerValueSize = Math.round(centerValueSize * 0.94)
      }

      this.setData({
        centerWidth: Math.round(innerDiameter * 0.86),
        centerValueSize,
        centerLabelSize: Math.round(Math.min(innerDiameter * 0.128, 20)),
      })
    },

    getExplodeOffset(
      geometry: PieSliceGeometry,
      isSelected: boolean,
      hasSelection: boolean,
    ): { x: number; y: number } {
      if (!hasSelection) {
        return { x: 0, y: 0 }
      }

      const distance = isSelected ? SELECTED_EXPLODE_DISTANCE : BASE_EXPLODE_DISTANCE

      return {
        x: Math.cos(geometry.midAngle) * distance,
        y: Math.sin(geometry.midAngle) * distance,
      }
    },

    drawSegment(
      ctx: PieCanvasContext,
      layout: ReturnType<typeof resolveDonutLayout>,
      geometry: PieSliceGeometry,
      segmentCount: number,
      isSelected: boolean,
      isSingleSegment: boolean,
      hasSelection: boolean,
    ) {
      const span = Math.abs(geometry.endAngle - geometry.startAngle)
      const gapPx = resolveSegmentGapPx(span, segmentCount)
      const offset = this.getExplodeOffset(geometry, isSelected, hasSelection)

      if (isSingleSegment) {
        drawFullDonutRing(ctx, layout, geometry.color, offset.x, offset.y, isSelected)
        return
      }

      drawDonutArcSegment(
        ctx,
        layout,
        geometry.startAngle,
        geometry.endAngle,
        geometry.color,
        offset.x,
        offset.y,
        isSelected,
        gapPx,
      )
    },

    renderChartImage(
      canvas: WechatMiniprogram.Canvas,
      ctx: PieCanvasContext,
      width: number,
      height: number,
      dpr: number,
      geometries: PieSliceGeometry[],
      selectedIndex: number,
      done: (imageSrc: string) => void,
    ) {
      const layout = resolveDonutLayout(width, height)
      const isSingleSegment = geometries.length === 1
      const hasSelection = selectedIndex >= 0

      canvas.width = width * dpr
      canvas.height = height * dpr
      ctx.scale(dpr, dpr)
      ctx.clearRect(0, 0, width, height)

      drawDonutBaseShadow(ctx, layout)

      geometries.forEach((geometry, index) => {
        if (index === selectedIndex) {
          return
        }

        this.drawSegment(ctx, layout, geometry, geometries.length, false, isSingleSegment, hasSelection)
      })

      if (selectedIndex >= 0 && selectedIndex < geometries.length) {
        this.drawSegment(ctx, layout, geometries[selectedIndex], geometries.length, true, isSingleSegment, hasSelection)
      }

      wx.canvasToTempFilePath({
        canvas,
        x: 0,
        y: 0,
        width,
        height,
        destWidth: width * dpr,
        destHeight: height * dpr,
        fileType: 'png',
        success: (result) => {
          done(result.tempFilePath)
        },
      }, this)
    },

    drawChart() {
      const slices = this.properties.slices as PieSliceInput[]
      const canvasId = this.data.canvasId as string

      if (!canvasId || !slices || slices.length === 0) {
        return
      }

      const geometries = buildSliceGeometries(slices)

      if (geometries.length === 0) {
        return
      }

      const query = this.createSelectorQuery()
      const renderToken = Date.now()
      ;(this as any).renderToken = renderToken

      query
        .select(`#${canvasId}`)
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res || !res[0] || !res[0].node) {
            return
          }

          const canvas = res[0].node as WechatMiniprogram.Canvas
          const ctx = canvas.getContext('2d') as PieCanvasContext
          const width = res[0].width as number
          const height = res[0].height as number
          const windowInfo = wx.getWindowInfo()
          const dpr = windowInfo.pixelRatio > 0 ? windowInfo.pixelRatio : 2
          const states = [-1].concat(geometries.map((_geometry, index) => index))
          const images: string[] = []
          const renderNext = (stateIndex: number) => {
            if ((this as any).renderToken !== renderToken || stateIndex >= states.length) {
              return
            }

            this.renderChartImage(
              canvas,
              ctx,
              width,
              height,
              dpr,
              geometries,
              states[stateIndex],
              (imageSrc) => {
                images[stateIndex] = imageSrc

                if (stateIndex === 0) {
                  this.setData({
                    imageSrc,
                  })
                }

                if (stateIndex === states.length - 1) {
                  const selectedIndex = this.data.selectedIndex as number
                  const selectedImage = images[selectedIndex + 1] || images[0]

                  this.setData({
                    chartImages: images,
                    imageSrc: selectedImage,
                    fading: false,
                  })
                  return
                }

                renderNext(stateIndex + 1)
              },
            )
          }

          renderNext(0)
        })
    },

    selectSlice(index: number) {
      const slices = this.properties.slices as PieSliceInput[]
      const geometries = buildSliceGeometries(slices)
      const selectedIndex = this.data.selectedIndex as number
      const chartImages = this.data.chartImages as string[]
      const resolvedIndex = index === selectedIndex ? -1 : index

      if (resolvedIndex < 0 || resolvedIndex >= geometries.length) {
        this.setData({
          imageSrc: chartImages[0] || this.data.imageSrc,
          selectedIndex: -1,
        })
        this.triggerEvent('select', { index: -1 })
        return
      }

      const geometry = geometries[resolvedIndex]

      this.setData({
        imageSrc: chartImages[resolvedIndex + 1] || this.data.imageSrc,
        selectedIndex: resolvedIndex,
      })

      this.triggerEvent('select', {
        index: resolvedIndex,
        label: geometry.label,
        percent: geometry.percent,
        weight: geometry.weight,
        color: geometry.color,
      })
    },

    onChartTap(event: WechatMiniprogram.TouchEvent) {
      const slices = this.properties.slices as PieSliceInput[]
      const geometries = buildSliceGeometries(slices)

      if (geometries.length === 0) {
        return
      }

      const touch = event.changedTouches[0] || event.touches[0]
      const canvasId = this.data.canvasId as string
      const selectedIndex = this.data.selectedIndex as number
      const query = this.createSelectorQuery()

      if (!touch) {
        return
      }

      query
        .select(`#${canvasId}-image`)
        .fields({ size: true, rect: true })
        .exec((res) => {
          if (!res || !res[0]) {
            return
          }

          const width = res[0].width as number
          const height = res[0].height as number
          const left = res[0].left as number
          const top = res[0].top as number
          const layout = resolveDonutLayout(width, height)
          const nextIndex = findSliceIndexAtPoint(
            geometries,
            touch.clientX - left,
            touch.clientY - top,
            layout,
          )

          if (nextIndex < 0) {
            if (selectedIndex >= 0) {
              const chartImages = this.data.chartImages as string[]

              this.setData({
                imageSrc: chartImages[0] || this.data.imageSrc,
                selectedIndex: -1,
              })
              this.triggerEvent('select', { index: -1 })
            }
            return
          }

          this.selectSlice(nextIndex)
        })
    },

    onLegendTap(event: WechatMiniprogram.TouchEvent) {
      const index = Number(event.currentTarget.dataset.index)

      if (!Number.isFinite(index)) {
        return
      }

      this.selectSlice(index)
    },
  },
})
