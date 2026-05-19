# Implementation Plan

## 目标

本文件记录当前基线已经落地的主线，以及未来继续做跨层改动时建议遵守的推进顺序。

## 当前实现基线

当前代码已经完成以下主线：

### 阶段 0：公共入口与 builtins 固化

- `index.ts`
- `registerBuiltins()`
- 基础 converter / checker / processor / stringify 规则注册

### 阶段 1：Workbook 与 parser 模型

- `Context` / `Workbook` / `Sheet` / `Field` / `TCell`
- header 解析
- body 读取
- 动态类型、`auto`、refer 绑定

### 阶段 2：构建管线与 writer fanout

- `build()`
- processor stage 调度
- `copyWorkbook()`
- writer 过滤视图

### 阶段 3：校验与 typedef

- checker parser 与执行
- typedef workbook 注册
- nested typedef checker
- 聚合错误输出

### 阶段 4：输出与工具

- stringify
- TS / Lua 类型生成
- workbook indexer
- TS to Zod

### 阶段 5：回归基线

- `test/test.ts`
- regression / checker / project / typedef / infrastructure 测试

## 未来继续演进时的推荐顺序

对跨层行为改动，推荐仍按以下顺序推进：

1. spec 与 acceptance
2. workbook / header / data model
3. pipeline stage / context lifecycle / writer fanout
4. checker / typedef / error format
5. output / tooling / generated artifact contract
6. tests / docs / example sync

## 实现期间强约束

1. 不要在没有 spec 的情况下调整 `build()` 阶段顺序。
2. 不要把 writer 输出副作用散落到 pipeline 之外。
3. 不要让新的扩展点绕过 registry。
4. 不要默默增加新的全局状态或会话生命周期假设。
5. 不要把 checker 或 typedef 的错误定位信息“简化”到无法追查。

## 发生跨层改动时的最低交付顺序

### 1. 先改 spec

- 新建或更新 work-item spec
- 必要时同步相关编号基线 spec

### 2. 再改共享边界

- header 规则
- 数据模型
- stage 顺序
- 注册契约

### 3. 再改运行时

- parser
- pipeline
- writer fanout
- checker / typedef

### 4. 最后改输出与工具

- stringify
- 类型生成
- indexer / Zod
- README 示例

## 最低回归要求

只要涉及以下任一方面，就至少需要整体验证一轮：

- parser / header 规则
- `build()` 生命周期
- processor 优先级或 required 行为
- writer 过滤或输出事件
- checker / typedef / nested checker
- 生成代码或 Zod 输出

最低验证命令：

```bash
npm run check
npm run test
```

## 完成标准

对未来任一非 trivial 改动，若遵守本文件顺序，最终应满足：

- spec、实现和回归基线同步更新
- 行为变化能定位到具体编号 spec 或 work-item
- 全局生命周期和扩展契约不会因为局部 patch 而进一步变得隐式
