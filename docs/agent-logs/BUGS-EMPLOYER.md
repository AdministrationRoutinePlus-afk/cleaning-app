# Employer Features - Bug Report
**Date:** 2025-12-04
**Tested by:** TEST-AGENT

---

## Critical Bugs (Must Fix Immediately)

### BUG-EMPLOYER-001: Admin API Call from Client Component
- **Location:** `/src/src/app/employer/users/page.tsx:184`
- **Severity:** Critical
- **Status:** Open
- **Description:** Using `supabase.auth.admin.createUser()` in a client-side component. The admin API is only available server-side and requires the service role key, not the anon key.
- **Steps to reproduce:**
  1. Login as employer
  2. Navigate to Users > Customers tab
  3. Click "Add Customer"
  4. Fill in customer form (name, email, etc.)
  5. Click "Create Customer"
  6. Observe error in browser console
- **Expected:** Customer account created and added to database
- **Actual:** API call fails with error "admin API requires service role key"
- **Impact:** Customer creation feature completely broken
- **Fix Required:**
  ```typescript
  // Create new file: /src/src/app/api/customers/create/route.ts
  import { createClient } from '@/lib/supabase/server'
  import { NextResponse } from 'next/server'

  export async function POST(request: Request) {
    const supabase = createClient()
    const body = await request.json()

    // Create auth user (server-side has admin access)
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: body.email,
      email_confirm: true,
      user_metadata: {
        full_name: body.full_name,
        user_type: 'CUSTOMER'
      }
    })

    if (authError) return NextResponse.json({ error: authError }, { status: 400 })

    // Create customer record
    const { data, error } = await supabase
      .from('customers')
      .insert({ ...body, user_id: authData.user.id })
      .select()
      .single()

    if (error) return NextResponse.json({ error }, { status: 400 })
    return NextResponse.json({ data })
  }

  // Then in page.tsx, call the API:
  const response = await fetch('/api/customers/create', {
    method: 'POST',
    body: JSON.stringify(newCustomer)
  })
  ```

---

### BUG-EMPLOYER-002: Incorrect Foreign Key in Employee Activation
- **Location:** `/src/src/app/employer/users/page.tsx:84`
- **Severity:** Critical
- **Status:** Open
- **Description:** Setting `activated_by` to `user.id` (auth user id), but database schema expects employer.id (from employers table). This violates foreign key constraint.
- **Code:**
  ```typescript
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { error } = await supabase
    .from('employees')
    .update({
      status: 'ACTIVE' as EmployeeStatus,
      activated_by: user.id,  // ❌ WRONG - this is auth.users.id
      activated_at: new Date().toISOString()
    })
    .eq('id', employee.id)
  ```
- **Steps to reproduce:**
  1. Login as employer
  2. Navigate to Users > Employees tab
  3. Switch to "Pending" sub-tab
  4. Click "Activate" button on any pending employee
  5. Observe database error in console
- **Expected:** Employee status changes to ACTIVE, activated_by set, activated_at timestamp added
- **Actual:** Database error: "Foreign key violation on activated_by field"
- **Impact:** Cannot activate employees - core feature broken
- **Fix Required:**
  ```typescript
  const handleActivateEmployee = async (employee: Employee) => {
    try {
      // Get auth user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Get employer record
      const { data: employer } = await supabase
        .from('employers')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (!employer) return

      // Update employee with correct employer.id
      const { error } = await supabase
        .from('employees')
        .update({
          status: 'ACTIVE' as EmployeeStatus,
          activated_by: employer.id,  // ✅ CORRECT - employers.id
          activated_at: new Date().toISOString()
        })
        .eq('id', employee.id)

      if (error) throw error
      await loadData()
    } catch (error) {
      console.error('Error activating employee:', error)
    }
  }
  ```

---

### BUG-EMPLOYER-003: Missing Employer Filter - Security Issue
- **Location:** `/src/src/app/employer/users/page.tsx:39-64`
- **Severity:** Critical
- **Status:** Open
- **Description:** loadData() function doesn't filter employees/customers by current employer. Shows ALL employees/customers from ALL employers in the database. This is a data leak and security vulnerability.
- **Code:**
  ```typescript
  const loadData = async () => {
    setLoading(true)
    try {
      // Load employees - NO FILTER!
      const { data: employeesData, error: employeesError } = await supabase
        .from('employees')
        .select('*')  // ❌ Gets ALL employees
        .order('created_at', { ascending: false })

      // Load customers - NO FILTER!
      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select('*')  // ❌ Gets ALL customers
        .order('created_at', { ascending: false })
  ```
- **Steps to reproduce:**
  1. Create database with multiple employers (A, B, C)
  2. Each employer creates their own employees/customers
  3. Login as Employer A
  4. Navigate to Users page
  5. Observe employees/customers from Employers B and C
- **Expected:** Only show employees/customers where created_by = current_employer.id
- **Actual:** Shows all records from entire database
- **Impact:**
  - Data leak - employers see other employers' data
  - Privacy violation
  - Can accidentally manage wrong employees/customers
- **Fix Required:**
  ```typescript
  const loadData = async () => {
    setLoading(true)
    try {
      // Get current employer first
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: employer } = await supabase
        .from('employers')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (!employer) return

      // Load employees for THIS employer only
      const { data: employeesData, error: employeesError } = await supabase
        .from('employees')
        .select('*')
        .eq('created_by', employer.id)  // ✅ FILTER
        .order('created_at', { ascending: false })

      if (employeesError) throw employeesError
      setEmployees(employeesData || [])

      // Load customers for THIS employer only
      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select('*')
        .eq('created_by', employer.id)  // ✅ FILTER
        .order('created_at', { ascending: false })

      if (customersError) throw customersError
      setCustomers(customersData || [])
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }
  ```

