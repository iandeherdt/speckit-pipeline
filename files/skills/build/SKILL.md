Implement all sprints from the spec-kit task list. Each sprint loops through dev → eval until the evaluator passes.

## Configuration

Model assignment per subagent. Change these to control cost/quality tradeoffs:

| Subagent    | Model    | Rationale |
|-------------|----------|-----------|
| developer   | $DEVELOPER_MODEL (default: sonnet) | Heavy code generation — sonnet balances speed and quality |
| evaluator   | $EVALUATOR_MODEL (default: sonnet)   | Browser verification — sonnet balances thoroughness and token cost |

Override by setting variables before invoking `/build`, or edit the defaults above.

## Prerequisites
Resolve the active spec branch first: list the `specs/` directory and pick the highest-numbered (latest) subfolder — that is `<latest-branch>`. All spec paths below use this root.

Spec-kit planning must be complete. Verify these exist:
- `specs/<latest-branch>/spec.md`
- `specs/<latest-branch>/plan.md`
- `specs/<latest-branch>/tasks.md`

If any are missing, tell the user to run the spec-kit commands first.

## Run state cache (write once at the start of the run)

Before the first sprint, write `pipeline/run-state.md` so subagents do not
re-discover what you already resolved. Overwrite any existing file. The
content is plain markdown with one fact per line:

```markdown
# Run State

**Run type**: build
**Started**: <current ISO timestamp>
**Spec branch**: specs/<latest-branch>
**Sprint count**: <total sprints in tasks.md>
**Has designs/**: yes | no
**Constitution path**: .specify/memory/constitution.md
```

Update the per-sprint detail at the start of each sprint (append or
rewrite the **Sprint in progress** block):

```markdown
**Sprint in progress**: Sprint <N> — Cycle <C>
**Stories in scope**: US-XX, US-YY
**Task IDs in scope**: T001, T002, T003
```

Subagents will read this file before any other discovery. Do not list
`specs/`, `test -f .specify/extensions.yml`, or otherwise re-validate
facts that already live here.

## Process

Read the sprint tasks from `specs/<latest-branch>/tasks.md` in order.

For each sprint (max cycles per sprint: $MAX_CYCLES, default 5):

### Step 0 — Extract the task block

Before invoking the developer or evaluator, extract the relevant lines
from `tasks.md` for the in-scope task IDs. Use a single command and
capture the output for inclusion in subagent prompts:

```bash
awk '/^- \[[ x]\] T[0-9]+/{p=0} /^- \[[ x]\] (T002|T003|T004) /{p=1} p' \
  specs/<latest-branch>/tasks.md
```

(Substitute the actual task IDs in scope. Note the literal space after
`(T002|...)` — POSIX awk does not support `\b` word boundaries, so
match the space that follows the task ID instead.) Hold this output as
the "task block" — pass it inline in both the developer and evaluator
prompts as a fenced markdown block. This avoids both subagents
re-reading the full 20–30 KB `tasks.md` file every cycle.

### Step 1 — Developer

Call the Agent tool with `subagent_type: "developing-features"` and
`model: "sonnet"`. The prompt MUST include:
- The sprint number, cycle number, stories in scope, spec branch
- A pointer to `pipeline/run-state.md`
- The task block extracted in Step 0, as a fenced markdown block
- On retries: the path to the prior cycle's feedback file

### Step 1b — Verify environment facts gate

After the developer subagent returns and **before** invoking the evaluator,
run:

```bash
node .claude/scripts/verify-environment-facts.mjs
```

This catches orphan `next dev` processes the developer's `pkill` may
have missed, and wrong DB-path recordings in
`pipeline/environment-facts.md`. **If it exits non-zero, do NOT invoke
the evaluator** — log the failure and loop back to Step 1 with feedback
to the developer. The developer should also have run this script in
their own Step 4, but doing it here is defense in depth.

### Step 2 — Evaluator

Call the Agent tool with `subagent_type: "evaluating-sprints"` and `model: "sonnet"`. The prompt should include the sprint context AND the task block — the agent file handles everything else:

```
Evaluate Sprint [N], Cycle [C].
Stories in scope: [list story IDs and titles].
Spec branch: specs/<latest-branch>/
Run state: pipeline/run-state.md
Procedures (login etc.): pipeline/procedures.md
Write feedback to: pipeline/feedback/sprint-[N]-cycle-[C].md

Task block (do not re-read tasks.md):
```
[paste the task block here]
```
```

Do NOT add ToolSearch commands, browser rules, scoring rubrics, or verification steps to the prompt. The evaluator agent file has all of that.

### Step 3 — Check results

Read the evaluator's feedback file and output:
- Check for `<promise>COMPLETE</promise>` or `<promise>PERFECT</promise>` signals
- **Also read the feedback file** — do NOT just check the signal:
  - If there are any **[High]** severity issues, the sprint does NOT pass regardless of score. Loop back to Step 1.
  - If **Unresolved Issues** from a prior cycle are still listed, the sprint does NOT pass. Loop back to Step 1.
- PASS (signal present, no High issues, no unresolved carry-overs) → log success, move to next sprint
- FAIL → log failure with specific issues, loop back to Step 1

## Logging

Append to `pipeline/build-log.md`:
```
Sprint [S] — Cycle [N] — [Timestamp]

Developer: completed
Evaluator: PASS/FAIL — Score X.X/10
High issues: [list any High severity items, or "none"]
Unresolved from prior: [list any, or "none"]
Verdict: [PASS — moving to next sprint / FAIL — retrying with feedback]
```

## Failure handling
- After max cycles, write unresolved issues to build-log.md
- Report to user what's blocking and which issues could not be resolved

## Rules
- Never implement or evaluate yourself — always delegate
- Each subagent gets fresh context automatically
- Pass `subagent_type` to the Agent tool: `"developing-features"` for developer, `"evaluating-sprints"` for evaluator
- Keep the evaluator prompt minimal — only sprint context. The agent file handles browser tools, rules, and scoring
- Pass the full feedback file path to the developer on retries
- A sprint with unresolved High-severity issues NEVER passes, even if the score is above threshold
- If the evaluator's feedback has zero screenshots or says browser tools were unavailable, treat it as invalid and retry
