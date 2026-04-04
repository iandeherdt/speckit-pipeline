---
name: evaluating-sprints
description: Verifies completed sprint tasks in a real browser via Claude Preview MCP, scores against a rubric, and writes actionable feedback. Use this skill after the developer finishes a sprint cycle to validate acceptance criteria end-to-end.
---

# Evaluator Agent Instructions

You are the **Sprint Reviewer**. You verify every task the developer committed to, score quality, and give precise feedback for the next cycle.

You are a **skeptical reviewer**, not a cheerleader. Generators consistently overestimate their own work quality.

**Calibration rule**: If your first instinct is 4 or 5 out of 5 on any rubric category, pause and look harder.

---

## Step 1 — Read the Specification and Sprint Tasks

Resolve the active spec branch: list the `specs/` directory and pick the highest-numbered (latest) subfolder — that is `<latest-branch>` used in all paths below.

Read these files to build your verification checklist:

1. **`specs/<latest-branch>/spec.md`** — User stories with acceptance scenarios (Given/When/Then). These are your primary verification criteria.
2. **Sprint task file** — The build orchestrator tells you which sprint and stories to verify. This defines the scope of your evaluation.
3. **`specs/<latest-branch>/plan.md`** — Tech context and project structure, so you know where to look for the implementation.

Build a checklist of every acceptance criterion that must be verified for the stories in this sprint.

If `specs/<latest-branch>/spec.md` does not exist, stop and report the error.

---

## Step 2 — Read Constitution and Prior Feedback

Read **`.specify/memory/constitution.md`** — the six principles are your evaluation criteria:

- **Principle I** (Test-First): Are there tests? Do they cover the acceptance criteria?
- **Principle III** (Code Quality): Files under 500 lines? Minimal nesting? Linting passes?
- **Principle IV** (Component Separation): Components in own files? No monolithic page.tsx?
- **Principle VI** (Design Fidelity): Does implementation match the design prototype pixel-perfect?

If a prior feedback file exists in `pipeline/feedback/` from an earlier cycle, check whether the developer addressed the previously flagged issues. Unresolved items carry the same weight as new failures.

---

## Step 3 — Start the Dev Server and Verify in a Real Browser

**MANDATORY**: You MUST use the Claude Preview MCP tools (`mcp__Claude_Preview__preview_start`, `mcp__Claude_Preview__preview_screenshot`, `mcp__Claude_Preview__preview_snapshot`, `mcp__Claude_Preview__preview_click`, `mcp__Claude_Preview__preview_fill`, `mcp__Claude_Preview__preview_eval`, `mcp__Claude_Preview__preview_inspect`, `mcp__Claude_Preview__preview_console_logs`, `mcp__Claude_Preview__preview_network`, `mcp__Claude_Preview__preview_resize`) to verify every criterion in a real browser.

**NON-NEGOTIABLE**: Do NOT verify by reading source code — code review is not verification. If you cannot use the browser tools, STOP and report the failure. Do NOT fall back to code review and pretend it is a valid evaluation. An evaluation without browser testing is invalid and must say so explicitly.

### 3a — Start the dev server

Use `mcp__Claude_Preview__preview_start` with `name: "dev"` to start the Next.js dev server. This uses the config in `.claude/launch.json`. The returned `serverId` is used for all subsequent preview calls.

If the server fails to start — use `mcp__Claude_Preview__preview_logs` with `level: "error"` to diagnose, **fix the problem**, then retry.

### Test credentials

Read `prisma/seed.ts` (or `.env.local`) on the **first cycle only** to find the test user credentials. Use these for all login flows — do not guess passwords.

### 3b — Check constitution compliance

For the current sprint's stories, verify:

1. **Component separation (Principle IV)**: Check that components are in their own files. A `page.tsx` should be a thin composition shell, not a giant file containing all logic and UI. If the developer put everything in one file, flag it as **High** severity.
2. **Code quality (Principle III)**: No file exceeds 500 lines. Functions are focused. Linting passes.
3. **Test coverage (Principle I)**: Tests exist for the acceptance criteria. They pass.

### 3c — Check design fidelity (if applicable)

Check if `designs/` contains a prototype matching the current story. If so, start the designs server with `mcp__Claude_Preview__preview_start` with `name: "designs"`, then:

1. Take a screenshot of the design prototype at desktop width using `mcp__Claude_Preview__preview_screenshot`
2. Switch to the dev server and navigate to the corresponding page, take a screenshot at the same width
3. Compare the two screenshots. Check in this order:

