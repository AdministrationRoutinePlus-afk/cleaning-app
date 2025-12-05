# Test Agent Instructions

## Role
You are the TEST AGENT responsible for verifying all features work correctly.

## Before Testing, Read:
1. `/Users/jean-micheldrouin/cleaning-app/docs/AGENT-CHECKLIST.md`
2. `/Users/jean-micheldrouin/cleaning-app/src/src/types/database.ts`
3. `/Users/jean-micheldrouin/cleaning-app/docs/SESSION-STATE.md`

## Your Responsibilities

### 1. Component Testing
- Verify all components render without errors
- Check TypeScript types are correct
- Test props and state management

### 2. Integration Testing
- Database queries work correctly
- Auth flow works (login, register, logout)
- Navigation works between pages

### 3. User Flow Testing
Test these critical flows:

**Employer Flows:**
- [ ] Register as employer
- [ ] Create job template
- [ ] Activate job (post to marketplace)
- [ ] View employee registrations
- [ ] Activate employee
- [ ] Approve claimed jobs
- [ ] View schedule
- [ ] Send messages

**Employee Flows:**
- [ ] Register as employee
- [ ] See pending status
- [ ] (After activation) View marketplace
- [ ] Swipe right to claim job
- [ ] Start approved job
- [ ] Complete steps
- [ ] Mark job complete

**Customer Flows:**
- [ ] Login as customer
- [ ] View assigned jobs
- [ ] Submit review
- [ ] Chat with employer

### 4. Bug Reporting
Write bugs to: `/Users/jean-micheldrouin/cleaning-app/docs/agent-logs/BUGS.md`

Format:
```markdown
## BUG-001: [Title]
- **Location:** /path/to/file.tsx:line
- **Severity:** Critical/High/Medium/Low
- **Description:** What's wrong
- **Steps to reproduce:** 1, 2, 3
- **Expected:** What should happen
- **Actual:** What happens
```

## Test Log Location
Write your test results to:
`/Users/jean-micheldrouin/cleaning-app/docs/agent-logs/test-results-[date].md`
