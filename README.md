# TypedSheet

将遵循固定表头约定的 `.xlsx` 工作簿转换为可校验的数据模型，并按需输出为 JSON、TypeScript、Lua 等文件。

项目内置：

- `.xlsx` 读取与多 Sheet 处理，底层基于 `fastxlsx`
- 多 writer 输出管线，可同时生成 client / server 结果
- 类型转换、索引校验、表达式校验、长度校验等能力
- `define`、`config`、`map`、`collapse`、`column`、`typedef` 等处理器
- TypeScript / Lua 类型生成、workbook indexer、Zod schema 辅助能力

## 安装

仓库内开发：

```bash
npm i
```

常用命令：

```bash
npm run check
npm run test
```

## 文档与 SDD

仓库内的设计与开发机制文档放在 [docs/README.md](docs/README.md)。

- [docs/spec-driven-development.md](docs/spec-driven-development.md)
  当前仓库的 Specification-Driven Development 工作流
- [docs/spec/README.md](docs/spec/README.md)
  基线 spec 地图、阅读顺序与 work-item 约定

## 快速开始

最小接入流程只有两步：

1. 注册一个或多个 writer，定义不同 `processor` 的输出行为。
2. 调用 `build()` 读取工作簿并触发转换、校验和输出。

```ts
import * as xlsx from "typedsheet";

const OUTPUT_DIR = "output";

xlsx.registerWriter("client", (workbook, processor, data) => {
    if (processor === "define") {
        const defineName = String(data["!name"] ?? workbook.name);
        const exportName = xlsx.toPascalCase(defineName);
        xlsx.writeFile(
            `${OUTPUT_DIR}/client/define/${defineName}.ts`,
            xlsx.stringifyTs(data, {
                indent: 4,
                marshal: `export const ${exportName} = `,
            })
        );
        return;
    }

    if (processor === "stringify") {
        xlsx.writeFile(
            `${OUTPUT_DIR}/client/data/${workbook.name}.json`,
            xlsx.stringifyJson(data, { indent: 2 })
        );
        return;
    }

    if (processor === "gen-type") {
        const content = xlsx.genTsType(workbook, (typename) => ({ type: typename }));
        xlsx.writeFile(`${OUTPUT_DIR}/client/types/${workbook.name}.ts`, content);
        return;
    }

    if (processor === "typedef") {
        const typedefWorkbook = data as xlsx.TypedefWorkbook;
        const content = xlsx.genTsTypedef(typedefWorkbook, (typename) => ({
            type: typename,
        }));
        if (content) {
            xlsx.writeFile(
                `${OUTPUT_DIR}/client/types/${workbook.name}.${typedefWorkbook.sheet}.ts`,
                content
            );
        }
    }
});

xlsx.registerWriter("server", (workbook, processor, data) => {
    if (processor === "stringify") {
        xlsx.writeFile(
            `${OUTPUT_DIR}/server/data/${workbook.name}.lua`,
            xlsx.stringifyLua(data, {
                indent: 4,
                marshal: "return ",
            })
        );
        return;
    }

    if (processor === "gen-type") {
        const content = xlsx.genLuaType(workbook, (typename) => ({ type: typename }));
        xlsx.writeFile(`${OUTPUT_DIR}/server/types/${workbook.name}.lua`, content);
    }
});

await xlsx.build(["test/res/item.xlsx", "test/res/task.xlsx", "test/res/typedef.xlsx"]);
```

完整示例见 [test/test.ts](test/test.ts)。

## 工作流程

`build(files, headerOnly?)` 的主流程如下：

1. 读取每个工作簿的表头与数据。
2. 执行 `after-read`、`pre-parse`、`after-parse` 等阶段处理器。
3. 按已注册 writer 克隆上下文，并根据导出列过滤字段。
4. 解析并执行所有 checker。
5. 执行 `pre-stringify`、`stringify`、`after-stringify` 阶段处理器。
6. 在对应阶段触发 writer 回调。

如果只需要读取表头，可传入 `true`：

```ts
await xlsx.build(["test/res/item.xlsx"], true);
```

## Excel 结构约定

### 表头布局

如果第一行是 processor 行，Sheet 结构如下：

