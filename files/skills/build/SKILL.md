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

## Process

Read the sprint tasks from `specs/<latest-branch>/tasks.md` in order.

For each sprint (max cycles per sprint: $MAX_CYCLES, default 5):

### Step 1 — Developer

Call the Agent tool with `subagent_type: "developing-features"` and `model: "sonnet"`. Prompt should tell it which sprint, stories, and spec branch. On retries include the feedback file path.

### Step 2 — Evaluator

Call the Agent tool with `subagent_type: "evaluating-sprints"` and `model: "sonnet"`. The prompt should only contain the sprint context — the agent file handles everything else:

```
Evaluate Sprint [N], Cycle [C].
Stories in scope: [list story IDs and titles].
Tasks in scope: [list task IDs, e.g. T001, T002, T003].
Spec branch: specs/<latest-branch>/
Write feedback to: pipeline/feedback/sprint-[N]-cycle-[C].md
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
