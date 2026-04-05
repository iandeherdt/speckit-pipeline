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

Call the Agent tool with `subagent_type: "designing-interfaces"` and `model: "sonnet"`. Prompt should tell it which stories need prototypes and the spec branch. On retries include the feedback file path.

### Step 2 — Design Critique

Call the Agent tool with `subagent_type: "critiquing-designs"` and `model: "opus"`. The prompt should only contain the cycle context — the agent file handles everything else:

```
Evaluate design prototypes, Cycle [C].
Spec branch: specs/<latest-branch>/
Write feedback to: pipeline/feedback/design-review-[N]-cycle-[C].md
```

Do NOT add ToolSearch commands, browser rules, scoring rubrics, or evaluation steps to the prompt. The design-critique agent file has all of that.

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
- Pass `subagent_type` to the Agent tool: `"designing-interfaces"` for designer, `"critiquing-designs"` for critic
- Keep the critic prompt minimal — only cycle context. The agent file handles browser tools, rules, and scoring
- Pass feedback file paths to the designer on retries
- If the critic's feedback references HTML line numbers or says browser tools were unavailable, treat it as invalid and retry