| 行号 | 含义         | 示例                                     |
| ---- | ------------ | ---------------------------------------- |
| 1    | Sheet 处理器 | `@define;@stringify(merge)`              |
| 2    | 字段名       | `id`, `name`, `reward`                   |
| 3    | 字段类型     | `int`, `string`, `item[]`, `@value_type` |
| 4    | writer 过滤  | `client`, `server`                       |
| 5    | checker      | `@size(3)`, `item#item.id`, `$ >= 1`     |
| 6    | 注释         | 任意字段说明                             |
| 7+   | 数据行       | 实际业务数据                             |

如果没有 processor 行，则第 1 行直接是字段名，数据从第 6 行开始。

### 常见规则

- 第一列默认会被当作主键列。
- writer 行留空表示对所有已注册 writer 生效。
- writer 行写 `x` 表示该列完全不导出。
- 多 writer 使用 `|` 分隔，例如 `client|server`。
- 类型后缀 `?` 表示可选，例如 `string?`。
- 数组类型支持 `int[]`、`string[2]`、`int[][]`。
- 类型写成 `@fieldName` 时，表示“当前行另一个字段的值决定真实类型”。
- 第一列常见写 `>>`、`!!!`、`###` 作为视觉标记，解析时会忽略这些约定符号。

### Sheet 示例

```text
@define;@stringify(merge)
id      name    reward      reward_type  tags
int     string  @reward_type string      int[]
>>      client  client      x            client|server
!!!     x       item#item.id x           @size(3)
###     ID      名字        奖励         奖励类型      标签
1       sword   [1001,2]    item         [1,2,3]
```

## 内置类型

| 类型     | 说明                                               |
| -------- | -------------------------------------------------- |
| `int`    | 整数                                               |
| `float`  | 浮点数                                             |
| `bool`   | 布尔值                                             |
| `string` | 字符串                                             |
| `json`   | JSON / JSON5 字符串                                |
| `table`  | Lua table 风格字符串，如 `{1,2}`、`{id=1,count=2}` |
| `auto`   | 自动行号，单元格需填 `-`，解析后按数据行序号生成   |

补充规则：

- `?` 表示可选，如 `string?`、`int[]?`。
- `[n]` 表示定长数组，如 `int[3]`。
- `[]` 表示动态数组，支持多维。
- 可通过 `registerType()` 注册自定义类型。

## 内置处理器

| 处理器                         | 阶段            | 作用                                                                           |
| ------------------------------ | --------------- | ------------------------------------------------------------------------------ |
| `@define`                      | `pre-stringify` | 将定义表转换为对象，并以 `define` 事件直接交给 writer                          |
| `@config`                      | `pre-stringify` | 将 `key/value/value_type/value_comment` 表转换为配置对象，参与后续 `stringify` |
| `@map(value, ...keys)`         | `pre-stringify` | 将行数据重组为多级 map                                                         |
| `@collapse(...keys)`           | `pre-stringify` | 按 key 折叠为多级数组结构                                                      |
| `@column(idxKey, ...foldKeys)` | `pre-stringify` | 按主键聚合多行，并将指定列折叠为数组                                           |
| `@stringify(rule)`             | `stringify`     | 使用某个 stringify 规则输出工作簿数据                                          |
| `@typedef`                     | `after-read`    | 读取 typedef sheet、注册类型，并在后续触发 `typedef` 事件                      |
| `@gen-type`                    | `stringify`     | 触发类型生成事件，通常在 writer 中调用 `genTsType` / `genLuaType`              |

内置 required processors 会自动补齐到工作簿中，因此通常不需要手动声明：

- `@stringify`
- `@gen-type`
- `@auto-register`

### 内置 stringify 规则

| 规则     | 说明                                        |
| -------- | ------------------------------------------- |
| `simple` | 默认规则，输出 `{ [sheetName]: sheetData }` |
| `merge`  | 将所有 sheet 的行合并到同一个对象中         |

自定义规则：

```ts
xlsx.registerStringifyRule("task", (workbook) => {
    const result: Record<string, unknown> = {};
    for (const sheet of workbook.sheets) {
        result[sheet.name] = sheet.data;
    }
    return result;
});
```

## Checker 说明

常用写法

- `x`
  关闭当前列检查。
- `!@Checker(...)`
  给 checker 加 `!` 前缀后，即使单元格为空也会执行检查。
- `[1,2,3]`
  范围检查，值必须命中数组中的某一项。
