Implement all sprints from the spec-kit task list. Each sprint loops through dev → eval until the evaluator passes.

## Prerequisites
Spec-kit planning must be complete. Verify these exist:
- `.speckit/spec.md`
- `.speckit/plan.md`
- `.speckit/tasks/` with at least one sprint file

If any are missing, tell the user to run the spec-kit commands first.

## Process

Read the sprint files from `.speckit/tasks/` in order.

For each sprint (max cycles per sprint: $MAX_CYCLES, default 5):

1. Delegate to **developer** subagent:
   - Tell it which sprint and stories to implement
   - If this is a retry, include the **full path** to the latest feedback file and explicitly say: "You MUST read and fix all Issues Found before doing anything else"

2. Delegate to **evaluator** subagent:
   - Tell it which stories to verify
   - Tell it the sprint number and cycle number for feedback file naming
   - Tell it to use the Claude Preview MCP tools (preview_start, preview_screenshot, preview_snapshot, etc.) for browser verification — code review alone is NOT acceptable

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
- Pass the full feedback file path to the developer on retries — do not summarize, let the developer read the actual file
- A sprint with unresolved High-severity issues NEVER passes, even if the score is above threshold
- Tell the evaluator explicitly that browser-based verification via Claude Preview MCP is mandatory — if the evaluator reports it could not use browser tools, treat the evaluation as invalid and retry
