## Build Pipeline

### Planning (manual)
Run spec-kit commands in order:
1. `/speckit-constitution`
2. `/speckit-specify`
3. `/speckit-plan`
4. `/speckit-tasks`

### Design (automated)
Run `/design` to start the design/eval loop. The orchestrator reads spec-kit's task list and works through each sprint, verifying via Playwright after each one.

### Implementation (automated)
Run `/build` to start the dev/eval loop. The orchestrator reads spec-kit's task list and works through each sprint, verifying via Playwright after each one.

### Key directories
- `.speckit/` — spec-kit artifacts (PRD, plan, tasks)
- `pipeline/feedback/` — evaluator reports per sprint/cycle
- `pipeline/build-log.md` — full progress log

### Subagents
- **developer** — implements one sprint, follows plan.md
- **evaluator** — Playwright verification against spec.md acceptance criteria
- Both run in isolated context. Evaluator can't see developer's reasoning.
- **designer** — implements one sprint, follows plan.md
- **design-critique** — Playwright verification against spec.md acceptance criteria
- Both run in isolated context. Evaluator can't see developer's reasoning.
