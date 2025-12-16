# QA, Debug & UI Research Report - December 5, 2025

## QA TESTING REPORT - 47 Issues Found

### CRITICAL (5)
1. **Race Condition in Job Claims** - Two employees can claim same job simultaneously (marketplace/page.tsx:186-238)
2. **Missing Employer Filter** - Employer can see ALL jobs in system, not just their own (schedule/page.tsx:70-96) - **SECURITY**
3. **XSS in Messages** - Refuse reason not sanitized before storage (ScheduleJobPopup.tsx:225)
4. **localStorage Not Synced** - Multiple tabs can cause duplicate claims
5. **Type Assertions to 'any'** - Bypasses TypeScript safety (jobs/[id]/page.tsx:137-142)

### HIGH PRIORITY (15)
- No error UI for failed operations (silent failures)
- Missing employee status check before claiming
- Reset button only affects CLAIMED, not APPROVED/REFUSED
- useEffect dependency array issues causing infinite loops
- .single() errors not caught
- Auto-start job race condition
- Timezone handling issues in calendar
- Missing RLS policy checks

### MEDIUM (10)
- No date validation (can schedule in past)
- No pagination (memory issues with large datasets)
- Memory leaks (missing cleanup in useEffect)
- Duplicate function calls in render

### LOW/UX (17)
- alert() instead of toast notifications
- Inconsistent status naming
- No loading states for images
- CSS global scope pollution

---

## DEBUG REPORT - 23 Code Issues

### Quick Wins (Fix First)
1. Remove `as any` type assertions (30 mins)
2. Consolidate date formatting utilities (20 mins)
3. Use Record<> for exhaustive status handling (15 mins)
4. Add try/catch to JSON.parse in localStorage (15 mins)
5. Replace .single() with .maybeSingle() (10 mins)

### Key Fixes Needed
- Add error state to all pages
- Memoize supabase client creation
- Add cleanup functions to useEffect hooks
- Validate dates before submitting
- Handle batch insert errors properly

---

## UI/UX RESEARCH - Modern Patterns

### Must-Have (Phase 1)
| Feature | Complexity | Inspired By |
|---------|------------|-------------|
| Drag-and-drop calendar with color coding | Medium | Jobber |
| Status badge system (color-coded) | Easy | Microsoft Dynamics |
| Step-by-step checklist with progress bar | Easy | Field Service Mobile |
| Photo documentation | Medium | Jobber |
| Offline mode with sync | Hard | ServiceTitan |
| Bottom navigation bar | Easy | Housecall Pro |
| Large touch targets (44×44pt min) | Easy | Field Service UX |
| Smart empty states | Easy | Best practices |
| "Get Directions" quick action | Easy | Microsoft FS |
| Real-time approval notifications | Medium | Modern workflows |

### Nice-to-Have (Phase 2)
- Swipe-to-change-status gestures
- Route optimization & "On My Way" button
- Employee performance dashboard
- In-app chat with job context
- Time tracking with auto-clock-in
- Job timeline view

### Future Consideration (Phase 3)
- Gamification (badges, streaks, leaderboards)
- Dark mode
- AI-powered job matching
- Voice commands

---

## TOP 5 PRIORITIES

1. **Fix Security Issue** - Add employer filter to schedule query
2. **Fix Race Condition** - Add database-level constraint for job claims
3. **Add Error States** - Replace silent failures with user feedback
4. **Fix useEffect Dependencies** - Memoize supabase client
5. **Replace alert() with Toast** - Improve UX across all pages

---

## GOLDEN RULES (From Previous Session)

### Database Keys
- **`job_sessions.assigned_to`** stores **`employees.id`**, NOT `auth.users.id`
- When querying jobs for an employee, always fetch the `employeeId` first from the `employees` table using `user_id`

### RLS Policies
- For employees to see their jobs (claimed, approved, refused), `assigned_to` must remain set
- Don't clear `assigned_to` when refusing - keep it so the employee can see the refusal reason

### Job Status Flow
```
OFFERED → CLAIMED → APPROVED → IN_PROGRESS → COMPLETED
                  → REFUSED (employee sees reason)
```

### React Hooks
- All `useState` declarations must be at the top of the component, in consistent order
- Never add hooks in the middle of a component (after functions) - causes "change in order of Hooks" error

### Query Patterns
- When resetting/unclaiming jobs, update database status (not just localStorage)
- `scheduled_time` can be null for CLAIMED jobs - make it optional with default (e.g., 9:00 AM)

---

## DETAILED QA FINDINGS

### CRITICAL BUGS & SECURITY ISSUES

1. **Race Condition in Employee Marketplace - Duplicate Job Claims**
   - **File**: `src/app/employee/marketplace/page.tsx`
   - **Lines**: 186-238
   - **Issue**: No optimistic locking or transaction handling when claiming a job. Two employees could simultaneously claim the same job.
   - **Fix**: Implement database-level constraints or atomic transactions with job status check

