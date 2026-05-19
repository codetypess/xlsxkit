# Spec Index

## 目的

`docs/spec` 是当前仓库的 Specification-Driven Development 入口目录，承载两类文档：

- 编号文件：长期有效的基线 spec
- 非编号 kebab-case 文件：面向具体任务的 work-item spec

最重要的判断规则：

- 编号文件回答“系统长期应该是什么样”
- 非编号文件回答“这次具体准备改什么、怎么改、怎么验收”

更完整的流程见 [../spec-driven-development.md](../spec-driven-development.md)。

## 第一遍阅读：四层心智模型

先按下面四层理解当前实现，不要从所有 helper 和测试细节开始读。

| 层 | 先看哪里 | 主要回答的问题 |
| --- | --- | --- |
| Product / API scope | [`01-product-scope.md`](01-product-scope.md), [`13-extension-contracts.md`](13-extension-contracts.md), `README.md`, `index.ts` | 这个库交付什么，不交付什么，公共入口和扩展面是什么 |
| Workbook model | [`11-workbook-model.md`](11-workbook-model.md), `src/core/schema.ts`, `src/core/workbook.ts`, `src/core/parser.ts` | header、sheet、field、cell、tag 和 writer 过滤到底怎么建模 |
| Build pipeline | [`10-architecture.md`](10-architecture.md), [`12-build-pipeline.md`](12-build-pipeline.md), `src/xlsx.ts`, `src/core/pipeline.ts`, `src/processors/` | `build()` 怎样驱动阶段、克隆上下文、执行 checker 和输出 |
| Validation / typedef / tooling | [`02-acceptance-scenarios.md`](02-acceptance-scenarios.md), [`14-checker-and-typedef-semantics.md`](14-checker-and-typedef-semantics.md), `src/typedef.ts`, `src/tooling/`, `test/` | checker、typedef、类型生成、Zod 输出和回归基线如何定义 |

## 当前目录快照

当前 `docs/spec` 包含：

- 8 份编号基线 spec
- 0 份进行中的 work-item spec
- 1 份长期保留的实施顺序文档：[`90-implementation-plan.md`](90-implementation-plan.md)

当前没有 active work-item；需要新的非 trivial 任务时，再新增 `docs/spec/<slug>.md`。

## Source of Truth

若发生冲突，默认按以下顺序判断：

1. 对应 work-item spec
2. 相关基线 spec
3. 公共 API 与回归测试基线
4. 当前运行时代码

如果代码和 spec 不一致，不要默默以代码为准；应先修 spec，或在同一改动里同时修 spec 和实现。

## 按问题找文档

| 你想确认什么 | 优先阅读 |
| --- | --- |
| 这个库当前要解决什么问题，哪些不做 | [`01-product-scope.md`](01-product-scope.md) |
| 现在必须守住哪些黑盒行为 | [`02-acceptance-scenarios.md`](02-acceptance-scenarios.md) |
| 模块边界、全局状态和 build 主线 | [`10-architecture.md`](10-architecture.md) |
| workbook / sheet / field / cell / tag / header 约定 | [`11-workbook-model.md`](11-workbook-model.md) |
| 阶段顺序、processor 时机、writer fanout、checker 执行时机 | [`12-build-pipeline.md`](12-build-pipeline.md) |
| 公共 API、注册扩展点、writer 与 processor 契约 | [`13-extension-contracts.md`](13-extension-contracts.md) |
| checker 语法、typedef 规则、嵌套 checker 与错误格式 | [`14-checker-and-typedef-semantics.md`](14-checker-and-typedef-semantics.md) |
| 跨层改动应该按什么顺序推进 | [`90-implementation-plan.md`](90-implementation-plan.md) |

## 基线 Spec 地图

### 1. 范围与验收

| 文件 | 主要回答的问题 |
| --- | --- |
| [`01-product-scope.md`](01-product-scope.md) | 产品目标、固定路线、非目标和完成标准是什么 |
| [`02-acceptance-scenarios.md`](02-acceptance-scenarios.md) | 当前版本至少要守住哪些黑盒回归场景 |

### 2. 架构、模型与流程

| 文件 | 主要回答的问题 |
| --- | --- |
| [`10-architecture.md`](10-architecture.md) | 核心模块如何分层，哪些状态和副作用归谁拥有 |
| [`11-workbook-model.md`](11-workbook-model.md) | workbook 数据模型和表头约定怎么定义 |
| [`12-build-pipeline.md`](12-build-pipeline.md) | `build()` 的阶段顺序、处理器时机和 writer fanout 如何工作 |

