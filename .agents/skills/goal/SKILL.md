---
name: goal
description: Use when the user invokes the goal workflow or asks to define, refine, restate, or track the current project goal before implementation.
---

# Goal

Use this skill to turn a loose request into a concrete working goal for the current repository.

## Workflow

1. Inspect the repo state first when the goal depends on current work:
   - `git status --short`
   - the most relevant plan, handoff, README, issue, or task file
   - the files directly named by the user
2. State the working goal in one or two plain sentences.
3. List the acceptance criteria as short, testable bullets.
4. Identify the next smallest implementation step.
5. If the user asked for implementation, proceed after the goal is clear; do not stop at planning unless a key decision is missing.

## Output Shape

Prefer this compact shape:

```markdown
**Goal**
<one or two sentences>

**Acceptance Criteria**
- <observable criterion>
- <observable criterion>

**Next Step**
<single next action>
```

Keep the goal grounded in repository evidence. If the repo evidence conflicts with the user's request, call out the mismatch with exact file references and ask only the blocking question.
