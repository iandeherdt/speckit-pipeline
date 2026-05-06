# speckit-pipeline

Build and design pipeline extension for [spec-kit](https://github.com/iandeherdt/spec-kit) projects. Automates multi-agent workflows that implement and verify user stories through iterative loops — design/critique and dev/eval — with real browser verification via Playwright MCP.

## What it does

speckit-pipeline installs specialized Claude Code agents and skills into your spec-kit project:

**Design loop** (`/design`) — A designer agent creates HTML/CSS prototypes for each view in your spec, then a design-critic agent evaluates them in a real browser, scoring against a rubric. The loop iterates until the designs pass.

**Build loop** (`/build`) — A developer agent implements sprint tasks from your spec-kit plan, then an evaluator agent verifies the implementation in a real browser against acceptance criteria. The loop iterates until each sprint passes.

Both loops produce structured feedback in `pipeline/feedback/` and log progress to `pipeline/build-log.md`.

## Agents

| Agent | Role |
|-------|------|
| **designer** | Creates production-grade HTML/CSS prototypes, reusing existing components and patterns for consistent UX across similar pages |
| **design-critique** | Evaluates prototypes in-browser across breakpoints, scores on design quality, originality, craft, functionality, and cross-page consistency |
| **developer** | Implements user stories with test-first development, enforcing code quality and design fidelity |
| **evaluator** | Verifies implementations end-to-end in a real browser, writes actionable feedback with severity levels |

## Prerequisites

- A [spec-kit](https://github.com/iandeherdt/spec-kit) project (with `.specify/integration.json`)
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code)
- Node.js >= 18

## Installation

```bash
npx speckit-pipeline init
```

This will:
- Install agents to `.claude/agents/`
- Install skills to `.claude/skills/`
- Install helper scripts to `.claude/scripts/` — trace hook, trace summariser, env-facts verifier, dev-server starter
- Merge launch configs into `.claude/launch.json` (dev server on port 3000, design server on port 4444)
- Add required permissions and trace hooks to `.claude/settings.json` (including `mcp__playwright__*`)
- Add Playwright MCP server at project scope (for browser-based verification)
- Append pipeline documentation to `CLAUDE.md`
- Install an opinionated constitution to `.specify/memory/constitution.md`
- Create `pipeline/feedback/` for evaluator reports
- Create `pipeline/traces/` for JSONL run traces
- Seed `pipeline/procedures.md` with the overlay-dismissal meta-procedure (existing files are preserved)

> **Note on the constitution:** The installer ships an opinionated constitution with 7 principles (Test-First, Security-First, Code Quality, Component Separation, Library-First, Database Migrations, Design Fidelity). If your project has the default blank spec-kit template (`[PROJECT_NAME] Constitution`), it will be **replaced automatically**. If you've already written your own constitution, it will be preserved — use `--force` to overwrite. Review `.specify/memory/constitution.md` after install and adjust the principles to fit your project.

Options:
- `--dry-run` — Preview what would be installed without writing files
- `--force` — Overwrite existing files

## Usage

### 1. Plan your project with spec-kit

Run the spec-kit commands in order:

```
/speckit-constitution → /speckit-specify → /speckit-plan → /speckit-tasks
```

### 2. Design

```
/design
```

Starts the designer/critic loop. Prototypes are written to `designs/` and served on port 4444 for browser verification.

### 3. Build

```
/build
```

Starts the developer/evaluator loop. Implements sprints from `specs/<latest-branch>/tasks.md` in order, verifying each against acceptance criteria in a real browser on port 3000.

## How it works

Each loop runs up to 5 cycles per sprint/design. On each cycle:

1. A **creator agent** (designer or developer) does the work, reading any prior feedback
2. A **verifier agent** (design-critic or evaluator) checks the result in a real browser using Playwright MCP
3. The verifier writes scored feedback to `pipeline/feedback/`
4. If the work passes the quality gate, the loop advances. Otherwise it cycles back with the feedback.

Issues marked `[High]` always block — they must be resolved before a sprint can pass.

### Authenticated apps

The evaluator handles apps that require login. On the first cycle:

1. Dismiss any overlay blocking the form (cookie consent, GDPR notice, etc.) — guided by the `## Overlays blocking forms` meta-procedure pre-seeded in `pipeline/procedures.md`
2. Look for test credentials in `prisma/seed.ts`, `.env.local`, or `README.md`
3. Fill and submit the login form
4. Confirm authentication, then write a `## Login` procedure to `pipeline/procedures.md` so future cycles skip discovery

No extra configuration needed — make sure your seed data includes at least one test user. If only an admin user is seeded, the evaluator uses admin-as-customer for verification and notes the caveat in feedback (rather than guessing customer passwords and hitting rate limits).

### Per-project caches

Three files in `pipeline/` accumulate project knowledge between cycles:

- **`pipeline/environment-facts.md`** — Stable shell facts (typecheck command, dev server command, env file path, DB resolution). Written by the developer on cycle 1, read first on later cycles. The `verify-environment-facts.mjs` script (run automatically before evaluator hand-off) cross-checks recorded DB paths against Prisma's resolution rules and flags orphan dev servers.
- **`pipeline/procedures.md`** — Multi-step UI flows (login, logout, navigation patterns) discovered by the evaluator and design-critic. Subagents grep by procedure name before doing browser work. Discovered flows survive upgrades (`init --force` never overwrites existing procedures).
- **`pipeline/run-state.md`** — Per-run state written by the orchestrator (active spec branch, sprint plan, in-scope task IDs). Subagents read it first to avoid re-resolving what the orchestrator already determined.

### Tracing

Every tool call by every subagent is logged as JSONL to `pipeline/traces/<run>.jsonl` via Claude Code hooks. To digest a trace:

```bash
node .claude/scripts/trace-summarise.mjs pipeline/traces/<file>.jsonl
```

Output includes per-tool call frequency, suspected flailing (≥5 consecutive identical-fingerprint calls), per-subagent stop markers, and total token usage by run.

## Constitution principles

The installed constitution enforces these principles during development and evaluation:

1. **Test-First** — All functionality must have tests. Red-green-refactor.
2. **Security-First** — Input validation, OWASP guidelines, no committed secrets.
3. **Code Quality** — Max 500 lines per file, low cognitive complexity, linting passes.
4. **Component Separation** — UI components in own files, single responsibility.
5. **Library-First** — Use maintained open-source packages over custom implementations.
6. **Database Migrations** — All schema changes via migrations. Never edit existing migrations.
7. **Design Fidelity** — Follow designs to the pixel. Architecture specs are binding.

## Project structure after install

```
.claude/
  agents/
    designer.md
    design-critique.md
    developer.md
    evaluator.md
  skills/
    build/SKILL.md
    design/SKILL.md
  scripts/
    trace-hook.mjs              # Claude Code hook — writes JSONL events to pipeline/traces/
    trace-summarise.mjs         # CLI digest — tool frequency, flails, token totals
    verify-environment-facts.mjs # Pre-handoff sanity check (orphan servers, DB paths, file size)
    start-dev-server.mjs        # Start dev server, parse bound URL from output, record to pipeline/
  launch.json
  settings.json
pipeline/
  feedback/                     # Evaluator reports per sprint/cycle
  traces/                       # JSONL traces of every /build and /design run
  build-log.md                  # Full progress log (human-readable)
  environment-facts.md          # Cached project facts (commands, paths) — written by developer
  procedures.md                 # Cached UI flows (login, etc.) — written by evaluator/critic
  run-state.md                  # Per-run state — written by orchestrator
designs/                        # HTML/CSS prototypes (created by designer)
```

## License

MIT