- `$ >= 1 && $ <= 9`
  表达式检查，`$` 表示当前单元格的值。
- `@size(10)`
  当前值必须是数组，且长度为 `10`。
- `@oneof(checker1, checker2, ...)`
  参数里的每一项都是一个完整 checker，只要其中任意一项通过，整体就通过。
- `@follow(field)`
  如果目标列有值，则当前列也必须有值；如果目标列为空，当前列也必须为空。
- `@unique`
  当前列的值在同一 Sheet 中必须唯一。

### 索引检查

索引检查以 `#` 为核心操作符，用于验证“当前单元格的值”或“从当前单元格里取出的子值”能否在目标表中找到。

速查语法：

```text
[文件]#[Sheet].[列][&目标过滤器]
$[取值路径][&行过滤器]==[文件]#[Sheet].[列][&目标过滤器]
[文件]#
$[取值路径]==[文件]#
```

基础规则：

- 文件名可省略，省略时表示当前工作簿；省略 `.xlsx` 后缀会自动补齐。
- `#` 右侧的 `Sheet` 可写 `*`，表示任意 Sheet。
- 不写左侧时，默认直接拿“当前单元格值”去查。
- 左侧 `$...==` 表示“先从当前单元格里取值，再拿这些值去查”。
- 左侧 `&...` 是“行过滤器”，不命中时本次检查直接跳过并视为通过。
- 右侧 `&...` 是“目标过滤器”，用于限定目标表中哪些行可以参与匹配。
- checker 之间仍然用 `;` 分隔。

左侧路径里的 `$` 表示当前单元格值，支持：

- `$.field`
- `$[0]`
- `$[*]`
- `$[.]`
- `?` 可选访问，例如 `$.star?`、`$[1]?`

快速示例：

```text
#branch.id
item#item.id
task#*.id
#define.value&key1=TASK_TYPE
$[*]==#branch.id
$[*].id==item#item.id
$[.]==#technology.tech_id
$&key1=COLLECTION_ITEM_ID==item#item.id
$[0]==battle_skill#skill.id&lv=$[1]
$.star?==hero#hero_star.star;$.stage?==hero#hero_stage.stage_parameter
```

完整语法、执行原理和更多例子见下方“检查器详细语法（附录）”。

### 路径表达式

常见路径示例：

```text
$.rewards[*].item_id
$.config.targets[0]
$.attrs?[*][0]
$.meta.code
$[1]?
```

`@oneof(...)` 常见示例：

```text
@oneof(item#item.id, task#task.id)
@oneof($[*]==item#item.id, $[*]==equip#equip.id)
```

## typedef

`@typedef` 用于把某个 Sheet 声明为类型定义源，并自动注册对应 converter。

typedef Sheet 至少需要这些字段：

- `comment`
- `key1`
- `key2`
- `value_type`
- `value_comment`

行为说明：

- `key1` 表示类型名。
- `key2` 表示字段名；如果包含 `|`，则会被解析为 union 成员列表。
- `value_type` 表示字段类型，支持引用内置类型、已有 typedef，或字面量类型（如 `#1`、`#FOO`）。
- `typedef` 会在 writer 中以 `processor === "typedef"` 的形式出现，可配合 `genTsTypedef()` / `genLuaTypedef()` 输出。

相关 API：

- `genTsTypedef()`
- `genLuaTypedef()`
- `getTypedefWorkbook()`
- `getTypedef()`

## 常用 API

### 核心入口

| API                                          | 说明                      |
| -------------------------------------------- | ------------------------- |
| `build(files, headerOnly?)`                  | 读取工作簿并执行完整管线  |
| `registerWriter(name, writer)`               | 注册 writer               |
| `registerType(name, converter)`              | 注册自定义类型            |
| `registerChecker(name, parser)`              | 注册自定义 checker        |
| `registerProcessor(name, processor, option)` | 注册自定义处理器          |
| `registerStringifyRule(name, rule)`          | 注册自定义 stringify 规则 |

### 输出与文件

| API               | 说明                     |
| ----------------- | ------------------------ |
| `stringifyJson()` | 序列化为 JSON            |
| `stringifyLua()`  | 序列化为 Lua             |
| `stringifyTs()`   | 序列化为 TypeScript 常量 |
| `writeFile()`     | 直接写文件               |
| `writeJson()`     | 写 JSON 文件             |
| `writeLua()`      | 写 Lua 文件              |
| `writeTs()`       | 写 TypeScript 文件       |

