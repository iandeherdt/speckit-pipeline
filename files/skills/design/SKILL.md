---
name: design
description: Run the design/eval loop. Delegates to designer and design-critique subagents, iterating until designs pass.
license: Complete terms in LICENSE.txt
---

Create all design prototypes from the spec-kit specification. Each cycle loops through designer → design-critique until the critic passes.

## Configuration

Model assignment per subagent. Change these to control cost/quality tradeoffs:

| Subagent       | Model    | Rationale |
|----------------|----------|-----------|
| designer       | $DESIGNER_MODEL (default: sonnet) | Creative generation — sonnet balances speed and quality |
| design-critique | $CRITIC_MODEL (default: opus)    | Critical judgment — opus is more thorough at finding issues |

Override by setting variables before invoking `/design`, or edit the defaults above.

## Prerequisites
Spec-kit planning must be complete. Verify these exist:
- `.speckit/spec.md`
- `.speckit/plan.md`

If any are missing, tell the user to run the spec-kit commands first.

## Process

Max cycles: $MAX_CYCLES, default 5.

For each cycle:

1. Delegate to **designer** subagent (model: **$DESIGNER_MODEL**):
   - Tell it which user stories need prototypes
   - If this is a retry, point it to the latest feedback file in `pipeline/feedback/`

2. Delegate to **design-critique** subagent (model: **$CRITIC_MODEL**):
   - Tell it to evaluate all prototypes in `designs/`
   - Tell it the cycle number for feedback file naming

3. Read the critic's output:
   - PERFECT → log success, stop
   - COMPLETE → log success, stop
   - Neither → log failure, loop back to step 1

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
- Pass feedback file paths to the designer on retries
