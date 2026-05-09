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

## Run state cache (write once at the start of the run)

Before the first cycle, write `pipeline/run-state.md` so subagents do not
re-discover what you already resolved. Overwrite any existing file.

```markdown
# Run State

**Run type**: design
**Started**: <current ISO timestamp>
**Spec branch**: specs/<latest-branch>
**Has designs/**: yes | no
**Constitution path**: .specify/memory/constitution.md
```

Update the per-cycle line at the start of each cycle:

```markdown
**Cycle in progress**: <C>
```

Subagents will read this file before any other discovery. Do not list
`specs/` or otherwise re-validate facts that already live here.

## Clean previous run artifacts (run once, before the first cycle)

`pipeline/feedback/` and `pipeline/traces/` are per-run scratch space.
Stale design-review feedback files, screenshots, and JSONL traces from
earlier runs are noise once a new design loop starts — they bloat trace
digests with content from prior features. Wipe both directories at the
start of every `/design`:

```bash
rm -rf pipeline/feedback pipeline/traces
mkdir -p pipeline/feedback pipeline/traces
```

This does NOT touch the persistent caches:
- `pipeline/build-log.md` — historical log across runs
- `pipeline/environment-facts.md` — cached commands and DB paths
- `pipeline/procedures.md` — cached UI flows
- `pipeline/run-state.md` — overwritten on the next step anyway

If the user has a reason to preserve a prior run's feedback, they should
copy `pipeline/feedback/` somewhere safe before invoking `/design`.

## Process

Max cycles: $MAX_CYCLES, default 5.

For each cycle:

### Step 1 — Designer

Call the Agent tool with `subagent_type: "designing-interfaces"` and `model: "sonnet"`. Prompt should tell it which stories need prototypes and point it at `pipeline/run-state.md` for the spec branch. On retries include the feedback file path.

### Step 2 — Design Critique

Call the Agent tool with `subagent_type: "critiquing-designs"` and `model: "opus"`. The prompt should only contain the cycle context — the agent file handles everything else:

```
Evaluate design prototypes, Cycle [C].
Spec branch: specs/<latest-branch>/
Run state: pipeline/run-state.md
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
