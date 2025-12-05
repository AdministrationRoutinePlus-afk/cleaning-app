# Session State - Cleaning App

**Last Updated:** December 5, 2025
**Status:** COMPLETE - All 3 Profiles Verified and Fixed

---

## LAST SESSION SUMMARY (Dec 5, 2025)

### EMPLOYEE PROFILE FIXES
**Task:** Verify Employee Profile against detailed plan and fix all gaps
**Result:** All 5 gaps identified and fixed

**Fixes Applied:**
1. **Job Image Display** - Added `image_url` to job_templates, updated MarketplaceJobCard
2. **My Jobs 5 Tabs** - Added Pending, Refused sections (was 4 tabs, now 5)
3. **Cancel Interest** - Added button + dialog on pending jobs
4. **Request Exchange** - Added button + dialog on approved jobs
5. **Two Weeks View** - Added work_week to Employee Schedule calendar

**SQL to Run:**
```sql
-- Run these in Supabase SQL Editor:

-- 1. Add image_url to job_templates
ALTER TABLE job_templates ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT NULL;

-- 2. Add REFUSED status (if enum exists)
-- Note: May need to check if enum already has this value
ALTER TYPE job_session_status ADD VALUE IF NOT EXISTS 'REFUSED' AFTER 'APPROVED';
```

### Previous: RLS FIX SESSION
**Problem:** Jobs and Settings pages not loading due to RLS policy conflicts
**Root Cause:** Duplicate/conflicting policy names from multiple SQL fix attempts
**Solution:** Dropped ALL policies using dynamic SQL, recreated with unique names

**Tables fixed:**
- `employers` - policies: employers_select, employers_insert, employers_update
- `job_templates` - policies: job_templates_employer_select/insert/update/delete
- `employer_settings` - policies: employer_settings_select/insert/update
- `company_info` - policies: company_info_select/insert/update

---

**JOBS TAB - COMPLETED!**
**EMPLOYER TAB 2: EMPLOYEES/CUSTOMERS - COMPLETED!**
**EMPLOYER TAB 3: SCHEDULE - COMPLETED!**

### Tab 1: JOBS - All features implemented
- 3 sections (Draft/Active/Current)
- Job naming convention (ABC-01A-A001)
- Customer Jobs linking, Random Jobs button (RND code)
- Notes field, Available Days selector, Time Window fields
- Recurring toggle + Frequency
- Activate/Deactivate, Delete, Edit, Duplicate actions
- Assign to Employee dialog
- Step-by-step instructions builder with checklist items and image upload

### Tab 2: EMPLOYEES/CUSTOMERS - All features implemented
**Employees:**
- Three subsections: Active, Pending, Inactive/Blocked
- Employee Profile page (`/employer/users/employee/[id]`)
- Full fields: name, email, phone, address, void cheque link, editable notes
- Status management: Activate, Deactivate, Block, Reactivate
- Job History with session details
- Evaluations from customers (rating + comments)
- Strikes system (MINOR/MAJOR/CRITICAL severity)

**Customers:**
- Customer creation with 3-letter code, notes field
- Customer Profile page (`/employer/users/customer/[id]`)
- Full editable fields: name, email, phone, address, notes
- Status management: Deactivate, Block, Reactivate
- Jobs linked to customer
- Evaluations submitted by customer
- Strikes system (MINOR/MAJOR/CRITICAL severity)

### Tab 3: SCHEDULE - All features implemented
**Calendar Views:**
- Day, Week, 2 Weeks (work_week), Month views
- Navigation between dates
- Mobile responsive design

**Job Colors (urgency-based for OFFERED, status-based for others):**
- Gray = Open (>4 days away)
- Orange = Warning (≤4 days away)
- Red = Urgent (≤2 days away)
- Yellow = Claimed
- Blue = Approved/Assigned
- Purple = In Progress
- Green = Completed
- Gray with red dashed border = Cancelled
- Teal = Evaluated

**Job Popup Actions:**
- View job details (code, date, time, duration, address, description)
- View assigned employee info
- Move Job (reschedule to new date/time)
- Modify Price/Hour (override template price for this session)
- Push to Messages (send notification to assigned employee)
- Cancel Job

**Files created/modified:**
- `/src/app/employer/schedule/page.tsx` - Enhanced with urgency colors, 2 weeks view
- `/src/components/employer/ScheduleJobPopup.tsx` - Added Modify Price and Push to Messages

**Next up:**
- EMPLOYER Tab 4: Messages page

---

## QUICK RESUME

```
Read these files to continue:
1. /docs/SESSION-STATE.md (THIS FILE)
2. /docs/agent-logs/BUGS.md (bug tracker)
3. /src/.env.local (credentials)
```

---

## COMPLETED

