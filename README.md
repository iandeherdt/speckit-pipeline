# speckit-pipeline

Build and design pipeline extension for [spec-kit](https://github.com/iandeherdt/spec-kit) projects. Automates multi-agent workflows that implement and verify user stories through iterative loops — design/critique and dev/eval — with real browser verification via Claude Preview MCP.

## What it does

speckit-pipeline installs specialized Claude Code agents and skills into your spec-kit project:

**Design loop** (`/design`) — A designer agent creates HTML/CSS prototypes for each view in your spec, then a design-critic agent evaluates them in a real browser, scoring against a rubric. The loop iterates until the designs pass.

**Build loop** (`/build`) — A developer agent implements sprint tasks from your spec-kit plan, then an evaluator agent verifies the implementation in a real browser against acceptance criteria. The loop iterates until each sprint passes.

Both loops produce structured feedback in `pipeline/feedback/` and log progress to `pipeline/build-log.md`.

## Agents

| Agent | Role |
|-------|------|
| **designer** | Creates production-grade HTML/CSS prototypes with a distinctive aesthetic direction |
| **design-critique** | Evaluates prototypes in-browser across breakpoints, scores on design quality, originality, craft, and functionality |
| **developer** | Implements user stories with test-first development, enforcing code quality and design fidelity |
| **evaluator** | Verifies implementations end-to-end in a real browser, writes actionable feedback with severity levels |

## Prerequisites

- A [spec-kit](https://github.com/iandeherdt/spec-kit) project (with `.specify/integration.json`)
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) with Claude Preview MCP enabled
- Node.js >= 18

## Installation

```bash
npx speckit-pipeline init
```

This will:
- Install agents to `.claude/agents/`
- Install skills to `.claude/skills/`
- Merge launch configs into `.claude/launch.json` (dev server on port 3000, design server on port 4444)
- Add required permissions to `.claude/settings.json`
- Append pipeline documentation to `CLAUDE.md`
- Install an opinionated constitution to `.specify/memory/constitution.md`
- Create `pipeline/feedback/` for evaluator reports

> **Note on the constitution:** The installer ships an opinionated constitution with 6 principles (Test-First, Security-First, Code Quality, Component Separation, Library-First, Design Fidelity). If your project has the default blank spec-kit template (`[PROJECT_NAME] Constitution`), it will be **replaced automatically**. If you've already written your own constitution, it will be preserved — use `--force` to overwrite. Review `.specify/memory/constitution.md` after install and adjust the principles to fit your project.

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
2. A **verifier agent** (design-critic or evaluator) checks the result in a real browser using Claude Preview MCP
3. The verifier writes scored feedback to `pipeline/feedback/`
4. If the work passes the quality gate, the loop advances. Otherwise it cycles back with the feedback.

Issues marked `[High]` always block — they must be resolved before a sprint can pass.

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
  launch.json
  settings.json
pipeline/
  feedback/          # Evaluator reports per sprint/cycle
  build-log.md       # Full progress log
designs/             # HTML/CSS prototypes (created by designer)
```

## License

MIT
