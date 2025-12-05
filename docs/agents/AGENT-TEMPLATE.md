# Agent Work Template

## EVERY AGENT MUST:

### 1. Before Starting
- Read `/docs/AGENT-CHECKLIST.md`
- Read `/src/src/types/database.ts`
- Read your specific agent instructions

### 2. While Working
Write progress notes to your log file:
```
/docs/agent-logs/[agent-name]-[date].md
```

Include:
- What you're working on
- Decisions made and why
- Files created/modified
- Issues encountered
- Questions for orchestrator

### 3. When Done
Update your log with:
- Summary of work completed
- Files changed (with paths)
- Bugs found (add to BUGS.md)
- Build status
- Next steps if any

### 4. Format for Log Files
```markdown
# [Agent Name] Log - [Date]

## Status: [IN_PROGRESS / COMPLETED / BLOCKED]

## Task
[What was assigned]

## Progress Notes
- [timestamp] Started working on X
- [timestamp] Created file Y
- [timestamp] Found issue Z

## Files Created/Modified
- /path/to/file.tsx (created)
- /path/to/other.tsx (modified)

## Issues Found
- BUG-XXX: Description (added to BUGS.md)

## Build Status
✅ Passes / ❌ Fails (with error)

## Questions for Orchestrator
- [Any blockers or decisions needed]
```
