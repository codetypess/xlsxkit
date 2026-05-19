# Product Scope

## 目标

本仓库当前交付的是一套以 TypeScript API 为中心的 `.xlsx` 构建库，用来把遵循固定表头约定的 workbook 转成可校验、可变换、可多端输出的数据资产。

核心结果不是“任意 Excel 处理器”，而是“围绕固定表头语义、processor 管线、checker 约束和 writer 输出工作的 typed asset builder”。

## 固定技术路线

当前实现已经固定为以下路线：

1. 入口由 `index.ts` 导出，并在模块加载时自动 `registerBuiltins()`。
2. workbook 读取底层统一基于 `fastxlsx`。
3. `build(files, headerOnly?)` 负责驱动 header 读取、body 转换、processor 执行、checker 校验和 writer 输出。
4. 表头约定统一编码在 parser 中，而不是交给每个业务 writer 自行理解。
5. 扩展面统一通过 `registerType()`、`registerChecker()`、`registerProcessor()`、`registerWriter()`、`registerStringifyRule()` 暴露。
6. 输出阶段由 writer 接收 `define`、`stringify`、`gen-type`、`typedef` 事件，自行决定写文件格式和目录。

## 产品边界

当前实现覆盖的稳定边界包括：

- 读取一个或多个 `.xlsx` workbook，并解析 sheet、字段、checker 和 processor
- 将单元格值转换为内置类型、自定义类型和 typedef 类型
- 在管线中执行 `define`、`config`、`map`、`collapse`、`column`、`typedef`、`stringify`、`gen-type` 等处理器
- 在 writer 维度克隆 workbook 上下文，并按列级 writer 过滤生成不同输出
- 提供 JSON、Lua、TypeScript 序列化和类型生成辅助能力
- 提供 row / column indexer、typedef 生成、TS 到 Zod 的工具能力

## 非目标

以下内容不属于当前产品目标：

- 成为通用 Excel 编辑器或 GUI 工具
- 提供内置 CLI、watch 模式或长期驻留服务
- 自动推断业务表结构而不依赖固定表头约定
- 在一次进程生命周期内并发管理多套完全隔离的 registry / context / typedef 全局状态
- 替调用方接管输出目录规划、版本管理或业务级资源编排

## 设计原则

### 1. 表头约定优先于隐式推断

字段名、类型、writer 过滤、checker 和 processor 都由固定 header 语义定义，不靠散落在 writer 里的约定。

### 2. 先校验，再输出

writer fanout 和输出建立在转换完成、checker 已解析并执行之后，避免不同输出端默默消费不一致的数据。

### 3. 扩展通过注册面进入

新类型、checker、processor、writer 和 stringify 规则都应该经由 registry，而不是直接侵入 parser 或 pipeline 的临时分支。

### 4. writer 之间要隔离

writer 看到的是按列过滤后克隆出的上下文，不能假定自己读取到别的 writer 的专属字段。

### 5. 错误信息必须可定位

单元格、sheet、workbook、checker 源串和 typedef 来源都应尽可能保留，便于快速定位错误。

## 当前交付面

### 1. 核心构建入口

- `build(files, headerOnly?)`
- `registerWriter()`
- `registerType()`
- `registerChecker()`
- `registerProcessor()`
- `registerStringifyRule()`

### 2. 内置处理与校验

- `define` / `config` / `map` / `collapse` / `column`
- range / expr / follow / unique / sheet / index / oneof / refer
- `typedef` 与 `typedef-write`

### 3. 输出与工具

- `stringifyJson()` / `stringifyLua()` / `stringifyTs()`
- `genTsType()` / `genLuaType()` / `genTsTypedef()` / `genLuaTypedef()`
- `genWorkbookIndexer()` / `tsToZod()`

## 完成标准

当前产品基线应满足：

1. 调用方可以通过公开注册面和 `build()` 组织一个完整的 workbook 到多端资产输出流程。
2. workbook 表头、processor、checker 和 writer 过滤的行为是稳定且可回归验证的。
3. checker、typedef 和生成工具的错误输出足以定位到具体 workbook / sheet / field / cell。
4. 非 trivial 的行为变化能在 `docs/spec/` 中找到对应长期规则。
