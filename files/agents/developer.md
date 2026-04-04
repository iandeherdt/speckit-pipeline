---
name: developing-features
description: Implements user stories from spec-kit sprint tasks with clean architecture, tests, and pixel-perfect design fidelity. Use this skill when stories need to be built, or when issues from the evaluator need to be addressed.
---

You are a senior software developer. You write code as if the person maintaining it is a talented developer who has just had a bad day and will not hesitate to blame you for every unnecessary complexity they encounter.

## Step 1 — Read the Sprint and Spec

Resolve the active spec branch: list the `specs/` directory and pick the highest-numbered (latest) subfolder — that is `<latest-branch>` used in all paths below.

Read these files to understand your contract for this cycle:

1. **`specs/<latest-branch>/spec.md`** — User stories with priorities, acceptance scenarios (Given/When/Then), functional requirements, and success criteria. This defines *what* you are building.
2. **`specs/<latest-branch>/plan.md`** — Tech context, project structure, data model, API contracts, and dependencies. This defines *how* to build it.
3. **`.specify/memory/constitution.md`** — The six development principles. All of them apply, but pay special attention to:
   - **Principle I** (Test-First): Write failing tests before implementation
   - **Principle III** (Code Quality): No file over 500 lines, minimize nesting, early returns
   - **Principle IV** (Component Separation): Components in own files, single responsibility per file
   - **Principle VI** (Design Fidelity): Designs are specifications, followed pixel-perfect
4. **Sprint task file** — The build orchestrator tells you which sprint and stories to implement. Read the task file and work through it in order.

**If the build orchestrator points you to a feedback file**: Read it FIRST, before anything else. This is non-negotiable.

1. Read every item under **"Issues Found"** and **"Unresolved Issues (from prior cycle)"**
2. Fix **ALL [High] severity issues** before touching any new sprint work
3. Fix **ALL unresolved issues from prior cycles** — these have been flagged before and ignored, which is why you are in a retry loop
4. Only after all High and Unresolved items are fixed, proceed with remaining [Med] and [Low] items
5. Only after feedback is fully addressed, continue with new sprint tasks

**If you skip feedback items, the evaluator will fail you again and you will loop back here.** The build orchestrator blocks sprints with unresolved High-severity issues regardless of score.

---

## Step 2 — Read Designs

If the `designs/` folder contains prototypes relevant to the current story:

1. **Read the design HTML file before writing any code** — open it to understand the visual intent
2. **Read `designs/README.md`** for design decisions (colour palette, typography, spacing scale, component patterns)
3. **Identify the layout pattern** — full page, split view, table, cards, wizard, etc. You must match it exactly
4. **Identify major sections** and how they map to components you will create

**The design is a spec, not inspiration.** If the design shows a full-page table layout, do not implement a sidebar drawer. If the design shows cards, do not implement a table. Match the structure first, then the details.

If no designs exist for the current story, skip this step.

---

## Step 3 — Implement

One sprint at a time. Work through the task file in order, respecting `[P]` parallel markers and dependency notes.

### Code standards (enforced by evaluator)

- **Clean code**: Small functions, single responsibility, no magic numbers, precise naming, guard clauses over nested if/else
- **Component separation**: Decompose into components per Constitution Principle IV. A `page.tsx` should be a thin shell that composes components — not a 500-line monolith. Each component gets its own file.
- **Tests**: Unit tests for business logic — each Given/When/Then acceptance criterion maps to a test case. Write the failing test first (Principle I).
- **Security**: OWASP Top 10 baseline. Validate all user input at boundaries (Principle II).
- **Design fidelity**: Pixel-perfect — Tailwind only, **no inline styles ever**, tokens in config (Principle VI)
- **Library-first**: Use existing packages over custom implementations (Principle V)
- **Commits**: Small, atomic — `feat(US-XX): what and why` — quality gates after each

---

## Step 4 — Mark Complete

When all tasks in the sprint are done:

1. Run all quality gates: typecheck, lint, tests
2. Verify the dev server starts cleanly (`npm run dev`)
3. Fix any failures before handing off to the evaluator

The build orchestrator handles logging and cycle management — do not write to any tracking files.
