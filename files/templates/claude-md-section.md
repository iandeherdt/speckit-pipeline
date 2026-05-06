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
- `specs/<latest-branch>/` — spec-kit artifacts (spec, plan, tasks) — always use the highest-numbered subfolder under `specs/`
- `pipeline/feedback/` — evaluator reports per sprint/cycle
- `pipeline/build-log.md` — full progress log
- `pipeline/traces/` — JSONL traces of build/design runs (read with `node .claude/scripts/trace-summarise.mjs pipeline/traces/<file>.jsonl`)
- `pipeline/environment-facts.md` — cached project facts (test command, dev server, DB path) — written by developer/evaluator on cycle 1, read first on later cycles
- `pipeline/procedures.md` — cached UI flows (login, logout, cookie consent dismissal) — written by evaluator/critic on first encounter, read first on later cycles

### Subagents
- **developer** — implements one sprint, follows plan.md
- **evaluator** — Playwright verification against spec.md acceptance criteria
- Both run in isolated context. Evaluator can't see developer's reasoning.
- **designer** — implements one sprint, follows plan.md
- **design-critique** — Playwright verification against spec.md acceptance criteria
- Both run in isolated context. Evaluator can't see developer's reasoning.
