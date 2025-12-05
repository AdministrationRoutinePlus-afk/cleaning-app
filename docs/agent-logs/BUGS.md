# Bug Tracker - Cleaning App

## Open Bugs

### BUG-001: Missing dependency array in marketplace useEffect
- **Location:** /Users/jean-micheldrouin/cleaning-app/src/src/app/employee/marketplace/page.tsx:39-43
- **Severity:** Low
- **Description:** useEffect on line 39 has dependency [userId] but calls loadData() which depends on other state
- **Steps to reproduce:**
  1. Load marketplace page
  2. Check React warnings in console
- **Expected:** No React warnings about missing dependencies
- **Actual:** Potential stale closure issues
- **Fix:** Add loadData to dependency array or wrap in useCallback

### BUG-002: Incorrect route in MyJobCard component ✅ FIXED
- **Location:** /Users/jean-micheldrouin/cleaning-app/src/src/components/employee/MyJobCard.tsx:76 and 92
- **Severity:** Critical
- **Status:** FIXED
- **Description:** Component routes to `/employee/jobs/${id}/execute` but the actual page is at `/employee/jobs/[id]/page.tsx`
- **Fix Applied:** Changed routes from `/employee/jobs/${jobSession.id}/execute` to `/employee/jobs/${jobSession.id}`

### BUG-003: JobStepChecklist type not properly documented
- **Location:** /Users/jean-micheldrouin/cleaning-app/src/src/types/database.ts:144-149
- **Severity:** Low
- **Description:** JobStepChecklist interface exists but doesn't extend BaseTable (no created_at). Table exists in database.
- **Steps to reproduce:**
  1. Check database.ts type definition
  2. Compare to other table types
- **Expected:** Should extend BaseTable or have consistent structure
- **Actual:** Missing standard fields that other tables have
- **Fix:** Update type to extend BaseTable if appropriate, or add comment explaining why it doesn't

### BUG-004: Foreign key constraint in ExchangeBoard query
- **Location:** /Users/jean-micheldrouin/cleaning-app/src/src/components/employee/ExchangeBoard.tsx:81-82
- **Severity:** Medium
- **Description:** Query uses `employees!job_exchanges_from_employee_id_fkey(*)` which assumes specific foreign key name
- **Steps to reproduce:**
  1. Navigate to Messages > Exchange tab
  2. Check console for query errors
- **Expected:** Query should work regardless of FK constraint name
- **Actual:** May fail if FK constraint has different name
- **Fix:** Use simpler join syntax: `from_employee:employees(*)` or verify FK name in database

### BUG-005: Missing error handling for exchange requests
- **Location:** /Users/jean-micheldrouin/cleaning-app/src/src/components/employee/ExchangeBoard.tsx:143-158
- **Severity:** Low
- **Description:** "Ask for job" button doesn't handle case where employee already requested the same job
- **Steps to reproduce:**
  1. Click "Ask for it" on an available exchange
  2. Click it again (if still visible)
  3. May create duplicate request or error
- **Expected:** Should prevent duplicate requests or show appropriate message
- **Actual:** No validation for duplicate requests
- **Fix:** Add check for existing request before inserting

### BUG-006: EmployeeAvailabilityDate type missing BaseTable extension
- **Location:** /Users/jean-micheldrouin/cleaning-app/src/src/types/database.ts:305-311
- **Severity:** Low
- **Description:** EmployeeAvailabilityDate doesn't extend BaseTable (no created_at). Table exists in database as 'employee_availability_dates'.
- **Steps to reproduce:**
  1. Check database.ts type definition
  2. Compare to other table types
- **Expected:** Should extend BaseTable for consistency
- **Actual:** Missing standard fields
- **Fix:** Update type to extend BaseTable if database has created_at field

### BUG-007: Storage bucket 'employee-documents' assumed to exist
- **Location:** /Users/jean-micheldrouin/cleaning-app/src/src/components/employee/DocumentUpload.tsx:45-47
- **Severity:** Medium
- **Description:** Component uploads to 'employee-documents' bucket without checking if it exists
- **Steps to reproduce:**
  1. Navigate to Profile > Documents
  2. Try to upload void cheque
  3. May fail if bucket doesn't exist
- **Expected:** Should check bucket exists or handle error gracefully
- **Actual:** Will fail with unclear error if bucket missing
- **Fix:** Add bucket existence check or better error message, or ensure bucket is created in setup

### BUG-008: Inconsistent toggling logic in StepChecklist
- **Location:** /Users/jean-micheldrouin/cleaning-app/src/src/components/employee/StepChecklist.tsx:22
- **Severity:** Low
- **Description:** Toggle function passes !currentState but the callback expects the currentState, could cause confusion
- **Steps to reproduce:**
  1. Review code logic
  2. Note that onToggle receives the inverted state
- **Expected:** Callback should receive currentState and handle inversion internally OR be clearly documented
- **Actual:** Inversion happens in child component
- **Fix:** Document the API or refactor to be more explicit about toggle behavior

---

## Fixed Bugs

### BUG-000: auth_user_id vs user_id mismatch
- **Location:** login/page.tsx, register/page.tsx
- **Severity:** Critical
- **Status:** FIXED
- **Description:** Auth pages used wrong column name
- **Fix:** Changed auth_user_id to user_id

### BUG-009: Manual timestamp creation in register page
- **Location:** /Users/jean-micheldrouin/cleaning-app/src/src/app/register/page.tsx:73-74, 90-91
- **Severity:** Low
- **Description:** Registration manually creates created_at and updated_at timestamps instead of relying on database defaults
- **Steps to reproduce:**
  1. Register new account (employer or employee)
  2. Check timestamps in database
- **Expected:** Database should auto-generate timestamps via default values
- **Actual:** Client manually creates timestamps using new Date().toISOString()
- **Fix:** Remove manual timestamp fields from insert statements and rely on database defaults
- **Impact:** Minor timestamp inconsistency (client time vs server time), unnecessary code

### BUG-010: Missing email confirmation check in login
- **Location:** /Users/jean-micheldrouin/cleaning-app/src/src/app/login/page.tsx:28-33
- **Severity:** Medium
- **Description:** Login does not check if email is confirmed before allowing access
- **Steps to reproduce:**
  1. Register new account
  2. Do not confirm email
  3. Try to login
  4. System may allow access without email verification (depends on Supabase config)
- **Expected:** Should check authData.user.email_confirmed_at or handle email confirmation flow
- **Actual:** No email confirmation check in login flow
- **Fix:** Add email confirmation check or ensure Supabase project has email confirmation properly configured
- **Impact:** Users with unconfirmed emails may access the system