### 类型与工具

| API                    | 说明                                     |
| ---------------------- | ---------------------------------------- |
| `genTsType()`          | 为单个 workbook 生成 TypeScript 行类型   |
| `genLuaType()`         | 为单个 workbook 生成 Lua 注解类型        |
| `genTsTypedef()`       | 为 typedef workbook 生成 TypeScript 类型 |
| `genLuaTypedef()`      | 为 typedef workbook 生成 Lua 类型        |
| `genXlsxType()`        | 为整个 context 生成汇总 TypeScript 类型  |
| `genWorkbookIndexer()` | 生成 workbook 查询器                     |
| `tsToZod()`            | 将 TypeScript 类型文件转成 Zod schema    |

## 自定义扩展

### 自定义类型

```ts
xlsx.registerType("item", (raw) => {
    const [id, count] = xlsx.convertValue(raw, "json") as [number, number];
    return { id, count };
});
```

### 自定义 checker

```ts
xlsx.registerChecker("Positive", () => {
    return ({ cell }) => typeof cell.v === "number" && cell.v > 0;
});
```

Excel 中可这样使用：

```text
@Positive
```

### 自定义 processor

```ts
xlsx.registerProcessor(
    "post_stringify",
    async (workbook) => {
        console.log("after stringify:", workbook.path);
    },
    {
        stage: "after-stringify",
        required: true,
        priority: 999,
    }
);
```

说明：

- `required: true` 表示该 processor 会自动挂到工作簿上。
- `priority` 数值越小越早执行。

## 项目结构

- [index.ts](index.ts)
  默认公共入口，注册内置类型、checker、processor，并导出运行时 API 与工具能力。
- [src/xlsx.ts](src/xlsx.ts)
  运行时总入口，负责解析流程调度与公共 re-export。
- [src/core/](src/core)
  workbook/context、registry、parser、pipeline 等核心基础设施。
- [src/builtins/](src/builtins)
  内置 checker、converter、processor。
- [src/transforms/sheet.ts](src/transforms/sheet.ts)
  sheet 级数据重组与 typedef 转换。
- [src/typedef.ts](src/typedef.ts)
  typedef 注册与 TS / Lua 类型生成。
- [test/](test)
  端到端示例、回归测试和生成结果样例。

## 检查器详细语法（附录）

### 高级索引查询（索引检查器）

这一节展开说明 `#...` / `$...==#...` 这套查询语法。核心目标只有一个：把一个或多个“源值”解析出来，再去目标工作簿里做存在性匹配。

#### 基础语法

##### 1. 直接拿当前单元格值去查

```text
[文件]#[Sheet].[列][&目标过滤器]
```

示例：

```text
#branch.id
item#item.id
task#*.id
#define.value&key1=TASK_TYPE
```

##### 2. 先从当前单元格里取值，再去查

```text
$[取值路径][&行过滤器]==[文件]#[Sheet].[列][&目标过滤器]
```

示例：

```text
$[*]==#branch.id
$[*].id==item#item.id
$[.]==#technology.tech_id
$[0]==battle_skill#skill.id&lv=$[1]
$.star?==hero#hero_star.star
```

##### 3. 只在满足当前行条件时才查

```text
$[取值路径][&行过滤器]==[文件]#[Sheet].[列][&目标过滤器]
```

示例：

```text
$&key1=COLLECTION_ITEM_ID==item#item.id
$.reward_id&kind=ITEM==item#item.id
$.skill_id&kind=SKILL==battle/battle_skill#skill.id
```

##### 4. 检查目标工作簿里是否存在某个 Sheet

```text
[文件]#
$[取值路径]==[文件]#
```

示例：

```text
task#
$[.]==ui_config#
$.tabs[*]==panel#
```

#### 基础语法元素

- `#`
  指定目标工作簿 / Sheet / 列，例如 `item#item.id`
- `==`
  分隔“源值提取”和“目标查询”，例如 `$[*].id==item#item.id`
- `$`
  表示当前单元格值，例如 `$.reward.id`
- `.field`
  读取对象属性，例如 `$.meta.code`
- `[0]`
  读取数组第 `0` 个元素，例如 `$[0]`
