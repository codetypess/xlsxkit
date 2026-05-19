# Docs Index

`docs/` 是当前仓库的文档入口，主要服务两类场景：

- 想快速理解 `typedsheet` 的产品边界、管线语义和扩展点
- 想按 Specification-Driven Development 流程推进非 trivial 改动

## 快速入口

- [../README.md](../README.md): 面向使用者的总览、快速开始与 API 示例
- [spec-driven-development.md](spec-driven-development.md): 本仓库的 SDD 工作流说明
- [spec/README.md](spec/README.md): 基线 spec 地图、阅读顺序与 work-item 约定

## 文档分层

- `docs/spec/01*`、`02*`、`10*`、`90*`: 长期有效的基线 spec，定义产品范围、验收行为、架构和实施顺序
- `docs/spec/<slug>.md`: 面向具体任务的 work-item spec，只在当前存在非 trivial 进行中任务时出现

历史上已完成或已废弃的 work-item 不默认长期保留；需要追溯时，优先看对应基线 spec 或 git history。

## 推荐阅读方式

- 第一次进入仓库：先读 [../README.md](../README.md)，再读 [spec/README.md](spec/README.md)
- 准备改 parser / processor / checker / typedef / writer：先读 [spec-driven-development.md](spec-driven-development.md)，再按 [spec/README.md](spec/README.md) 找到受影响的基线 spec
- 只做文案修正、注释修正或局部机械整理：通常不需要新增 work-item；如果范围扩大，再补回 SDD