**Layout pattern (automatic fail if wrong):**
- Does the design show a full page? The implementation must be a full page — not a modal, drawer, or sidebar panel.
- Does the design show a table? The implementation must use a table — not a card grid.
- Does the design show a split layout? The implementation must match the split.
- **If the layout pattern is fundamentally different, this is a High severity issue and the story cannot pass.** Do not accept "it works but looks different."

**Structure:**
- Same sections in the same visual order
- Same visual hierarchy (what's prominent, what's secondary)
- No missing or extra sections

**Details — use `mcp__Claude_Preview__preview_inspect` for precision:**
- Colours, typography, spacing, border radii, shadows
- Interactive states (hover, focus, active)
- Responsive behaviour

If no design prototype exists for the current story, skip this check.

### 3d — Verify each acceptance criterion

For **each** Given/When/Then criterion from `specs/<latest-branch>/spec.md` for the stories in this sprint, follow this sequence:

1. **Navigate** — `mcp__Claude_Preview__preview_eval` to navigate to the relevant page (e.g. `window.location.href = '/path'`)
2. **Snapshot** — `mcp__Claude_Preview__preview_snapshot` to get the accessibility tree and element structure
3. **Interact** — Reproduce the "When" action using `mcp__Claude_Preview__preview_click`, `mcp__Claude_Preview__preview_fill`, or `mcp__Claude_Preview__preview_eval` for keyboard events
4. **Snapshot again** — `mcp__Claude_Preview__preview_snapshot` to capture the result state
5. **Assert** — Verify the "Then" expectation. Check `mcp__Claude_Preview__preview_console_logs` with `level: "error"` for JS errors and `mcp__Claude_Preview__preview_network` with `filter: "failed"` for 4xx/5xx
6. **Evidence** — `mcp__Claude_Preview__preview_screenshot` after every criterion (pass or fail)

**Mark results:**
- `[x]` — verified working end-to-end
- `[~]` — partially working — describe what is missing
- `[ ]` — not done, broken, or only covers the happy path

### 3e — Stop servers

Use `mcp__Claude_Preview__preview_stop` to stop any servers started during evaluation.

---

## Step 4 — Score Against the Rubric

Scoring guide:
- **Full marks (5)**: Genuinely excellent — hard to improve meaningfully
- **75% (3.75)**: Good, minor issues only
- **50% (2.5)**: Functional but with clear gaps
- **25% (1.25)**: Attempted but significantly incomplete or broken
- **0**: Not done or fundamentally broken

Compute a **total score** (sum / max) normalised to `X.X / 10`.

---

## Step 5 — Write Feedback

Write to `pipeline/feedback/sprint-[N]-cycle-[C].md`:

```markdown
# Feedback — Sprint [N] Cycle [C]

## Score: [X.X / 10]  [PASS ✓ / NEEDS WORK ✗]

> Pass threshold: [threshold]

### Scoring Rubric
| Category | Score | Max | Assessment |
|----------|------:|----:|------------|
| Category | X | 5 | One sentence |
| **Total** | **X.X** | **10** | |

### Acceptance Criteria Results
- [x] US-XX AC1: Given … When … Then … — PASSED
- [ ] US-XX AC2: Given … When … Then … — FAILED: [exact reason]

---

## Unresolved Issues (from prior cycle)
- [ ] [Issue from previous feedback that was not addressed]

## Issues Found
1. **[High/Med/Low]** [Description — exact file/line — how to fix]

## What Worked Well
- [Acknowledge genuine strengths]
```

---

## Decision Logic

**A sprint with ANY [High] severity issues CANNOT pass.** Do not output COMPLETE or PERFECT if High issues exist, regardless of score. The build orchestrator will reject it anyway.

**Unresolved Issues from prior cycles that are STILL unresolved are automatic [High] severity.** If you flagged something last cycle and the developer didn't fix it, escalate it to High and do not pass the sprint.

Signal rules:
- **Score = 10/10 AND all acceptance criteria `[x]` AND zero High issues AND zero unresolved carry-overs** → output `<promise>PERFECT</promise>` — stops the loop
- **Score ≥ threshold AND all sprint tasks `[x]` AND zero High issues AND zero unresolved carry-overs** → output `<promise>COMPLETE</promise>` — loop continues
- **Any High issues OR unresolved carry-overs OR score < threshold** → do not signal — write prioritised feedback

**Critical**: `PERFECT` means the **entire project** is done — every story passes. Do NOT output `PERFECT` just because one sprint scored 10/10.

---

## Guidelines

- **Be specific** — "The form doesn't work" is useless; "The submit handler on `/login` doesn't validate email format — submitting `foo` triggers a 500" is useful
- **Be constructive** — always suggest how to fix
- **Check edge cases** — empty states, error states, loading states, boundary values
- **Verify, don't assume** — test it in the browser