2. **Missing Authentication Check in Employer Schedule**
   - **File**: `src/app/employer/schedule/page.tsx`
   - **Lines**: 70-96
   - **Issue**: `fetchJobSessions()` doesn't filter by current employer's jobs. It fetches ALL job sessions.
   - **Fix**: Add `.eq('created_by', user.id)` or similar employer filtering

3. **XSS Vulnerability in Schedule Message**
   - **File**: `src/components/employer/ScheduleJobPopup.tsx`
   - **Lines**: 225
   - **Issue**: Message sent to employee is concatenated directly without sanitization
   - **Fix**: Sanitize user input before storage

4. **localStorage Data Not Synced Across Tabs**
   - **File**: `src/app/employee/marketplace/page.tsx`
   - **Lines**: 163-183
   - **Issue**: If user has multiple tabs open, swipe history won't sync
   - **Fix**: Use BroadcastChannel API or similar for cross-tab sync

5. **Auto-Update Race Condition**
   - **File**: `src/app/employee/jobs/[id]/page.tsx`
   - **Lines**: 144-150
   - **Issue**: Auto-updates status to IN_PROGRESS without checking for concurrent updates
   - **Fix**: Add `.eq('status', 'APPROVED')` to update query

### HIGH PRIORITY BUGS

6. **No Error User Feedback on Failed Operations**
   - Multiple files use `console.error()` with no user-facing feedback
   - **Fix**: Add error state and display toast/alert to users

7. **Missing Employee Status Check in Marketplace**
   - **File**: `src/app/employee/marketplace/page.tsx`
   - **Issue**: `handleClaimJob()` doesn't verify employee status before allowing claim
   - **Fix**: Check employee status is ACTIVE before claiming

8. **Reset All Button Partially Removes Data**
   - **File**: `src/app/employee/marketplace/page.tsx`
   - **Issue**: Only resets CLAIMED jobs, but UI shows CLAIMED, APPROVED, REFUSED
   - **Fix**: Update reset logic or clarify UI behavior

9. **Missing Null/Undefined Checks on Nested Objects**
   - **File**: `src/components/employer/ScheduleJobPopup.tsx`
   - **Issue**: Assumes `jobSession.job_template` always exists
   - **Fix**: Add null checks before accessing nested properties

10. **Missing Employer Status Gate**
    - **File**: `src/app/employer/layout.tsx`
    - **Issue**: No layout-level check for employer status (unlike employee layout)
    - **Fix**: Add employer status gate similar to employee

---

## DETAILED DEBUG FINDINGS

### Critical TypeScript Issues

1. **Type Assertion to 'any'**
   - **File**: `src/app/employee/jobs/[id]/page.tsx:137-142`
   ```typescript
   setJobData({
     session: session as any,  // Dangerous!
     steps: steps as any,
   })
   ```
   - **Fix**: Use proper type guards and validation

2. **Missing Dependency in useEffect**
   - **File**: `src/app/employee/marketplace/page.tsx:36-38, 138-142`
   - **Issue**: `loadData` depends on `supabase` which is recreated every render
   - **Fix**: Memoize supabase client with `useMemo`

3. **Unhandled .single() Error**
   - **File**: `src/app/employee/marketplace/page.tsx:44-48`
   - **Issue**: `.single()` throws if 0 or 2+ rows returned
   - **Fix**: Use `.maybeSingle()` instead

### React Issues

4. **Memory Leak - Missing Cleanup**
   - Multiple pages with useEffect that don't clean up
   - **Fix**: Add cleanup function with `isMounted` flag

5. **Duplicate Function Calls**
   - **File**: `src/components/employee/MyJobCard.tsx:184-262`
   - **Issue**: `renderActionButtons()` called twice in render
   - **Fix**: Store result in variable before rendering

### Logic Bugs

6. **Incorrect Date Parsing - Timezone Issues**
   - **File**: `src/app/employer/schedule/page.tsx:125`
   - **Issue**: `new Date(session.scheduled_date + 'T00:00:00')` assumes local timezone
   - **Fix**: Use date-fns with proper timezone handling

7. **No Validation on Date Input**
   - **File**: `src/components/employer/ScheduleJobPopup.tsx:475-492`
   - **Issue**: Users can reschedule jobs to past dates
   - **Fix**: Validate date is not in the past

---

## UI/UX RESEARCH SOURCES

- Jobber Vs Housecall Pro comparison
- Microsoft Dynamics 365 Field Service Mobile UX
- TaskRabbit UX/UI Design (Big Human)
- ServiceTitan Field Service Management
- CalJOBS App patterns
- Progress Trackers in UX Design (Arounda)
- Employee Performance Dashboards best practices
- Sorce - AI job matching with swipe interface

### Key Design Principles

1. **Mobile-First Always**: Design for the field, not the office
2. **Visual Over Text**: Use color, icons, and visual patterns extensively
3. **Reduce Friction**: Every extra tap is a barrier
4. **Real-Time Everything**: Users expect instant updates
5. **Offline-Capable**: Field work often lacks reliable connectivity
6. **Context-Aware**: Show right information at right time
7. **Progressive Disclosure**: Don't overwhelm with all features at once