### 3. 扩展与语义

| 文件 | 主要回答的问题 |
| --- | --- |
| [`13-extension-contracts.md`](13-extension-contracts.md) | 注册类型、checker、processor、writer 和输出工具时必须守什么契约 |
| [`14-checker-and-typedef-semantics.md`](14-checker-and-typedef-semantics.md) | checker、typedef、嵌套校验和错误聚合的稳定语义是什么 |

### 4. 实施顺序

| 文件 | 主要回答的问题 |
| --- | --- |
| [`90-implementation-plan.md`](90-implementation-plan.md) | 跨层改动时应该按什么顺序推进，最低回归要求是什么 |

## 推荐阅读路径

### 初次进入这套 spec

推荐顺序：

1. [`01-product-scope.md`](01-product-scope.md)
2. [`02-acceptance-scenarios.md`](02-acceptance-scenarios.md)
3. [`10-architecture.md`](10-architecture.md)
4. 按关注点继续深入：
   - workbook 和表头：[`11-workbook-model.md`](11-workbook-model.md)
   - build / processor / writer：[`12-build-pipeline.md`](12-build-pipeline.md)
   - 扩展与校验：[`13-extension-contracts.md`](13-extension-contracts.md), [`14-checker-and-typedef-semantics.md`](14-checker-and-typedef-semantics.md)
5. 需要看实施顺序时再读 [`90-implementation-plan.md`](90-implementation-plan.md)

### 修 bug

默认顺序：

1. 先写清楚根因假设
2. 对照 [`02-acceptance-scenarios.md`](02-acceptance-scenarios.md) 找到受影响的黑盒场景
3. 再读对应边界文档，例如：
   - header / parser / row 布局：[`11-workbook-model.md`](11-workbook-model.md)
   - pipeline / context / writer：[`12-build-pipeline.md`](12-build-pipeline.md)
   - checker / typedef / 聚合错误：[`14-checker-and-typedef-semantics.md`](14-checker-and-typedef-semantics.md)
4. 创建或更新 work-item spec

### 做非 trivial 改动

默认顺序：

1. 阅读 [../spec-driven-development.md](../spec-driven-development.md)
2. 找出受影响的基线 spec
3. 新建或更新 `docs/spec/<slug>.md`
4. 先固定行为、边界、测试计划和验收标准
5. 实现完成后，如果形成新的长期规则，同步更新编号基线 spec

## Work-Item Spec 约定

### 路径与命名

- work-item spec 直接放在 `docs/spec/<slug>.md`
- `slug` 使用小写 kebab-case
- 编号前缀保留给基线 spec，不要给 work-item 加编号

例如：

- `docs/spec/processor-stage-reorder.md`
- `docs/spec/typedef-checker-origin-regression.md`

### 最小头部

每个 work-item 至少包含：

```md
# <Work Item Name>

Status: Draft
Date: YYYY-MM-DD
Scope: <short boundary>
```

完整模板见 [../spec-driven-development.md](../spec-driven-development.md)。

### 什么时候必须建 Work-Item

以下改动通常必须先更新 work-item spec：

- 新增 processor / checker / writer / stringify 规则
- 修改 workbook 表头契约、writer 过滤、数据转换或输出格式
- 修改 `build()` 阶段顺序、context 生命周期或全局状态规则
- 修改 typedef、union、literal、动态类型或嵌套 checker 语义
- 影响既有回归预期的测试调整

以下改动可以先不单独建 work-item，但如果范围扩大，需要补上：

- 纯文案修正
- comment-only 改动
- 局部机械整理
- 不改变语义的窄范围重命名

### 什么时候同步更新基线 Spec

当本次 work item 已经形成新的长期规则时，应同步更新相关编号文件。常见信号：

- workbook 表头规则本身变了
- `build()` 阶段、processor 顺序或 writer fanout 变了
- checker / typedef / 错误输出语义变了
- 公共 API、writer 事件或生成代码格式变了

相反，如果只是纯机械整理，且长期规则本身没有变化，那么完成后可以直接删除 work-item spec，不需要长期留在目录里。

## Work-Item Index

当前没有 active work-item。