---

## High Priority Bugs

### BUG-EMPLOYER-004: useEffect Missing Dependencies
- **Location:** `/src/src/app/employer/jobs/page.tsx:84-86`
- **Severity:** High
- **Status:** Open
- **Description:** useEffect has empty dependency array but uses fetchData which isn't memoized. ESLint react-hooks/exhaustive-deps warning.
- **Code:**
  ```typescript
  useEffect(() => {
    fetchData()
  }, []) // ❌ Missing fetchData in dependencies
  ```
- **Steps to reproduce:**
  1. Open file in IDE with ESLint enabled
  2. Observe warning on line 86
- **Expected:** No lint warnings
- **Actual:** Warning: "React Hook useEffect has a missing dependency: 'fetchData'"
- **Impact:** Potential stale closure issues, breaks React best practices
- **Fix Required:**
  ```typescript
  // Option 1: Add useCallback
  const fetchData = useCallback(async () => {
    // ... existing code
  }, [supabase, router])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Option 2: Move function inside useEffect
  useEffect(() => {
    const fetchData = async () => {
      // ... existing code
    }
    fetchData()
  }, [supabase, router])
  ```

---

### BUG-EMPLOYER-005: CommonJS require() in ES Module
- **Location:** `/src/src/app/employer/schedule/page.tsx:27`
- **Severity:** High
- **Status:** Open
- **Description:** Using CommonJS `require()` in ESM context. Should use ES6 import.
- **Code:**
  ```typescript
  const locales = {
    'en-US': require('date-fns/locale/en-US')  // ❌ CommonJS
  }
  ```
- **Steps to reproduce:**
  1. Run build with strict module settings
  2. May produce warnings
- **Expected:** Consistent ES6 imports
- **Actual:** Mixed module systems
- **Impact:** Potential build warnings, breaks consistency
- **Fix Required:**
  ```typescript
  import { enUS } from 'date-fns/locale'

  const locales = {
    'en-US': enUS  // ✅ ES6 import
  }
  ```

---

## Medium Priority Bugs

### BUG-EMPLOYER-006: Wrong Login Redirect Path
- **Location:** `/src/src/app/employer/settings/page.tsx:29`
- **Severity:** Medium
- **Status:** Open
- **Description:** Settings page redirects to `/login` instead of `/auth/login` when user not authenticated
- **Code:**
  ```typescript
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    window.location.href = '/login'  // ❌ Wrong path
    return
  }
  ```
- **Steps to reproduce:**
  1. Clear cookies/logout
  2. Navigate to http://localhost:3000/employer/settings
  3. Observe 404 error - /login doesn't exist
- **Expected:** Redirect to /auth/login
- **Actual:** Redirect to /login (404)
- **Impact:** Users can't access login from settings when logged out
- **Fix Required:**
  ```typescript
  if (!user) {
    window.location.href = '/auth/login'  // ✅ Correct
    return
  }
  ```

---

### BUG-EMPLOYER-007: Logout Redirect Path
- **Location:** `/src/src/app/employer/settings/page.tsx:234`
- **Severity:** Medium
- **Status:** Open
- **Description:** Same as BUG-006, logout redirects to /login instead of /auth/login
- **Code:**
  ```typescript
  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'  // ❌ Wrong
  }
  ```
- **Fix Required:**
  ```typescript
  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/auth/login'  // ✅ Correct
  }
  ```

---

## Low Priority / Code Quality Issues

### ISSUE-001: Missing Error Boundary for Calendar
- **Location:** `/src/src/app/employer/schedule/page.tsx:219`
- **Severity:** Low
- **Status:** Open
- **Description:** react-big-calendar can throw if data malformed. No error boundary.
- **Impact:** Could crash page if bad data
- **Suggested:** Wrap Calendar in error boundary component

---

### ISSUE-002: Inconsistent Date Formatting
- **Location:** Multiple files
- **Severity:** Low
- **Status:** Open
- **Description:** Date formatting done inline instead of shared utility
- **Impact:** Inconsistent formats, harder to maintain
- **Suggested:** Create `/src/src/lib/utils/formatDate.ts` utility

---

### ISSUE-003: Alert() Instead of Toast Notifications
- **Location:** Multiple files (e.g., users/page.tsx:226)
- **Severity:** Low
- **Status:** Open
- **Description:** Using browser alert() instead of proper toast notifications
- **Impact:** Poor UX, not modern
- **Suggested:** Implement toast notification system (e.g., sonner or react-hot-toast)

---

## Summary

**Total Bugs:** 7 critical/high, 2 medium, 3 low priority
**Blocking Features:**
- Customer creation (BUG-001)
- Employee activation (BUG-002)
- Multi-employer data isolation (BUG-003)

**Recommended Action Order:**
1. Fix BUG-003 first (security issue)
2. Fix BUG-002 (employee activation)
3. Fix BUG-001 (customer creation)
4. Fix BUG-004 & BUG-005 (code quality)
5. Fix BUG-006 & BUG-007 (redirects)
6. Address low priority issues as time permits

---

**Report Status:** Complete
**Next Step:** Developer review and fix implementation
