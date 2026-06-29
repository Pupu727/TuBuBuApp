# 01 Data Model And Storage

## goal

建立 V1 本地数据模型、枚举、本地存储 key、快照规则和统计口径。

## scope

- 定义 `Gear`、`TripPlan`、`PlanItem` TypeScript 类型。
- 定义装备分类、装备状态、出行类型、来源类型、携带方式、打包状态枚举。
- 定义本地存储 key 和 repository 基础读写方法。
- 定义重量、价格、数量和快照规则。

## data impact

- 内部重量统一存储为 `weight_g`，单位为 g。
- 内部价格统一存储为 `price_cent`，单位为分。
- `Gear` 至少包含：id、name、category、weight_g、price_cent、status、purchase_date、channel、remark、image_url、deleted、created_at、updated_at。
- `TripPlan` 至少包含：id、name、route、start_date、end_date、days、trip_type、weather_note、target_weight_g、remark、is_default、deleted、created_at、updated_at。
- `PlanItem` 至少包含：id、plan_id、gear_id、source_type、name_snapshot、category_snapshot、weight_g_snapshot、price_cent_snapshot、quantity、carry_type、is_consumable、packed_status、remark、deleted、created_at、updated_at。
- 本地存储 key 使用稳定前缀，例如 `tubu.gears.v1`、`tubu.tripPlans.v1`、`tubu.planItems.v1`。

## UI impact

- UI 显示 kg/元时必须由 service 格式化。
- 表单输入可用 kg/g 和 元，但保存前必须转换为 g 和分。
- 空数据时首页、装备页、方案页必须显示明确空状态。

## acceptance criteria

- 类型文件能通过 TypeScript 检查。
- repository 能读取空数据并返回空数组。
- 新增/更新/软删除接口不直接操作页面 `setData`。
- 方案装备从装备库加入时能生成独立快照。
- 装备库修改后，已存在 `PlanItem` 快照不变化。

## out of scope

- 云数据库 schema。
- 后端接口请求。
- 数据迁移脚本。
- 图表渲染。
