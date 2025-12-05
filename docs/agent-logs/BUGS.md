# Bug Tracker - Cleaning App

## Session Notes (Dec 4, 2025)

### What Was Done This Session:
1. Applied Apple-like UI design system with Routine+ branding
2. Fixed RLS policy for employer registration
3. Fixed route errors (/auth/login -> /login)
4. Fixed customer creation (removed admin API call)
5. Fixed job creation (removed job_code from insert)
6. Created test employer account
7. Created test customer (Jimmy/MRC)

### Subagents Used:
- Test agents (previous session) - found 10 bugs
- Bug fix agent (previous session) - fixed all 10 bugs
- No subagents this session - direct fixes only

### Next Steps When Resuming:
1. Confirm employer email in Supabase Dashboard
2. Test job creation flow
3. Test employee registration and activation
4. Test full workflow end-to-end

---

## Open Bugs

### BUG-002: Incorrect route in MyJobCard component ✅ FIXED
- **Location:** /Users/jean-micheldrouin/cleaning-app/src/src/components/employee/MyJobCard.tsx:76 and 92
- **Severity:** Critical
- **Status:** FIXED
- **Description:** Component routes to `/employee/jobs/${id}/execute` but the actual page is at `/employee/jobs/[id]/page.tsx`
- **Fix Applied:** Changed routes from `/employee/jobs/${jobSession.id}/execute` to `/employee/jobs/${jobSession.id}`






---

## Fixed Bugs

### BUG-000: auth_user_id vs user_id mismatch
- **Location:** login/page.tsx, register/page.tsx
- **Severity:** Critical
- **Status:** FIXED
- **Description:** Auth pages used wrong column name
- **Fix:** Changed auth_user_id to user_id

### BUG-001: Missing dependency array in marketplace useEffect ✅ FIXED
- **Location:** /Users/jean-micheldrouin/cleaning-app/src/src/app/employee/marketplace/page.tsx:39-43
- **Severity:** Low
- **Status:** FIXED
- **Description:** useEffect on line 39 has dependency [userId] but calls loadData() which depends on other state
- **Fix Applied:** Wrapped loadData in useCallback with proper dependencies [userId, supabase] and added to useEffect dependency array

### BUG-003: JobStepChecklist type not properly documented ✅ FIXED
- **Location:** /Users/jean-micheldrouin/cleaning-app/src/src/types/database.ts:144-149
- **Severity:** Low
- **Status:** FIXED
- **Description:** JobStepChecklist interface exists but doesn't extend BaseTable (no created_at). Table exists in database.
- **Fix Applied:** Added comment explaining why it doesn't extend BaseTable (simple lookup table with minimal fields)

### BUG-004: Foreign key constraint in ExchangeBoard query ✅ FIXED
- **Location:** /Users/jean-micheldrouin/cleaning-app/src/src/components/employee/ExchangeBoard.tsx:81-82
- **Severity:** Medium
- **Status:** FIXED
- **Description:** Query uses `employees!job_exchanges_from_employee_id_fkey(*)` which assumes specific foreign key name
- **Fix Applied:** Changed to simpler join syntax `employees!from_employee_id(*)` in both loadAvailableExchanges and loadMyRequests

### BUG-005: Missing error handling for exchange requests ✅ FIXED
- **Location:** /Users/jean-micheldrouin/cleaning-app/src/src/components/employee/ExchangeBoard.tsx:143-158
- **Severity:** Low
- **Status:** FIXED
- **Description:** "Ask for job" button doesn't handle case where employee already requested the same job
- **Fix Applied:** Added check for existing requests before allowing duplicate, validates to_employee_id is null, shows appropriate messages

### BUG-006: EmployeeAvailabilityDate type missing BaseTable extension ✅ FIXED
- **Location:** /Users/jean-micheldrouin/cleaning-app/src/src/types/database.ts:305-311
- **Severity:** Low
- **Status:** FIXED
- **Description:** EmployeeAvailabilityDate doesn't extend BaseTable (no created_at). Table exists in database as 'employee_availability_dates'.
- **Fix Applied:** Added comment explaining why it doesn't extend BaseTable (configuration table where created_at tracking is not required)

### BUG-007: Storage bucket 'employee-documents' assumed to exist ✅ FIXED
- **Location:** /Users/jean-micheldrouin/cleaning-app/src/src/components/employee/DocumentUpload.tsx:45-47
- **Severity:** Medium
- **Status:** FIXED
- **Description:** Component uploads to 'employee-documents' bucket without checking if it exists
- **Fix Applied:** Added bucket existence check before upload with clear error messages directing users to contact administrator

### BUG-008: Inconsistent toggling logic in StepChecklist ✅ FIXED
- **Location:** /Users/jean-micheldrouin/cleaning-app/src/src/components/employee/StepChecklist.tsx:22
- **Severity:** Low
- **Status:** FIXED
- **Description:** Toggle function passes !currentState but the callback expects the currentState, could cause confusion
- **Fix Applied:** Added clear documentation to onToggle prop explaining it receives NEW state (after toggle)

### BUG-009: Manual timestamp creation in register page ✅ FIXED
- **Location:** /Users/jean-micheldrouin/cleaning-app/src/src/app/register/page.tsx:73-74, 90-91
- **Severity:** Low
- **Status:** FIXED
- **Description:** Registration manually creates created_at and updated_at timestamps instead of relying on database defaults
- **Fix Applied:** Removed created_at and updated_at from both employer and employee insert statements, database defaults now handle timestamps

### BUG-010: Missing email confirmation check in login ✅ FIXED
- **Location:** /Users/jean-micheldrouin/cleaning-app/src/src/app/login/page.tsx:28-33
- **Severity:** Medium
- **Status:** FIXED
- **Description:** Login does not check if email is confirmed before allowing access
- **Fix Applied:** Added check for email_confirmed_at before allowing login, signs out user and shows clear error message if email not confirmed
