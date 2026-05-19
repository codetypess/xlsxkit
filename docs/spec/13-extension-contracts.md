# Extension Contracts

## 目标

本文件定义 `typedsheet` 对外暴露的稳定扩展面，以及调用方在注册和输出阶段应遵守的约束。

## 公共入口契约

调用方默认应从根入口导入：

- `build()`
- registry 相关 API
- 内置 processor / checker / stringify / tooling

根入口会自动完成 builtins 注册；调用方不需要也不应该手工重复导入内部注册文件。

## Registry 契约

### `registerType(name, converter)`

- `converter` 必须是函数
- 同名覆盖允许发生，但会输出警告
- converter 应把输入字符串转换为稳定的运行时值，不应依赖外部隐式上下文

### `registerChecker(name, parser)`

- `parser` 负责把 checker 参数编译为可执行函数
- 同名覆盖允许发生，但会输出警告
- parser 若依赖 context，应只依赖公开运行时结构，而不是读写隐藏全局状态

### `registerProcessor(name, exec, option)`

- `exec` 必须是异步 processor
- `option.stage` 决定执行时机
- `option.priority` 越小越早执行
- `option.required=true` 表示 parser 会自动把它补入 workbook

### `registerWriter(name, writer)`

- writer 是输出副作用的唯一标准入口
- 同名覆盖允许发生，但会输出警告
- 列级 writer 过滤引用的名字必须已经注册，否则 header 解析直接失败

### `registerStringifyRule(name, rule)`

- rule 名必须唯一
- rule 运行在 writer context 上，消费的是该 writer 视图下的 workbook

## Suppression 契约

以下 suppression API 主要用于测试、调试或局部构建控制：

- `suppressChecker()`
- `suppressAllCheckers()`
- `suppressProcessor()`
- `suppressWriter()`

约束：

- suppression 改的是进程级全局状态
- 非测试代码不要长时间依赖 suppression 作为业务流程的一部分

## Writer 契约

writer 形态为：

```ts
(workbook, processor, data) => void
```

### 稳定输入

- `workbook.context.writer` 是当前 writer 名
- `processor` 目前稳定包含：`define`、`stringify`、`gen-type`、`typedef`
- `data` 的具体形状取决于触发它的 processor

### 稳定约束

- writer 不应假定自己能看到其他 writer 专属字段
- writer 不应修改 registry、typedef 或其他 writer 的上下文
- writer 若要写文件，应通过 `writeFile()` / `writeJson()` / `writeLua()` / `writeTs()` 或自定义安全输出逻辑

## Processor 契约

processor 形态为：

```ts
async (workbook, sheet, ...args) => void
```

### 允许的职责

- 读取和改写当前 sheet 数据
- 修改 `field.realtype`、`field.ignore`、`sheet.ignore`
- 通过 `output()` 或内置 helper 触发 writer 输出

### 不建议的职责

- 依赖未声明的全局顺序副作用
- 跨 workbook 随意改写其他 sheet 数据
- 假定 `sheet.ignore=true` 会被所有下游自动识别为“彻底跳过”

### Required Processor 约束

required processor 会被自动补到首个有效 sheet，因此它们应满足：

- 不依赖“必须声明在特定 sheet 上”的业务语义
- 能在 workbook 维度安全执行

## Stringify Rule 契约

内置规则：

- `simple`: 输出 `{ [sheetName]: sheet.data }`
- `merge`: 把多个 sheet 的行 key 合并到同一个对象

自定义 rule 应遵守：

- 只消费传入的 writer 视图
- 对 key 冲突有明确策略，不能默默覆盖
- 输出数据应可被 writer 直接消费

## Tooling 契约

以下工具默认属于当前公开能力的一部分：

- `stringifyJson()` / `stringifyLua()` / `stringifyTs()`
- `genTsType()` / `genLuaType()`
- `genTsTypedef()` / `genLuaTypedef()`
- `genWorkbookIndexer()`
- `tsToZod()`
- `mergeTypeFile()`

对这些工具做非 trivial 改动时，应把“输出格式是否兼容既有产物”写进 SDD 验收标准。

## 生命周期约束

当前运行时存在以下进程级状态：

- registry：type / checker / processor / writer / stringify rule
- contexts：`getContexts()` 管理的运行时 workbook 视图
- typedef 注册表

因此：

1. 单进程内多次构建或测试隔离，必须显式管理这些状态。
2. 若未来要引入“可重入 build”“隔离 session”“reset API”，必须先用 work-item spec 设计生命周期契约。
