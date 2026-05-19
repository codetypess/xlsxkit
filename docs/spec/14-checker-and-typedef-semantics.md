# Checker And Typedef Semantics

## 目标

本文件定义 checker 语法、执行语义、typedef 结构规则，以及二者交叉时的稳定行为。

## Checker 语法分类

### 1. 关闭或跳过

- `x`: 当前列不挂 checker
- 第一列以 `!!` 开头：按视觉标记跳过

### 2. 命名 checker

```text
@size(3)
@unique
@follow(other)
@refer(ruleField)
@oneof(item#main.id, equip#main.id)
```

规则：

- `@name(args...)` 由 registry 中的 checker parser 解释
- `@oneof(...)` 的每个分支必须单独解析成一个 checker

### 3. Range

```text
[1,2,3]
```

- 表示值必须落在字面量集合中

### 4. Sheet

```text
target#
$[.]==target#
```

- 用于判断目标 workbook 中是否存在指定 sheet 名

### 5. Index

```text
item#main.id
$[*]==item#main.id
$[0]==battle_skill#skill.id&lv=$[1]
$&kind=A==target#refs.id&group=B
```

- 用于值、子路径、数组元素或对象键在目标表中的存在性检查
- 文件名省略时，表示当前 workbook

### 6. Expr

```text
$ >= 1
$.length == arr1.length && enabled
```

- 其余不含 `#`、不以 `@` 或 `[]` 形式出现的 checker 默认按表达式解释

## Force 语义

任何 checker 前加 `!`，表示即使当前 cell 值为 `null` 也要执行。

例如：

```text
!@size(1)
```

默认情况下，普通 checker 在 `cell.v === null` 时会跳过。

## Refer 语义

`@refer(ruleField)` 的规则是：

1. `ruleField` 必须存在
2. `ruleField` 本身会被标记为 ignore
3. body 读取阶段按每一行的 `ruleField` 文本重新 `parseChecker()`
4. 实际执行时，refer 绑定出的 checker 按对应目标 cell 的位置运行

这允许不同数据行挂不同的规则。

## OneOf 语义

`@oneof(a, b, c)` 的语义是：

- 只要任一分支通过，整体通过
- 所有分支都失败时，错误里要能看出每个分支分别为什么失败

这类错误不能被压成单条模糊信息。

## Index / Sheet 路径语义

在左侧路径表达式里，`$` 表示当前单元格值：

- `$.id`: 对象属性
- `$[0]`: 数组下标
- `$[*]`: 数组全部元素
- `$[.]`: 对象全部键名
- `?`: 可选访问，不存在时跳过

过滤器通过 `&field=value` 拼接，可同时出现在行侧和列侧。

## Checker 错误格式

普通聚合错误至少包含：

- workbook path
- sheet name
- field name
- checker 源串
- 失败值列表

typedef 派生 checker 失败时，额外包含：

- `typedef: <来源链>`
- `defined: <typedef sheet location>`

## Typedef Sheet 契约

typedef sheet 至少要求这些字段：

- `comment`
- `key1`
- `key2`
- `value_type`
- `value_comment`

如果需要字段级 checker，可额外使用 `value_checker`。

## Typedef 结构语义

### Object

- `key1` 是类型名
- `key2` 是字段名
- `value_type` 是字段类型

### Union

- `key2` 含 `|` 时，表示 union 成员列表
- `value_type` 变成 discriminator 字段名
- union 成员必须都是 object typedef
- 每个成员都必须为 discriminator 提供 literal 字段

### Literal

- `#foo`、`#1` 表示字面量类型
- literal 字段不允许再带数组或 optional 后缀

## Typedef 注册与冲突规则

- typedef 以 `path#sheet` 为注册单元
- 同名 typedef 不能跨 workbook / sheet 重复定义
- 同一 workbook 若有多个 typedef sheet，读取时需要显式指明 sheet 名

## Typedef Converter 语义

注册后的 typedef converter 会：

1. 解析 JSON / JSON5 字符串
2. 解析 object 或 union 的最终目标类型
3. 递归转换每个字段
4. 拒绝缺少 required 字段、出现多余字段、literal 不匹配等情况

## Typedef Checker 递归语义

当业务字段的类型是 typedef，或者动态类型最终落到某个 typedef 时：

1. 运行时会递归解析目标 object / union
2. 若 typedef 字段自身声明了 checker，则会为该字段构造 synthetic cell / field 再执行 checker
3. 若子字段还是 typedef，会继续递归

因此，typedef 不是“只做类型转换”的机制，它也能携带深层校验语义。

## 设计约束

1. 新增 checker 语法时，必须同时定义 parser 规则、错误输出和与 `!` / `@oneof` / refer 的交互。
2. 新增 typedef 语义时，必须说明它如何影响 converter、类型生成和 nested checker。
3. 任何会改变现有错误格式的改动，都应被视为行为变更，而不是纯内部重构。
