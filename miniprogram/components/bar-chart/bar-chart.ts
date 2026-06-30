export interface BarChartItem {
  name: string
  color: string
  percent: string
  metric: string
  barPercent: number
}

Component({
  properties: {
    items: {
      type: Array,
      value: [] as BarChartItem[],
    },
    emptyText: {
      type: String,
      value: '暂无装备数据',
    },
  },

  data: {
    displayItems: [] as Array<BarChartItem & { barWidth: string }>,
  },

  observers: {
    items(items: BarChartItem[]) {
      this.setData({
        displayItems: (items || []).map((item) => ({
          ...item,
          barWidth: `${Math.max(item.barPercent || 0, item.barPercent > 0 ? 4 : 0)}%`,
        })),
      })
    },
  },

  lifetimes: {
    attached() {
      const items = this.properties.items as BarChartItem[]

      this.setData({
        displayItems: (items || []).map((item) => ({
          ...item,
          barWidth: `${Math.max(item.barPercent || 0, item.barPercent > 0 ? 4 : 0)}%`,
        })),
      })
    },
  },
})
