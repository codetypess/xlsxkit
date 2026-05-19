# Workbook Model

## 目标

本文件定义 `typedsheet` 在运行时如何建模 workbook、sheet、field、cell，以及 parser 如何解释固定表头。

## 核心对象

### `Context`

- 由 `writer` 和 `tag` 标识
- 持有一组 workbook
- 提供按 path 查找 workbook 的运行时边界

### `Workbook`

- `path` 是主身份，`name` 由文件名去掉扩展名得到
- 持有按 sheet 名索引的 sheet 集合
- `clone(ctx)` 会按 writer 可见性过滤字段并深拷贝数据

### `Sheet`

- `name`
- `processors`
- `fields`
- `data`
- `ignore`

`data` 在不同阶段可能有两种主形态：

- parser 读完 body 后：按“行号”索引的 `TRow`
- writer fanout 后：按“第一列 key 值”索引的 `TRow`

### `Field`

- `index`: 原始列序号
- `name`
- `typename`
- `writers`
- `checkers`
- `comment`
- `location`
- `realtype`
- `ignore`

`realtype` 只在某些 processor 改写输出形状后补充真实类型，例如 `column()` 把单值折成数组。

### `TCell`

- `v`: 转换后的值
- `r`: 单元格坐标，如 `A7`
- `s`: 原始字符串
- `t`: 真实转换类型

### Tag 语义

运行时对象支持以下 tag：

- `!name`
- `!type`
- `!stringify`
- `!enum`
- `!comment`
- `!ignore`

这些 tag 会被序列化和类型生成工具消费。

## Header 布局

### 有 processor 行时

| 行号 | 含义 |
| --- | --- |
| 1 | processor 行 |
| 2 | 字段名 |
| 3 | 字段类型 |
| 4 | writer 过滤 |
| 5 | checker |
| 6 | 注释 |
| 7+ | 数据 |

### 无 processor 行时

| 行号 | 含义 |
| --- | --- |
| 1 | 字段名 |
| 2 | 字段类型 |
| 3 | writer 过滤 |
| 4 | checker |
| 5 | 注释 |
| 6+ | 数据 |

## Parser 规则

### Sheet 选择

- sheet 名以 `#` 开头时跳过
- `A1` 为空时跳过
- sheet 名必须匹配当前实现允许的字符范围

### 字段名

- 字段必须同时具备 `name` 和 `typename`
- 当前解析器按正则 `[^A-Za-z0-9_$-]` 拒绝非法字段名
- 同一 sheet 内字段名不能重复

### Writer 行

- 空值表示该列对所有已注册 writer 生效
- `x` 表示该列完全不导出
- 多 writer 通过 `|` 分隔
- 第一列允许使用 `>>` 这类视觉标记，parser 会在主键列 writer 解析时忽略它

### Checker 行

- `x` 表示关闭当前列 checker
- 第一列若以 `!!` 开头，会被视为视觉标记并跳过
- 非空 checker 字符串会被拆成一个或多个 `CheckerType`

### 注释行

- parser 只把它当成 comment 文本，不参与语义解析

## Body 读取规则

- 数据起始行由是否存在 processor 行决定
- parser 会从最后一行向上裁剪尾部空行，但以第一列是否为空为主判断
- 每个 row 都会带上 `!type = Row`
- 第一列值在早期阶段仍不是最终业务 key；writer fanout 之后才会成为 `sheet.data` 的新索引

## 特殊字段语义

### `auto`

- 只接受 `-`
- 转换结果为“当前数据区中的 1-based 行号”

### 动态类型 `@fieldName`

- 当前字段的真实类型由同一行另一个字段的值决定
- 该类型字段本身会被标记为 ignore，不作为普通业务输出字段

### `@refer(otherField)`

- 被引用的规则字段必须存在
- 规则字段本身会被标记为 ignore
- 每一行的 refer 规则会在 body 读取阶段被动态解析并绑定到目标字段

### 以 `-` 开头的首字段

- parser 会把该首字段标记为 ignore
- 这是现有运行时支持的隐藏主键约定之一

## 转换后的稳定不变量

1. 每个 `TCell` 都保留原始位置 `r` 和原始字符串 `s`。
2. 每个 `Field` 都保留原始定义位置 `location`。
3. `typename` 是声明类型，`realtype` 只在处理器需要时补充，不替代声明类型。
4. `ignore` 是运行时元数据，不等于“所有下游一定自动跳过”。

## 关于 `ignore` 的约束

`sheet.ignore`、`field.ignore` 和 `!ignore` 的语义不同：

- `sheet.ignore` / `field.ignore` 是运行时边界元数据，主要供类型生成和部分流程判断使用
- `!ignore` 是序列化层的字段忽略约定

当前内置 stringify 规则不会仅因为 `sheet.ignore=true` 就自动跳过整个 sheet；如果某个 processor 希望该 sheet 不再进入常规输出，应同时调整 `sheet.data` 或选用合适的 writer 逻辑。
