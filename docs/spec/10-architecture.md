# Architecture

## 总体结构

第一遍阅读时，先按四层理解当前实现：

| 层 | 代码入口 | 主要职责 |
| --- | --- | --- |
| Public API / bootstrap | `index.ts`, `src/register-builtins.ts` | 暴露公共 API，注册内置类型、checker、processor 和 stringify 规则 |
| Core runtime | `src/xlsx.ts`, `src/core/` | workbook 读取、context 管理、parser、阶段调度、checker 执行 |
| Builtins / transforms | `src/processors/`, `src/checkers/`, `src/converters/` | 内置 sheet 变换、checker 解析、converter 与类型语义 |
| Tooling / output | `src/stringify.ts`, `src/indexer.ts`, `src/tooling/`, `src/io.ts`, `test/` | 序列化、类型生成、Zod 转换、文件输出与回归验证 |

这四层是阅读模型，不是独立进程边界。真实运行时仍受下面的职责规则约束。

## 层职责

### Public API / bootstrap

职责：

- 作为外部唯一稳定入口导出 runtime、core、processor 和 tooling 能力
- 在首次导入时注册 builtins，避免调用方手工补装基础能力
- 为调用方保留注册自定义类型、checker、processor、writer 的能力

约束：

- 入口层不直接持有 workbook 数据
- builtins 注册应保持幂等

### Core runtime

职责：

- `Context` / `Workbook` 管理运行期数据容器
- parser 负责 header / body 解析与 cell 转换
- pipeline 负责阶段执行、writer fanout、checker 解析和聚合错误
- `build()` 组织完整生命周期

约束：

- 当前 context、registry、typedef 状态都是进程级单例
- `build()` 不是并发安全的多租户会话层；生命周期相关变更必须明确设计

### Builtins / transforms

职责：

- 提供内置 converter、checker parser 和 processor
- 在不同阶段把 sheet 数据从“原始行表”变换为定义对象、配置对象、多级 map、折叠数组等结构
- 支撑 typedef 注册、writer 输出和类型生成

约束：

- built-in processor 必须声明阶段和优先级
- 早期阶段 processor 运行在默认 writer context；后期阶段运行在 writer 克隆后的上下文

### Tooling / output

职责：

- 提供 JSON / Lua / TS 序列化
- 生成 workbook 行类型、typedef 类型、indexer 和 Zod schema
- 把 writer 输出落盘
- 用回归测试守住行为基线

约束：

- library 不替调用方规定输出目录结构
- writer 是输出副作用的唯一权威入口

## 关键组件

### `build()`

- 创建默认 context
- 为每个输入文件挂接 workbook
- 读取 workbook 数据
- 驱动 processor、value conversion、writer fanout、checker 和输出

### `Context`

- 由 `writer + tag` 共同标识
- 持有多个 workbook
- 为 indexer、checker 和 processor 提供查找边界

### `Workbook`

- 以 path 为主身份
- 管理 sheet 集合
- 能按 writer 过滤规则克隆自己

### Parser

- 负责解释 processor 行、字段行、writer 行、checker 行和注释行
- 负责 body 读取和原始 cell 建模
- 负责把动态类型、`auto` 类型和 refer checker 绑定到运行时结构

### Pipeline

- 按阶段调用 processor
- 在 `after-parse` 之后克隆 writer context
- 解析 checker，并在 writer 视图上执行
- 聚合并抛出可定位错误

## 关键事件流

### 构建主线

1. 调用方注册 writer 和可选扩展
2. `build()` 创建默认 context，并登记所有 workbook
3. parser 读取 header / body
4. `after-read`、`pre-parse`、`after-parse` 运行在默认 context
5. `copyWorkbook()` 生成每个 writer 的克隆上下文
6. `pre-check`、checker 解析执行、`after-check` 运行在 writer context
7. `pre-stringify`、`stringify`、`after-stringify` 继续在 writer context 运行
8. writer 接收输出事件并执行文件写入或其他副作用

### 错误路径

1. parser 或 processor 一旦发现结构错误，会立刻抛错
2. checker 失败会在 writer 维度聚合，再统一抛错
3. typedef 字段 checker 会带上 typedef 来源和定义位置

## 架构约束

1. writer 输出不能绕过 `registerWriter()` / `output()` 契约。
2. 表头语义不能散落到业务 writer 中重复定义。
3. context、registry 和 typedef 的全局状态变化必须被明确设计，不允许默默增加新的隐式单例。
4. 任何 `build()` 阶段顺序调整都应同步更新 `docs/spec/12-build-pipeline.md` 和回归基线。
5. checker、typedef 和输出工具的错误格式要保持可定位，不要为了“简化”而丢位置信息。

## 当前目录落点

- `index.ts`
  - 公共入口和 builtins bootstrap
- `src/xlsx.ts`
  - 构建流程入口
- `src/core/`
  - contracts、registry、schema、parser、pipeline、workbook、conversion、errors
- `src/processors/`
  - 内置 sheet 变换与输出触发器
- `src/checkers/`
  - checker parser 和执行逻辑
- `src/converters/`
  - 基础类型转换
- `src/typedef.ts`
  - typedef 注册、解析和类型生成
- `src/stringify.ts`, `src/indexer.ts`, `src/tooling/`
  - 输出和开发者工具
- `test/`
  - 端到端与回归测试

## 架构验收标准

- 任一功能都能明确指出它属于哪一层、由谁拥有副作用
- 任一行为回归都能落回某个基线 spec 和测试样例
- 任一跨层改动都不会默默引入新的全局状态或隐式输出路径
