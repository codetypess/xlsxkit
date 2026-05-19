# Build Pipeline

## 目标

本文件定义 `build(files, headerOnly?)` 的阶段顺序、作用域和关键约束。

## 构建主线

`build(files, headerOnly?)` 的当前固定顺序为：

1. 创建默认 context：`writer=DEFAULT_WRITER`, `tag=DEFAULT_TAG`
2. 为每个输入文件创建 `Workbook` 并挂到默认 context
3. 读取每个 workbook 的 header
4. 若 `headerOnly=false`，继续读取 body
5. 执行 `after-read` processor（仅默认 context）
6. 若 `headerOnly=false`：
   - 执行 `pre-parse` processor（仅默认 context）
   - 执行 `convertBody()`
   - 执行 `after-parse` processor（仅默认 context）
   - 执行 `copyWorkbook()`
   - 执行 `pre-check` processor（所有 writer context）
   - 执行 `resolveChecker()`
   - 执行 `performChecker()`
   - 执行 `after-check` processor（所有 writer context）
   - 执行 `pre-stringify` processor（所有 writer context）
   - 执行 `stringify` processor（所有 writer context）
   - 执行 `after-stringify` processor（所有 writer context）

## 阶段表

| 阶段 | 作用域 | 典型用途 |
| --- | --- | --- |
| `after-read` | 默认 context | typedef 注册、自动注册 enum 类型、依赖 header 的预处理 |
| `pre-parse` | 默认 context | body 转换前的结构准备 |
| `after-parse` | 默认 context | body 转换后的结构修正 |
| `pre-check` | writer context | writer 视图下的校验准备 |
| `after-check` | writer context | 校验后的补充处理 |
| `pre-stringify` | writer context | `define` / `config` / `map` / `collapse` / `column` / `typedef-write` |
| `stringify` | writer context | `stringify` / `gen-type` 等输出触发 |
| `after-stringify` | writer context | 输出后的附加动作 |

## Header-Only 语义

`headerOnly=true` 时：

- body 不读取
- `convertBody()` 不执行
- writer context 不克隆
- checker 不解析也不执行
- `stringify`、`gen-type` 等输出阶段不执行

这条路径主要用于只读取结构元信息的场景。

## Writer Fanout

### 为什么要克隆

writer 之间允许看到不同字段集，因此在 `after-parse` 之后，运行时会为每个已注册 writer 克隆独立的 `Context` 和 `Workbook` 视图。

### 克隆规则

- 若 field 的 writer 集合为空，默认对所有 writer 可见
- 若当前 writer 不在 field writer 集合里，该字段不会进入克隆结果
- 当主 sheet 首字段对某 writer 不可见时，该 sheet 不会进入该 writer 的克隆结果
- 克隆时会保留 tag，并深拷贝非 tag 数据

### 主键重建

在 writer fanout 阶段，每个 sheet 的 `data` 会从“按行号索引”重建为“按第一列转换值索引”。

此时：

- key 为空会报错
- key 重复会报错，并同时给出前后两个位置

## Checker 生命周期

### 解析时机

- parser 先把 checker 保存成 `CheckerType` 描述
- `resolveChecker()` 在 writer fanout 之后把它们绑定到真实执行函数

### 执行时机

- `performChecker()` 在 writer 视图上执行，因此 checker 看到的是 writer 过滤后的字段集合
- `@oneof(...)`、`@refer(...)` 和 typedef 嵌套 checker 都在这里完成递归执行

### 聚合策略

- 每个 writer 单独聚合错误
- 错误里包含 workbook、sheet、field、checker、失败值
- typedef 来源存在时，再附加 typedef 和定义位置

## 内置 Processor 时序

当前 builtins 的阶段与优先级为：

| Processor | 阶段 | 优先级 | 说明 |
| --- | --- | --- | --- |
| `typedef` | `after-read` | `0` | 读取 typedef sheet 并注册 converter |
| `auto-register` | `after-read` | `999` | 从 define sheet 自动注册 enum converter / checker |
| `typedef-write` | `pre-stringify` | `-100` | 把 typedef workbook 输出给 writer |
| `define` | `pre-stringify` | `0` | 先生成 define 事件并清空该 sheet 数据 |
| `config` / `map` / `collapse` / `column` | `pre-stringify` | `800` | 常规 sheet 结构变换 |
| `stringify` | `stringify` | `900` | 触发 stringify 输出 |
| `gen-type` | `stringify` | `999` | 触发类型生成输出 |

`stringify`、`gen-type`、`auto-register` 是 required processor；若 workbook 未显式声明，parser 会自动补上。

## 实现约束

1. 非 trivial 的阶段顺序调整必须更新本文件和回归测试。
2. 早期 processor 不应假定 writer 过滤已经发生。
3. 后期 processor 不应再读取默认 context 里的“按行号索引”数据作为权威真源。
4. `build()` 当前依赖全局 context / registry / typedef 状态，不应并发执行多个相互隔离的构建会话。
5. 如果未来引入 reset / reuse / multi-session 机制，必须先写 work-item spec。
