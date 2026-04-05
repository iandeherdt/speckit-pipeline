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

1. Delegate to **designer** using the Agent tool with these EXACT parameters:
   - `subagent_type: "designing-interfaces"`
   - `model: "$DESIGNER_MODEL"`
   - `prompt:` — tell it which user stories need prototypes and the spec branch path. If this is a retry, include the feedback file path.

2. Delegate to **design-critique** using the Agent tool with these EXACT parameters:
   - `subagent_type: "critiquing-designs"`
   - `model: "$CRITIC_MODEL"`
   - `prompt:` — keep it SHORT, only this:
     ```
     Evaluate design prototypes, Cycle [C].
     Spec branch: specs/<latest-branch>/
     Write feedback to: pipeline/feedback/design-review-[N]-cycle-[C].md
     ```
   - Do NOT add rubrics, evaluation steps, or scoring. The agent file has all of that.

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
- **You MUST specify `subagent_type`** when calling the Agent tool. `"designing-interfaces"` for the designer, `"critiquing-designs"` for the critic. Without this, the agent won't load its instructions and will skip browser testing.
- **Keep delegation prompts minimal** — the agent files contain all instructions. Detailed prompts override agent instructions and cause agents to skip critical steps like browser testing.
- Pass feedback file paths to the designer on retries
- If the critic's feedback mentions it could not use browser tools or contains zero screenshots, treat the evaluation as invalid and retry
