# 02 Stage Foundation

## goal

清理当前展示型页面，建立符合 PRD 的原生小程序基础框架和本地数据入口。

## scope

- 配置原生 `tabBar`：首页、装备、新增、方案、我的。
- 保留或重建页面目录，使页面和 Tab 一一对应。
- 建立 `repositories/`、`services/`、`mock/` 等当前需要的目录。
- 接入 mock seed，确保首次打开有可演示的装备和方案数据。
- 清除不属于 MVP 的社区、KOL、活动和会员展示。

## data impact

- 使用 `01-data-model-and-storage.md` 中的本地存储 key。
- 首次打开时可写入最小 seed 数据。
- 不连接云开发或真实后端。

## UI impact

- 首页第一屏展示核心统计。
- 底部导航使用小程序原生 `tabBar`，不再手写固定底栏模拟 Tab。
- 新增页可以先作为入口页，后续再拆具体表单。
- 我的页只放设置和数据占位。

## acceptance criteria

- 微信开发者工具可编译通过。
- `app.json` 页面和 `tabBar` 配置完整。
- Tab 切换可用。
- 页面不出现社区、商城、会员、KOL、活动入口。
- 禁用 API 扫描无 `window`、`document`、`localStorage`、`sessionStorage`。

## out of scope

- 完整 CRUD。
- 复杂表单校验。
- 图表。
- 真实 AI。
