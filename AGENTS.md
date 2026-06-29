# AGENTS.md

你是 TuBu 徒步装备助手小程序的 AI 编程助手。你的目标是按可验证、可回滚、可持续迭代的方式完成 MVP，而不是快速堆页面。

本项目必须围绕微信小程序原生开发，第一期只做装备库、出行方案、方案清单、重量统计和打包检查闭环。

## 1. 项目目标

TuBu 的第一期要帮助用户回答三个问题：

1. 我拥有哪些装备？
2. 这次出行我要带哪些装备？
3. 这些装备到底有多重，是否已经打包？

第一期不做社区、会员、商城、真实 AI、路线内容、多用户协作或复杂后端。

## 2. 开发角色模型

每轮开发必须依次扮演三个角色：

| 角色 | 职责 |
| --- | --- |
| Planner | 理解需求，选择当前阶段 spec，输出 sprint contract 和验收标准 |
| Generator | 严格按 contract 编写代码，只修改必要文件 |
| Evaluator | 按验收标准检查代码、编译结果、小程序规范和手动验证步骤 |

每次对话默认只执行一个 sprint。当前 sprint 未通过验收前，不得进入下一个 sprint。

## 3. Sprint Contract

每轮开发前必须输出：

```md
## Sprint #{n}

goal:
本轮只完成的单一目标。

spec:
引用的 specs/stage-xx-*.md 文件。

impl:
要修改的模块、页面、数据层或 service。

criteria:
可验证的成功标准。

layer:
types / config / repo / service / runtime / ui

blocked_by:
依赖的前置 sprint。无则填写 none。
```

要求：

- 一个 sprint 只做一个明确功能。
- criteria 必须具体，不能写“体验良好”“功能正常”。
- 如果无法自动化验证，必须写出微信开发者工具手动验证步骤。
- 如果需求和当前 spec 冲突，先提醒用户，不要自行扩展。

## 4. 技术硬约束

必须使用：

- 微信小程序原生 TypeScript
- WXML
- WXSS
- JSON
- 微信原生组件
- 微信原生 API：`wx.*`

禁止使用：

- React / Vue / Angular
- Taro / uni-app
- 浏览器 DOM API
- `window` / `document`
- `localStorage` / `sessionStorage`
- Web 端 UI 框架
- 未经用户确认的第三方依赖

V1 MVP 默认使用本地存储：`wx.setStorageSync` / `wx.getStorageSync`。如需启用云开发、真实后端、ECharts、状态管理库或真实 AI，必须先征得用户确认。

## 5. 推荐目录结构

```txt
/
├── AGENTS.md
├── specs/
├── project.config.json
├── miniprogram/
│   ├── app.ts
│   ├── app.json
│   ├── app.wxss
│   ├── pages/
│   ├── components/
│   ├── utils/
│   ├── services/
│   ├── repositories/
│   ├── mock/
│   └── assets/
└── typings/
```

规则：

- 页面放在 `miniprogram/pages/`。
- 可复用组件放在 `miniprogram/components/`。
- 业务 service 放在 `miniprogram/services/`。
- 本地存储访问放在 `miniprogram/repositories/`。
- mock seed 放在 `miniprogram/mock/`。
- 类型和枚举优先放在 `miniprogram/utils/` 或轻量 `types` 文件中。
- 新增页面必须注册到 `miniprogram/app.json`。

## 6. 轻量分层

依赖方向：

```txt
types/config -> repositories -> services -> pages/components
```

规则：

- repository 只负责本地存储读写，不处理页面状态。
- service 负责统计、快照、复制方案、智能解析等业务逻辑。
- 页面可以调用 service，但 service 不应该知道页面存在。
- 不为了架构好看制造空目录；只有当前 sprint 用到才创建。

## 7. 核心数据原则

第一期必须围绕三类数据：

- `Gear`：装备库装备。
- `TripPlan`：出行方案。
- `PlanItem`：方案中的装备快照。

关键规则：

- `PlanItem` 必须保存装备快照：名称、分类、重量、价格。
- 装备库后续修改不得影响历史方案。
- 删除使用软删除字段或本地等价机制。
- 重量内部统一用 g。
- 价格内部统一用分。
- UI 可以显示 kg、元，但计算层不得混用单位。

## 8. 页面范围

底部 Tab：

1. 首页
2. 装备
3. 新增
4. 方案
5. 我的

第一期核心页面：

- 首页：装备库统计、默认方案、当前方案重量、快捷入口。
- 装备库页：装备列表、搜索、分类筛选、新增/编辑/删除。
- 新增页：手动新增装备、智能解析入口、临时新增入口。
- 方案列表页：方案 CRUD、复制、设置默认。
- 方案详情页：方案装备清单、重量统计、分类可视化、打包检查。

## 9. 开发流程

## UI 响应式排版规范

所有小程序页面、弹窗、卡片、底部固定栏在实现前必须先考虑主流窄屏真机宽度。关键规则：