- Database (24 tables + fcm_tokens, RLS, storage)
- Employer features (5 tabs) ✅
  - Tab 1: Jobs
  - Tab 2: Users (Employees/Customers)
  - Tab 3: Schedule
  - Tab 4: Messages
  - Tab 5: Settings (Logo, Notifications with Firebase, Company Info, Account Management, Security)
- Employee features (5/5 tabs) ✅
  - Tab 1: Marketplace ✅
  - Tab 2: My Jobs ✅
  - Tab 3: Schedule ✅
  - Tab 4: Messages ✅
  - Tab 5: Profile/Settings ✅ (Personal Info, Documents, Availability, Push Notifications, Logout)
- Customer features (3/3 tabs) ✅
  - Tab 1: Reviews ✅ (Pending/Submitted, 1-5 stars + notes)
  - Tab 2: My Jobs ✅ (Read-only job templates with step-by-step)
  - Tab 3: Messages ✅ (Direct chat with employer)
- Apple-like UI design system applied
- Logo integrated (Routine+ / Groupe ABR)
- Firebase push notifications setup (permission request working)

---

## FIXES APPLIED THIS SESSION

### RLS Policy Fix
- Employer INSERT policy was blocking registration
- Fixed via SQL: `CREATE POLICY "Anyone can register as employer" ON employers FOR INSERT WITH CHECK (true);`

### Route Fixes
- `/auth/login` changed to `/login` in:
  - `src/app/employer/jobs/page.tsx`
  - `src/app/employer/jobs/new/page.tsx`

### Customer Creation Fix
- Removed `supabase.auth.admin.createUser()` call (requires service role key)
- Customers now created without auth user (can be invited later)
- Fixed `created_by` to use `employer.id` instead of `user.id`

### Job Creation Fix
- Removed `job_code` from insert (database generates it automatically)
- Added employerId validation before submit

### Email Confirmation
- Removed email confirmation check from login page
- Users need to be confirmed in Supabase Dashboard or via SQL:
  ```sql
  UPDATE auth.users SET email_confirmed_at = NOW() WHERE email = 'user@example.com';
  ```

### Root Page
- Changed from Next.js default to redirect to `/login`

### Job Edit Page (Dec 5)
- Created `/employer/jobs/[id]/edit/page.tsx`
- Loads job data, allows editing all fields
- Save as Draft or Activate
- Delete job functionality

### Apple Touch Icon (Dec 5)
- Copied logo.png to apple-touch-icon.png for PWA

---

## GOLDEN RULES

1. **ALWAYS send ntfy.sh notification when waiting for user input**
   ```bash
   curl -d "message" https://ntfy.sh/routine-plus-cleaning-app
   ```

2. **NEVER erase todo history** - Keep completed items as a record of what was accomplished. This helps track progress across sessions and learn from past work.

3. **Always Backup Before Changes** - Create backup before starting, after major features. Command: `./backup.sh`

4. **Use Version Control / Changelog** - Document every change with date, description, files modified, and WHY. File: `CHANGELOG.md`

5. **Make Small, Incremental Changes** - One feature/fix at a time. Commit after each. Test before moving to next task.

6. **Test After Each Change** - Run app locally, check different user roles, verify it works.

7. **Read Before Editing** - AI must read a file before modifying. Understand existing code. Don't assume - verify.

8. **Don't Trust Blindly** - User reviews what AI proposes. Ask questions if something seems wrong. User is final decision maker.

9. **Comment Your Code** - Add clear comments explaining logic. Document function purposes. Note workarounds/TODOs.

10. **Save Session Notes** - Update CHANGELOG.md during session. Document new features. Note issues encountered.

---

## JOB CODE FORMAT

```
ABC-01A-A001
│   │   │
│   │   └── SESSION: A001, A002, B001...
│   │       - Letter = batch (A=1st, B=2nd)
│   │       - Number = incremental (001, 002)
│   │
│   └── TEMPLATE: 01A
│       - 2 digits (01-99) = template number
│       - Letter (A, B, C) = version
│
└── CLIENT CODE: 3 letters
    - Customer code (DUP, MRC, etc.)
    - RND for random/one-time jobs
```

**Two Job Types:**
1. **Random Jobs** - No customer, code: RND-00A-A001
2. **Customer Jobs** - Linked to customer, uses their 3-letter code

**Key Points:**
- Template = reusable definition (ABC-01A)
- Session = each instance (ABC-01A-A001, A002...)
- Recurring jobs get unique code per instance (Mon=A001, Tue=A002...)

---

## TEST ACCOUNTS

