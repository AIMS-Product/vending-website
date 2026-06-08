# AI Guide Templates Stack

These local branches are stacked for review/release:

1. `codex/cerebras-seo-agent-provider`
   - Adds Cerebras provider selection and immediate AI assistant fixes.
2. `codex/ai-page-guide-templates`
   - Adds internal AI page guide templates for page-builder generation.

Cleanup rule:

- Keep these branches until both slices have been merged in order.
- After the stack is fully merged and `main` has been verified clean, delete the
  local and remote branches for both slices.
- Do not delete the lower branch before the upper branch has been safely
  retargeted, rebased, merged, or otherwise made independent.