- 文字、按钮、分栏列表和弹窗操作区不得依赖“刚好够宽”的固定尺寸。
- 横向布局必须给文本容器设置 `min-width: 0`，长文案必须明确允许换行、截断或缩小字号，不能把按钮挤出屏幕。
- 弹窗按钮必须位于弹窗内部，使用可收缩布局，并在窄屏下仍保留左右内边距。
- 卡片里的指标列表要控制列宽比例，分类名、百分比、数值之间不能过度拉开，也不能互相遮挡。
- 每次涉及 UI 的 sprint，Evaluator 必须检查至少一种窄屏场景，确认主要文字不溢出、不重叠、不被底栏或弹窗遮挡。

## 表单键盘规范

这是 TuBu 已验证的真机结论。**后续凡是改 `input`、`textarea`、表单弹窗，都必须遵守，不得回退到复杂键盘方案。**

### 禁止方案（真机已验证会出问题）

不要再用以下组合处理键盘：

- `wx.onKeyboardHeightChange` / `wx.offKeyboardHeightChange`
- 根据键盘高度动态改弹窗 `padding-bottom`、高度或位置
- `bindfocus` 后延迟 `scroll-into-view`
- `hold-keyboard`、`always-embed` 与 `adjust-position`、键盘监听混用

真机表现：输入时二段式顶起、placeholder/文字先卡住再移动、键盘收起后弹窗不恢复原位。

### 最终可用方案

**1. 输入框使用原生避让**

表单里的 `input` / `textarea` 统一：

```xml
adjust-position="{{true}}"
cursor-spacing="120"
```

- 不要叠加 `hold-keyboard`，除非有明确场景且真机验证通过。
- 不要写 `adjust-position="{{false}}"` 再自己顶键盘。

**2. 弹窗布局保持简单**

- 弹窗在**小程序内容区**内视觉居中（非整屏几何中心）：底栏占位 + 可选 `modal-viewport-center` / `modal-viewport-center--compact`（见 `styles/modal-layout.wxss`）。
- 内部用 `scroll-view` 滚动；**不要在键盘弹起时动态改变弹窗整体高度、对齐方式或外层 padding。**

**3. 底部输入仍被挡时，只调静态布局**

优先：

- 增加弹窗内部 `scroll-view` 高度
- 增加表单底部留白（如 `edit-form { padding-bottom: 72rpx }` 或 `edit-keyboard-spacer`）
- 调整 `cursor-spacing`

不要先上键盘状态管理、监听、延迟滚动。

### Evaluator 真机检查清单

每次涉及表单输入的改动，至少验证：

- [ ] 顶部输入框聚焦正常，无跳动
- [ ] 底部输入框/textarea 聚焦后可输入、可见
- [ ] 键盘收起后页面/弹窗恢复原位
- [ ] 未引入 `wx.onKeyboardHeightChange` 或 focus 延迟滚动

## 表单选择器规范

表单里的下拉、单选、枚举选择不得使用微信原生底部 `picker`（`mode="selector"` 等）作为默认交互。

必须优先复用项目内已对齐 TuBu 视觉风格的自定义选择组件，例如：

- 枚举/下拉：`miniprogram/components/custom-select/`
- 出行天数（滚动选择，自动显示几天几夜）：`miniprogram/components/custom-trip-days-picker/`
- 日期：优先使用项目内 `custom-date-picker` 或等价自定义方案

要求：

- 选择面板样式必须与当前页面、弹窗、输入框的圆角、边框、字号和留白保持一致。
- 弹窗内选择器必须支持 `elevated` 或等价层级处理，避免被遮罩或弹窗裁切。
- 只有自定义组件确实无法覆盖的场景，才允许评估新增组件；不得为了省事回退到微信默认底部选择框。

每轮必须：

1. 读取本文件。
2. 读取当前阶段对应的 `specs/stage-xx-*.md`。
3. 输出 sprint contract。
4. 实现 contract 中的内容。
5. 执行 Evaluator 检查。
6. 用固定交付格式汇报。

Evaluator 必须检查：

- 页面是否注册到 `app.json`。
- 是否存在禁用技术或浏览器 API。
- 是否误接真实 AI、云开发或后端。
- 是否处理空数据、失败状态和基础校验。
- 表单枚举选择是否误用微信原生底部 `picker`。
- 表单输入是否遵守「表单键盘规范」（原生 `adjust-position`、无键盘高度监听）。
- criteria 是否逐条通过。

## 10. 每轮交付格式

```txt
Sprint 结果：
- 通过 / 未通过

完成内容：
- ...

修改文件：
- ...

验收结果：
- [x] criteria 1
- [ ] criteria 2

验证方式：
- ...

遗留问题：
- ...
```

未通过时必须说明原因，并回到当前 sprint 修复，不得跳到下一阶段。

## 11. 阶段推进顺序

必须按 `specs/` 推进：

1. `00-product-architecture.md`
2. `01-data-model-and-storage.md`
3. `02-stage-foundation.md`
4. `03-stage-gear-library.md`
5. `04-stage-plan-library.md`
6. `05-stage-plan-detail.md`
7. `06-stage-add-to-plan.md`
8. `07-stage-weight-statistics.md`
9. `08-stage-smart-parse.md`
10. `09-stage-visualization-and-polish.md`

不要跳过数据模型和 foundation 阶段直接堆 UI。
