# Claude Instructions

For `.xlsx` tasks, use [.claude/skills/fastxlsx/SKILL.md](.claude/skills/fastxlsx/SKILL.md).

For non-trivial code, product behavior, architecture, protocol, persistence, or test changes, use [.agents/skills/spec-driven-development/SKILL.md](.agents/skills/spec-driven-development/SKILL.md).

Prefer the `fastxlsx` CLI over direct workbook XML edits. Inspect before writing, validate after writing, and prefer `--profile` when `table-profiles.json` exists.

Keep this file as a thin Claude Code routing hook. Put detailed Claude Code workflow updates in `.claude/skills/fastxlsx/`.
