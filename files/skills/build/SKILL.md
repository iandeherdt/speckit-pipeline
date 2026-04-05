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

### Step 1 — Developer

Call the Agent tool with **exactly** these parameters (copy verbatim):

```json
{
  "subagent_type": "developing-features",
  "model": "sonnet",
  "description": "Sprint [N] developer",
  "prompt": "Implement Sprint [N], Cycle [C].\nStories in scope: [list].\nSpec branch: specs/<latest-branch>/\n[If retry: Read feedback at pipeline/feedback/sprint-[N]-cycle-[C-1].md FIRST and fix all issues before doing anything else.]"
}
```

### Step 2 — Evaluator

Call the Agent tool with **exactly** these parameters (copy verbatim):

```json
{
  "subagent_type": "evaluating-sprints",
  "model": "opus",
  "description": "Sprint [N] evaluator",
  "prompt": "Evaluate Sprint [N], Cycle [C].\nStories in scope: [list].\nSpec branch: specs/<latest-branch>/\nWrite feedback to: pipeline/feedback/sprint-[N]-cycle-[C].md"
}
```

**⚠️ The `subagent_type` parameter is MANDATORY.** Without it, the agent runs as general-purpose and will NOT use browser tools. If you omit `subagent_type`, the evaluation will be a code review instead of browser testing — which is invalid.

Do NOT add verification steps, content checklists, or scoring weights to the prompt. The agent file has all of that.

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
- **`subagent_type` is MANDATORY** — `"developing-features"` for developer, `"evaluating-sprints"` for evaluator. Omitting it causes agents to skip browser testing.
- Keep delegation prompts minimal — the agent files contain all instructions
- Pass the full feedback file path to the developer on retries
- A sprint with unresolved High-severity issues NEVER passes, even if the score is above threshold
- If the evaluator's feedback mentions it could not use browser tools or contains zero screenshots, treat the evaluation as invalid and retry