- `[*]`
  展开数组全部元素，例如 `$[*].id`
- `[.]`
  取对象全部键名，例如 `$[.]`
- `?`
  可选访问，不存在时跳过，例如 `$.star?`、`$[1]?`
- `&field=literal`
  使用字面量做过滤，例如 `#main.id&type=MAIN`
- `&field=@otherField`
  使用当前行另一个字段的值做过滤，例如 `#main.id&kind=@kind`
- `&field=$path`
  使用当前单元格里的子路径结果做过滤，例如 `#skill.id&lv=$[1]`
- `*`
  表示任意 Sheet，例如 `task#*.id`
- 省略文件名
  表示当前工作簿，例如 `#branch.id`
- 省略左侧
  表示直接使用当前单元格值，例如 `item#item.id`

#### 执行原理

##### 1. 先决定“源值”是什么

- 如果没有左侧 `$...==`，就直接拿当前单元格值去查。
- 如果写了 `$...==`，就先从当前单元格值里按路径取值。
- 路径最终产出的每一个值都必须是 `string` 或 `number`；如果最后还是对象或数组，会报类型错误。

##### 2. 再判断行过滤器是否命中

- 左侧 `&...` 是“当前行守卫条件”。
- 只有这些条件全部命中，才会继续去目标表查询。
- 只要有一个条件不命中，本次检查会直接跳过，并视为通过。

示例：

```text
$&key1=COLLECTION_ITEM_ID==item#item.id
```

上面这条的含义是：只有当前行的 `key1` 等于 `COLLECTION_ITEM_ID` 时，才检查当前单元格里的值是否存在于 `item#item.id`。

##### 3. 然后构造目标索引

- 目标部分是 `[文件]#[Sheet].[列]`。
- 文件名可省略 `.xlsx` 后缀，运行时会自动补齐。
- `Sheet` 可以写 `*`，表示在目标工作簿的任意 Sheet 中查这一列。

##### 4. 最后应用目标过滤器

- 右侧 `&...` 是“目标行过滤器”。
- 只有目标表中满足这些过滤条件的行，才参与匹配。
- 过滤器值支持三种来源：
    - 字面量：`type=MAIN`
    - 当前行字段：`kind=@kind`
    - 当前单元格子路径：`lv=$[1]`

##### 5. 多值查询按“全部命中”处理

- `$[*]`、`$[*].id`、`$[.]` 这类路径可能会展开出多个值。
- 展开的每一个值都必须在目标索引中找到，只要有一个找不到，整个 checker 就失败。

#### 过滤器规则

过滤器统一写成 `&字段=值`，左右两侧都支持，多个条件之间用 `&` 连接。

规则说明：

- 左侧过滤器匹配“当前行”的字段。
- 右侧过滤器匹配“目标表”的字段。
- 字面量会按对应字段类型自动转换后再比较，例如 `part=1` 会按 `part` 列的真实类型转换。
- `@field` 取的是“当前行另一个字段”的值，不是当前单元格值。
- `$path` 取的是“当前单元格里的子路径值”，并且这里必须最终只解析出一个标量。

合法示例：

```text
#main.id&type=MAIN
#main.id&kind=@kind
$[0]==battle_skill#skill.id&lv=$[1]
$.id==#refs.id&group=$.group
$&kind=ITEM==item#item.id
$&kind=@kind==item#item.id
```

#### 路径规则

路径里的 `$` 永远表示“当前单元格值”，不是当前行。

常见路径：

```text
$.id
$.rewards[*].item_id
$.config.targets[0]
$[*][0]
$[.]
$.star?
$[1]?
$.attrs?[*][0]
```

说明：

- `.field` 适合对象。
- `[n]` 适合数组。
- `[*]` 会展开数组所有元素。
- `[.]` 会把对象的所有键名取出来。
- `?` 只对 `.field?` 和 `[n]?` 这种“可能不存在”的访问有意义。

#### 使用示例

##### 1. 最常见：普通外键检查

```text
# 当前工作簿
#branch.id
#define.value

# 跨工作簿
item#item.id
hero#hero.id
monster#troop.id
asset#assets.id
price#price.cny

# 跨目录
battle/battle_skill#skill.id
battle/battle_npc#npc.id
battle/battle_pve_map#transfer.id
```

