# SDD Workflow

Use this document as the agent workflow for Specification-Driven Development in this repository.

## Default Workflow

1. Decide whether the task is non-trivial.
2. If it is a bug fix, find the root cause before attempting a fix. Do not debug by random patching.
3. Read `docs/spec-driven-development.md`.
4. Read `docs/spec/README.md` and identify the affected baseline specs.
5. Create or update a work-item spec under `docs/spec/` before implementation.
6. Keep the work-item spec synchronized while code changes.
7. If the result becomes a new lasting rule, update the affected numbered baseline specs in the same change.
8. Verify against the work-item acceptance criteria before considering the change complete.

## Work-Item Location

Put work-item specs directly under:

```text
docs/spec/<short-slug>.md
```

Use lowercase kebab-case slugs such as:

- `docs/spec/editor-selection-regression.md`
- `docs/spec/save-lifecycle-regression.md`

## Baseline vs Work-Item

- Numbered files in `docs/spec/` are long-lived baseline specs.
- Non-numbered kebab-case files in `docs/spec/` are work-item specs for concrete changes.

When a task changes durable behavior or boundaries, update both:

1. The work-item spec
2. The affected baseline spec

## Required Rule

Do not start broad implementation until you can point to the relevant work-item spec.
For bug fixes, do not start patching until you can explain the suspected or confirmed root cause.

Small mechanical changes may skip a dedicated work-item spec, but if the task grows, add one before continuing.
