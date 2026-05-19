# Specification-Driven Development Workflow

SDD 在本仓库里指 Specification-Driven Development。

对任何非 trivial 的功能、bug fix、重构、架构调整、协议调整、类型系统调整、校验语义调整、输出格式调整、性能变更或大规模测试基线变更，都应先写或更新 spec，再开始大面积编码。

目标很简单：在代码漂移之前，把预期行为、设计取舍、测试方法和验收标准写清楚。

## 什么时候必须用 SDD

以下改动默认应先走 SDD：

- 新增用户可见能力，例如新的 processor、checker、writer、stringify 规则或 tooling 输出
- 修改 workbook 表头约定、数据模型、sheet 变换语义、writer 过滤规则
- 修改 `build()` 阶段顺序、context 克隆、checker 解析或错误聚合行为
- 修改 typedef / union / literal / 嵌套 checker 语义
- 调整公共 API、生成代码格式、Zod 输出或 indexer 行为
- 可能影响现有回归样例预期的大测试调整
- 预期行为不够明确，或修复可能波及邻近流程的 bug

以下改动通常可以先不单独建 SDD：

- typo 修正
- comment-only 变更
- 不改变语义的窄范围重命名
- 纯机械格式化

如果任务原本很小，但实现过程中已经触及行为、契约或跨模块边界，应在继续编码前补上 SDD。

## 文档位置

- SDD 工作流说明：`docs/spec-driven-development.md`
- spec 地图与阅读顺序：`docs/spec/README.md`
- 具体任务的 work-item spec：`docs/spec/<short-slug>.md`
- 当前长期基线 spec：`docs/spec/README.md` 中列出的编号文件

work-item 文件名使用小写 kebab-case，例如：

- `docs/spec/typed-union-discriminator-regression.md`
- `docs/spec/writer-context-lifecycle.md`

## 基线 Spec 与 Work-Item Spec

当前仓库的 `docs/spec/` 同时承载两类文档：

- 编号文件：长期有效的基线规则
- 非编号 kebab-case 文件：本次具体要做什么、怎么做、怎么验收

当某次改动影响了既有长期规则时：

1. 先创建或更新 work-item spec。
2. 如果结果会成为新的长期默认行为，在同一改动里同步更新相关编号基线 spec。

## 状态流转

每个 work-item spec 都应以状态行开头：

- `Draft`: 还在收敛问题、范围和方案
- `Approved`: 方案已明确，可以进入实现
- `Implementing`: 代码实现中
- `Verifying`: 实现完成，正在跑验证
- `Done`: 验收完成
- `Superseded`: 已被新的 work-item 替代

实现过程中如果发现更好的方案，不要让文档落后于代码；应先更新 SDD，或至少和代码一起更新。

## 默认工作流

1. 定义问题、当前行为、目标行为和非目标。
2. 如果是 bug fix，先确认根因，不要靠盲试 patch。
3. 阅读 `docs/spec/README.md`，定位受影响的编号基线 spec。
4. 创建或更新 `docs/spec/<slug>.md`。
5. 把关键设计决策和放弃方案写明。
6. 把实现拆成阶段，并给出明确退出条件。
7. 按 spec 实现，并保持文档和代码同步。
8. 根据验收标准验证后，再把状态改为 `Done`。

## 推荐章节

对非 trivial 任务，默认使用下面的结构：

```md
# <Work Item Name>

Status: Draft
Date: YYYY-MM-DD
Scope: <short boundary>

## 1. Context

## 2. Goals

## 3. Non-Goals

## 4. Current Behavior

## 5. Proposed Behavior

## 6. Design

## 7. Implementation Plan

## 8. Testing Plan

## 9. Acceptance Criteria

## 10. Risks and Rollback
```

任务真的很小的时候，可以裁剪章节，但不要省略问题边界、目标行为和验收标准。

## 验收标准写法

验收标准必须是可观察的。优先写成：

- 运行 `npm run check` 成功
- `build(["a.xlsx"])` 在 `headerOnly=true` 时只执行 `after-read`
- `@oneof(...)` 分支失败时，聚合错误中同时包含每个分支来源
- typedef 字段 checker 失败时，错误里包含 typedef 来源和定义位置

避免写成：

- 架构更合理了
- 代码更干净了
- 性能更好了

如果性能是目标，要明确具体流、验证方法和观察口径。

## 实现规则

- 大改动先从 spec 开始，不要先把代码推远再补文档
- bug fix 先确认和记录根因
- 实现范围以当前 SDD 为边界，除非用户明确扩项
- 方案变化时同步更新 SDD
- 新的长期规则要同步写回编号基线 spec
- 验收依赖测试时，测试必须和实现同一改动提交
- 已知后续项写进 SDD，不要静默扩大当前任务

## Review Checklist

完成前至少确认：

- work-item 的状态、范围和当前实现一致
- goals / non-goals / acceptance criteria 仍然准确
- 测试或人工检查能映射回验收标准
- 长期规则变化已同步进编号基线 spec
- 延后项明确记录，没有把破损验收标准伪装成 follow-up