##### 2. 任意 Sheet 通配

```text
task#*.id
open_func#*.id
item#*.id
```

##### 3. 直接用目标过滤器缩小查询范围

```text
#define.value&key1=TASK_TYPE
#define.key2&key1=SKILL_TAG
equipment#equipment.id&part=1
equipment#equipment.id&part=2
equipment#equipment.id&part=6
task#*.id&type=MAIN
```

##### 4. 从对象里取一个字段再查

```text
$.id==item#item.id
$.task_id==task#main.id
$.code==#define.key2&key1=SKILL_TAG
$.reward.item_id==item#item.id
$.meta.attr_id==attr#attr.id
```

##### 5. 从数组里取值再查

```text
$[*]==#branch.id
$[*]==activity/battle_pass#task.task_id
$[*]==battle/battle_skill#action.id
$[*].id==item#item.id
$[*][0]==attr#attr.id
$[0]==skill#skill.id
```

##### 6. 用对象键名做查询

```text
$[.]==#technology.tech_id
$[.]==ui_panel#panel.id
$[.]==#define.key2&key1=SKILL_TAG
```

##### 7. 可选路径：字段不存在时跳过

```text
$.star?==hero#hero_star.star
$.stage?==hero#hero_stage.stage_parameter
$.attrs?[*][0]==attr#attr.id
$.higher_attrs?[*][0]==attr#higher_attr.id
$.reward_list?[0]?==reward#reward.id
```

##### 8. 左侧行过滤器：只在特定行上启用检查

```text
$&key1=COLLECTION_ITEM_ID==item#item.id
$&type=MAIN==task#main.id
$.reward_id&kind=ITEM==item#item.id
$.skill_id&kind=SKILL==battle/battle_skill#skill.id
$.func_id&group=JUMP==open_func#func.id
```

##### 9. 右侧目标过滤器：用目标表字段继续约束

```text
#main.id&type=MAIN
#main.id&kind=@kind
#main.id&group=SHOP&enabled=true
$.id==#refs.id&group=A
$.id==#refs.id&group=$.group
$[0]==battle_skill#skill.id&lv=$[1]
```

##### 10. 同时使用左侧和右侧过滤器

```text
$&kind=ITEM==item#item.id&type=NORMAL
$.id&kind=TASK==task#main.id&type=@task_type
$.skill_id&scene=PVE==battle/battle_skill#skill.id&lv=$.skill_lv
```

##### 11. 一个字段拆成多个 checker

```text
$.star?==hero#hero_star.star;$.stage?==hero#hero_stage.stage_parameter
$.higher_attrs?[*][0]==attr#higher_attr.id;$.attrs?[*][0]==attr#attr.id
$[*].id==item#item.id;$[*].count==item_count#define.value&key1=COUNT_RULE
```

##### 12. 过滤器值引用当前行其他列

```text
#main.id&kind=@kind
#main.id&group=@group
$.id==reward#reward.id&quality=@quality
$&kind=@kind==item#item.id
```

##### 13. 过滤器值引用当前单元格内部数据

```text
$[0]==battle_skill#skill.id&lv=$[1]
$.id==reward#reward.id&group=$.group
$.attr_id==attr#attr.id&type=$.attr_type
```

##### 14. Sheet 存在性检查

```text
task#
ui_panel#
$==task#
$[.]==ui_panel#
$.tabs[*]==panel#
```

#### 常见等价写法

下面两种写法效果一致，第二种只是把“当前单元格值”显式写出来：

```text
item#item.id
$==item#item.id
```

同理：

```text
#branch.id
$==#branch.id
```

#### 常见坑

- `$` 表示当前单元格值，不表示整行。
- 左侧过滤器和右侧过滤器不是一回事：左侧控制“要不要查”，右侧控制“去目标表里查哪些行”。
- `$.meta==#item.id` 这类写法如果 `meta` 最终是对象而不是字符串/数字，会报类型错误。
- 过滤器里的 `$path` 必须只解析出一个值，所以 `lv=$[1]` 合法，但像 `lv=$[*]` 这种会报错。
- `?` 适合可选属性和可选下标访问；如果字段本来一定存在，不需要滥用。

#### `!@checker`

所有检查器前缀带 `!`，就表明不管当前单元格有没有值，都要执行检查。

## 许可证

MIT
