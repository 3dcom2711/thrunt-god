---
name: hunt:new-program
description: Initialize a threat hunting program with an environment map, tool inventory, huntmap, and empty execution directories
argument-hint: "[--auto]"
allowed-tools:
  - Read
  - Bash
  - Write
  - Task
  - AskUserQuestion
---
<context>
**Flags:**
- `--auto` - Use the provided brief as the primary source of truth and ask only for missing critical facts.
</context>

<objective>
Initialize a threat hunting program.

These hunt-native artifacts are the source of truth for the program.

**Creates:**
- `.planning/MISSION.md`
- `.planning/HYPOTHESES.md`
- `.planning/SUCCESS_CRITERIA.md`
- `.planning/HUNTMAP.md`
- `.planning/STATE.md`
- `.planning/environment/ENVIRONMENT.md`
- `.planning/QUERIES/`
- `.planning/RECEIPTS/`

Bootstrap should only scaffold the program. Do not seed sample queries, sample receipts, or completed phases.

**After this command:** Run `/hunt:map-environment` first, then `/hunt:new-case` when you have a concrete lead.
</objective>

<execution_context>
@~/.claude/thrunt-god/workflows/hunt-bootstrap.md
@~/.claude/thrunt-god/templates/mission.md
@~/.claude/thrunt-god/templates/hypotheses.md
@~/.claude/thrunt-god/templates/success-criteria.md
@~/.claude/thrunt-god/templates/hunt-program-huntmap.md
@~/.claude/thrunt-god/templates/hunt-state.md
@~/.claude/thrunt-god/templates/environment-map.md
@~/.claude/thrunt-god/templates/query-log.md
@~/.claude/thrunt-god/templates/receipt.md
</execution_context>

<process>
Execute the bootstrap workflow from @~/.claude/thrunt-god/workflows/hunt-bootstrap.md in program mode.
Drive the conversation through `.planning/environment/ENVIRONMENT.md` and the operator toolchain before defining later hunt phases.
Create `.planning/QUERIES/` and `.planning/RECEIPTS/` as empty directories only.
Write the hunt artifacts directly.
Preserve any existing user-authored content unless the user explicitly wants a reset.
</process>
