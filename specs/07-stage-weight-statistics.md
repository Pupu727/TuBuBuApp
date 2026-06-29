# 07 Stage Weight Statistics

## goal

实现方案重量、价值、分类占比和打包比例的统一统计 service，并让相关页面使用同一口径。

## scope

- 计算总装备重量、背包内重量、穿着重量、消耗品重量、基础重量、分类重量、分类占比、总价值、已打包比例。
- 提供格式化显示方法：g/kg、分/元、百分比。
- 首页、方案列表、方案详情共用统计 service。

## data impact

- 单项重量 = `weight_g_snapshot * quantity`。
- 总装备重量 = 所有 `carry_type != left` 的条目重量。
- 背包内重量 = `carry_type = packed`。
- 穿着重量 = `carry_type = worn`。
- 消耗品重量 = `is_consumable = true` 且 `carry_type != left`。
- 基础重量 = `carry_type = packed` 且 `is_consumable = false`。
- 总价值 = `price_cent_snapshot * quantity`。
- 打包比例排除 `carry_type = left`。

## UI impact

- 统计为空时显示 `--` 或空状态，不显示 NaN。
- 小于 1000g 显示 g，大于等于 1000g 显示 kg。
- 首页装备利用率无默认方案时显示 `--`。

## acceptance criteria

- 给定：背包 1100g 背包内非消耗品、冲锋衣 450g 穿着、能量胶 40g x4 背包内消耗品、水 1000g 背包内消耗品。
- 系统计算：总重量 2710g、背包内 2260g、穿着 450g、消耗品 1160g、基础重量 1100g。
- 修改数量、携带方式、消耗品状态后统计立即更新。
- 无装备时所有统计安全显示。

## out of scope

- 图表绘制。
- 后端统计接口。
- 天气和路线建议。
