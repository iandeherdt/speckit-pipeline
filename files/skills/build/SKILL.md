Implement all sprints from the spec-kit task list. Each sprint loops through dev → eval until the evaluator passes.

## Configuration

Model assignment per subagent. Change these to control cost/quality tradeoffs:

| Subagent    | Model    | Rationale |
|-------------|----------|-----------|
| developer   | $DEVELOPER_MODEL (default: sonnet) | Heavy code generation — sonnet balances speed and quality |
| evaluator   | $EVALUATOR_MODEL (default: opus)   | Critical judgment — opus is more thorough at finding issues |

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

1. Delegate to **developer** using the Agent tool with these EXACT parameters:
   - `subagent_type: "developing-features"`
   - `model: "$DEVELOPER_MODEL"`
   - `prompt:` — tell it which sprint and stories to implement. If this is a retry, include the full path to the latest feedback file.

2. Delegate to **evaluator** using the Agent tool with these EXACT parameters:
   - `subagent_type: "evaluating-sprints"`
   - `model: "$EVALUATOR_MODEL"`
   - `prompt:` — keep it SHORT, only this:
     ```
     Evaluate Sprint [N], Cycle [C].
     Stories in scope: [list story IDs and titles].
     Spec branch: specs/<latest-branch>/
     Write feedback to: pipeline/feedback/sprint-[N]-cycle-[C].md
     ```
   - Do NOT add verification steps, content checklists, or scoring weights. The agent file has all of that.

3. Read the evaluator's feedback file and output:
   - Check for `<promise>COMPLETE</promise>` or `<promise>PERFECT</promise>` signals
   - **Also read the feedback file** — do NOT just check the signal:
     - If there are any **[High]** severity issues, the sprint does NOT pass regardless of score. Loop back to step 1.
     - If **Unresolved Issues** from a prior cycle are still listed, the sprint does NOT pass. Loop back to step 1.
   - PASS (signal present, no High issues, no unresolved carry-overs) → log success, move to next sprint
   - FAIL → log failure with specific issues, loop back to step 1

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
- **You MUST specify `subagent_type`** when calling the Agent tool. `"developing-features"` for the developer, `"evaluating-sprints"` for the evaluator. Without this, the agent won't load its instructions and will skip browser testing.
- **Keep delegation prompts minimal** — the agent files contain all instructions. Detailed prompts override agent instructions and cause agents to skip critical steps like browser testing.
- Pass the full feedback file path to the developer on retries — do not summarize, let the developer read the actual file
- A sprint with unresolved High-severity issues NEVER passes, even if the score is above threshold
- If the evaluator's feedback mentions it could not use browser tools or contains zero screenshots, treat the evaluation as invalid and retry
