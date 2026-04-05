---
name: design
description: Run the design/eval loop. Delegates to designer and design-critique subagents, iterating until designs pass.
license: Complete terms in LICENSE.txt
---

Create all design prototypes from the spec-kit specification. Each cycle loops through designer → design-critique until the critic passes.

## Configuration

Model assignment per subagent. Change these to control cost/quality tradeoffs:

| Subagent        | Model    | Rationale |
|-----------------|----------|-----------|
| designer        | $DESIGNER_MODEL (default: sonnet) | Creative generation — sonnet balances speed and quality |
| design-critique | $CRITIC_MODEL (default: opus)     | Critical judgment — opus is more thorough at finding issues |

Override by setting variables before invoking `/design`, or edit the defaults above.

## Prerequisites
Resolve the active spec branch first: list the `specs/` directory and pick the highest-numbered (latest) subfolder — that is `<latest-branch>`. All spec paths below use this root.

Spec-kit planning must be complete. Verify these exist:
- `specs/<latest-branch>/spec.md`
- `specs/<latest-branch>/plan.md`

If any are missing, tell the user to run the spec-kit commands first.

## Process

Max cycles: $MAX_CYCLES, default 5.

For each cycle:

### Step 1 — Designer

Call the Agent tool with **exactly** these parameters (copy verbatim):

```json
{
  "subagent_type": "designing-interfaces",
  "model": "sonnet",
  "description": "Design cycle [C] designer",
  "prompt": "Create design prototypes, Cycle [C].\nStories in scope: [list].\nSpec branch: specs/<latest-branch>/\n[If retry: Read feedback at pipeline/feedback/design-review-[N]-cycle-[C-1].md FIRST and fix all issues.]"
}
```

### Step 2 — Design Critique

Call the Agent tool with **exactly** these parameters (copy verbatim):

```json
{
  "subagent_type": "critiquing-designs",
  "model": "opus",
  "description": "Design cycle [C] critique",
  "prompt": "Evaluate design prototypes, Cycle [C].\nSpec branch: specs/<latest-branch>/\nWrite feedback to: pipeline/feedback/design-review-[N]-cycle-[C].md"
}
```

**⚠️ The `subagent_type` parameter is MANDATORY.** Without it, the agent runs as general-purpose and will NOT use browser tools. If you omit `subagent_type`, the evaluation will be HTML source reading instead of visual browser testing — which is invalid.

Do NOT add rubrics, evaluation steps, or scoring to the prompt. The agent file has all of that.

### Step 3 — Check results

Read the critic's output:
- PERFECT → log success, stop
- COMPLETE → log success, stop
- Neither → log failure, loop back to Step 1

## Logging

Append to `pipeline/build-log.md`:
```
Design — Cycle [N] — [Timestamp]

Designer: completed
Critic: PASS/FAIL — Score X.X/10
Issues: [summary if FAIL]
```

## Failure handling
- Write unresolved issues to build-log.md
- Report to user what's blocking

## Rules
- Never design or critique yourself — always delegate
- Each subagent gets fresh context automatically
- **`subagent_type` is MANDATORY** — `"designing-interfaces"` for designer, `"critiquing-designs"` for critic. Omitting it causes agents to skip browser testing.
- Keep delegation prompts minimal — the agent files contain all instructions
- Pass feedback file paths to the designer on retries
- If the critic's feedback references HTML line numbers or mentions it could not use browser tools, treat the evaluation as invalid and retry