### Employer
- Email: jean.michel.drouin2@gmail.com
- Password: (user's password)
- Status: Created, needs email confirmation in Supabase

### Customer Created
- Name: Jimmy
- Code: MRC
- No auth account (user_id = null)

---

## KNOWN ISSUES TO TEST

1. Job creation - just fixed, needs testing
2. Customer creation - fixed, needs testing
3. Employee registration flow
4. All other CRUD operations

---

## DESIGN SYSTEM

### Colors (globals.css)
- Primary: `#1d1d1f` (near-black)
- Accent: `#e85a2c` (orange-red from logo)
- Background: `#f5f5f7` (Apple light gray)
- Dark mode supported

### Animations
- `active:scale-[0.97]` press effect on buttons
- `animate-fade-in`, `animate-slide-up`, `animate-scale-in`
- `backdrop-blur-xl` on navigation (frosted glass)

### Updated Components
- Button - rounded-xl, press effects, accent variant
- Card - rounded-2xl, subtle shadows
- Input - rounded-xl, accent focus ring
- BottomNav - frosted glass, accent highlight

---

## DEV SERVER

```bash
cd /Users/jean-micheldrouin/cleaning-app/src
npm run dev
# http://localhost:3000
```

---

## SUPABASE

- Project: AdministrationRoutinePlus-afk's Project
- URL: https://ktweomrmoezepoihtyqn.supabase.co
- Dashboard: Authentication > Users to manage accounts

---

## NOTIFICATIONS

ntfy.sh topic: `routine-plus-cleaning-app`
```bash
curl -d "message" https://ntfy.sh/routine-plus-cleaning-app
```

---

## FILE STRUCTURE

```
/Users/jean-micheldrouin/cleaning-app/
├── database/           # SQL schema files
├── docs/
│   ├── SESSION-STATE.md
│   ├── agents/         # Agent instructions
│   └── agent-logs/     # Bug tracker, test results
└── src/                # Next.js app
    └── src/
        ├── app/        # Pages (employer, employee, customer)
        ├── components/ # UI components
        ├── lib/        # Supabase client
        └── types/      # database.ts (single source of truth)
```

---

## DETAILED APP PLAN

**Full plan file:** `/Users/jean-micheldrouin/.claude/plans/breezy-stargazing-dove.md` (2525 lines)

### SUMMARY: 3 Profiles, 13 Tabs, 24 Tables

---

### PROFILE 1: EMPLOYER (5 tabs)

#### Tab 1: JOBS
**Sections:** Draft | Active | Current (offered/in-progress)

**Job Naming:** `ABC-01A-A001`
- ABC = 3-letter client code
- 01 = template number (01-99)
- A = version letter
- A001 = session code

**Two Job Types:**
1. **Random Jobs** - One-time, no customer (code: RND-00A-A001)
2. **Customer Jobs** - Linked to customer profile

**Job Template Fields:**
- Title, Description, Address, Duration, Price/Hour, Notes
- Timezone, Available Days, Time Window
- Recurrence (one-time or X times/week forever)
- Status: DRAFT or ACTIVE
- Step-by-step instructions (optional)

**Each Step Has:**
- Title, Description, Products Needed
- Images (reference photos)
- Checklist items

**Session Statuses:**
OFFERED → CLAIMED → APPROVED → IN_PROGRESS → COMPLETED → EVALUATED (or CANCELLED)

---

#### Tab 2: EMPLOYEES/CUSTOMERS

**CUSTOMERS Section:**
- Customer Code (3 letters, e.g., DUP)
- Full Name, Email, Phone, Address, Notes
- Status: ACTIVE / INACTIVE / BLOCKED
- Features: Job History, Evaluations, Strikes
- Employer creates customer credentials

**EMPLOYEES Section:**
- Two sub-sections: Active Employees | Pending Registrations
- Registration Flow: Self-register → Pending → Employer Activates
- Fields: Name, Email, Phone, Address, Void Cheque, Notes
- Status: PENDING / ACTIVE / INACTIVE / BLOCKED
- Features: Job History, Evaluations, Strikes

**Strikes System (both):**
- Date, Description, Notes, Severity (Minor/Major/Critical)
- Strike History View with filters

---

#### Tab 3: SCHEDULE
**Calendar Views:** Day | Week | Two Weeks | Month

**Job Colors:**
- Gray = Open (not claimed, >4 days away)
- Yellow/Orange = Warning (not claimed, ≤4 days)
- Red = Urgent (not claimed, ≤2 days)
- Blue = Claimed/Assigned
- Green = Completed

**Job Popup Actions:**
- Cancel Job, Move Job, Modify Price/Hour
- Push to Messages (send to employee with custom note)

---

#### Tab 4: MESSAGES
**Types:**
1. Direct Messages (1-on-1 with employees)
2. Announcements (broadcast to all employees, one-way)
3. Employee Group Chat (employer can view)
4. Job Push Messages (from Schedule)

**Auto Reminders:** 2 days, 1 day, 6 hours before job (configurable)

**Exchange Approvals:** Employee swap requests appear here

---

#### Tab 5: SETTINGS
**Sections:**
- App Appearance (theme, primary color, logo, language)
- Notifications (toggles for each type)
- Company Info (name, phone, email, address, default rate, tax number)
- Account Management (block employees/customers)
- Account Security (password, logout, delete)

---

### PROFILE 2: EMPLOYEE (5 tabs)

#### Tab 1: MARKETPLACE
**Swipe Interface (Tinder-like):**
- Swipe RIGHT = Interested → goes to "Interested" section
- Swipe LEFT = Not interested → goes to "Garbage" section

**Job Card Shows:**
- Job Image, Job Code, Duration, Schedule Window, Price/Hour, Description

**Each session has unique code:** DUP-01A-A001, A002, A003...

---

#### Tab 2: MY JOBS
**Sections:**
- Interested (swiped right, waiting)
- Pending (employer reviewing)
- Approved (scheduled!)
- Refused (employer declined)

**Actions:** View Details, Start Job, Complete Job, Request Exchange

---

#### Tab 3: SCHEDULE
**Calendar Views:** Day | Week | Two Weeks | Month

**Features:**
- Export to Google/Apple/Outlook Calendar
- Personal Reminders (1 day, 6 hours, 1 hour, custom)

**Start Job → Step-by-Step Execution Mode**

---

#### Step-by-Step Execution (when job starts)
**Two View Modes:**
1. List Mode - See all steps as checklist
2. Swipe Mode - Swipe through cards one-by-one

**Each Step Shows:**
- Step Number, Title, Description
- Products Needed
- Reference Images
- Checklist Items

**Progress Tracking:** Progress bar, time elapsed, saves progress

---

#### Tab 4: MESSAGES
**Types:**
1. Direct Chat with Employer
2. Announcements (read-only)
3. Employee Group Chat
4. Job Push Messages

**Exchange Section:**
- Only APPROVED jobs can be exchanged
- Post job → Others request → Pick recipient → Employer approves

---

#### Tab 5: PROFILE/SETTINGS
**Personal Info:** Name, Email, Phone, Address
**Documents:** Void Cheque upload
**Notes:** For employer to see
**Availability:** Days of week OR specific calendar dates (optional, non-binding)
**App Settings:** Theme, Language, Notifications, Sound

---

### PROFILE 3: CUSTOMER (3 tabs)

#### Tab 1: REVIEWS
- Submit evaluation when job COMPLETED
- Rating: 1-5 stars + Notes
- Reviews sent to BOTH employer AND employee
- Sections: Pending Reviews | Submitted Reviews

---

#### Tab 2: MY JOBS
- View job templates linked to this customer
- Job Code, Title, Description, Frequency, Duration, Next Scheduled
- READ-ONLY (customer cannot edit)
- Can view step-by-step instructions

---

#### Tab 3: MESSAGES
- Direct Chat with employer only
- Full conversation history

---

### DATABASE (24 Tables)

**Jobs (7):** job_templates, job_steps, job_step_images, job_step_checklist, job_sessions, job_session_progress, job_session_checklist_progress

**Users (4):** employers, employees, customers, company_info

**Messages (4):** conversations, conversation_participants, messages, schedule_messages

**Interactions (4):** evaluations, strikes, job_exchanges, notifications

**Settings (3):** employer_settings, notification_settings, reminder_settings

**Availability (2):** employee_availability, employee_availability_dates

**Storage Buckets (2):** job-images, employee-documents

---

### STATUS ENUMS

**Job Template:** DRAFT, ACTIVE
**Job Session:** OFFERED, CLAIMED, APPROVED, IN_PROGRESS, COMPLETED, EVALUATED, CANCELLED
**Employee:** PENDING, ACTIVE, INACTIVE, BLOCKED
**Customer:** ACTIVE, INACTIVE, BLOCKED
**Exchange:** PENDING, APPROVED, DENIED
**Strike Severity:** MINOR, MAJOR, CRITICAL

---

### NOTIFICATION TYPES

**Employer receives:**
- JOB_CLAIMED, EXCHANGE_REQUEST, JOB_COMPLETED, NEW_REGISTRATION, NEW_MESSAGE, EVALUATION_SUBMITTED

**Employee receives:**
- JOB_APPROVED, JOB_REFUSED, EXCHANGE_APPROVED, EXCHANGE_DENIED, JOB_PUSHED, REMINDER_2_DAYS, REMINDER_1_DAY, REMINDER_6_HOURS, NEW_MESSAGE, NEW_ANNOUNCEMENT, NEW_EVALUATION

**Customer receives:**
- JOB_COMPLETED, NEW_MESSAGE

**ALL notifications toggleable ON/OFF per user!**
