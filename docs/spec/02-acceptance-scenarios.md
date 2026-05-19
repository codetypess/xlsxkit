# Acceptance Scenarios

## 使用方式

本文件记录当前实现必须守住的黑盒回归场景。

这些场景不要求测试一定走同一实现路径，但最终对调用方暴露出来的行为应该一致。

## Case List

### BB-01 入口初始化与构建启动

- 从根入口导入库后，内置 converter、checker、processor 和 stringify 规则已注册
- 调用 `build(files)` 会按文件顺序读取 workbook，并输出稳定的阶段日志
- 调用 `build(files, true)` 时，只读取 header，并执行 `after-read` 阶段；不会继续 body 转换、checker 或 writer 输出

### BB-02 Header 解析与字段契约

- sheet 首行以 `@processor` 开头时，header 行布局按“processor + 五行表头”解释；否则第 1 行直接是字段名
- sheet 名非法、字段名重复、writer 未注册、checker 行为空等情况会立即报错
- `x` 会关闭列导出；空 writer 行表示对所有已注册 writer 生效；多 writer 使用 `|`
- required processor 缺失时，会自动补到首个有效 sheet 上

### BB-03 Body 读取与值转换

- 数据区起始行在“有 processor 行”和“无 processor 行”两种布局下都正确
- `auto` 类型要求单元格填 `-`，并转换为按数据行计算的序号
- `@fieldName` 动态类型会读取同一行的类型列决定真实 converter
- optional、数组、JSON、Lua table 和自定义类型都按约定转换，失败时给出可定位错误

### BB-04 Sheet 级变换处理器

- `define` 可以把 key 链折叠成嵌套对象，并保留 enum / comment 元信息
- `config` 可以把 key/value/value_type/value_comment 形式的 sheet 转成配置对象
- `map`、`collapse`、`column` 会按参数重组数据形状，并在需要时更新字段的 `realtype`
- `typedef` 会读取类型定义、注册 converter，并触发后续 `typedef-write`

### BB-05 Writer Fanout 与输出事件

- `copyWorkbook()` 之后，每个 writer 只看到它自己可见的 sheet / field 视图
- 第一列值会成为 writer 侧 sheet 数据的新 key；空 key 或重复 key 会报错
- writer 能收到稳定的 `define`、`stringify`、`gen-type`、`typedef` 事件
- `simple` 与 `merge` 两个内置 stringify 规则维持稳定输出语义

### BB-06 Checker 解析与执行

- range、expr、follow、unique、sheet、index、oneof、refer 的外部语法稳定
- checker 默认跳过 `null` 值，带 `!` 前缀时即使为空也会执行
- `@oneof(...)` 每个分支都必须独立解析成单个 checker；失败时聚合错误能看出每个分支结果
- `@refer(field)` 能把行内字符串动态解析成 per-row checker，并绑定到目标字段

### BB-07 Typedef、Union 与嵌套 Checker

- typedef sheet 至少要求 `comment`、`key1`、`key2`、`value_type`、`value_comment`
- `key2` 含 `|` 时表示 union 成员列表，`value_type` 作为 discriminator
- 同名 typedef 不能在不同 workbook / sheet 中重复定义
- typedef 字段上的 checker 会在真实业务字段上递归执行，并把 typedef 来源写进错误信息

### BB-08 序列化与生成工具

- `stringifyJson()`、`stringifyLua()`、`stringifyTs()` 会保留注释、enum 和 ignore 等 tag 语义
- `genTsType()`、`genLuaType()`、`genTsTypedef()`、`genLuaTypedef()` 产出稳定可用的类型定义
- `genWorkbookIndexer()`、`mergeTypeFile()`、`tsToZod()` 能在现有回归样例上稳定工作

### BB-09 错误格式与诊断

- processor 失败时，错误栈里能看出阶段和执行位置
- checker 聚合错误至少包含 path、sheet、field、checker、失败值和必要的上下文
- typedef 字段 checker 失败时，错误里包含 typedef 名称链和定义位置

## 最低回归要求

只要涉及以下任一方面，就至少需要整体验证一轮：

1. workbook header / parser 规则
2. `build()` 阶段顺序或 context 生命周期
3. writer fanout 或输出事件
4. checker / refer / oneof / index 语义
5. typedef / union / nested checker 语义
6. 类型生成、indexer、Zod 输出

最低验证命令：

```bash
npm run check
npm run test
```
