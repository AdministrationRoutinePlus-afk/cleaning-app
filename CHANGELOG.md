# Cleaning App - Changelog

## Project Info
- **Repository:** /Users/jean-micheldrouin/cleaning-app/
- **Stack:** Next.js 14 + Supabase + Vercel + PWA
- **Status:** Planning Phase
- **App Type:** Progressive Web App (PWA)

---

## December 4, 2025

### Session 1 - Project Setup & Planning

#### 08:42 - Project Initialized
**Actions taken:**
1. Created project folder structure:
   ```
   /Users/jean-micheldrouin/cleaning-app/
   ├── docs/          # Documentation files
   ├── backups/       # Project backups
   ├── src/           # Source code (will contain Next.js app)
   ├── RULES.md       # Golden rules for development
   ├── CHANGELOG.md   # This file - session logs
   └── PROJECT.md     # App specifications (pending)
   ```

2. Created RULES.md with:
   - Golden rules adapted from Shopify project
   - Quick reference commands
   - Session checklists

3. Created CHANGELOG.md (this file)

#### App Concept Defined:
- **Type:** Job ticket marketplace for cleaning services
- **Users:** 3 roles (Employer, Employee, Customer)
- **Core flow:**
  - Employer creates job tickets
  - Employees pick from marketplace
  - Employer approves/schedules
  - Customer evaluates completed jobs

#### ~09:00 - Subagent System Created
**Decision:** Build a team of 12 specialized agents to handle development tasks.

**Agent Architecture:**
```
ORCHESTRATOR (Main Claude)
        │
        ▼
CODE RESEARCH → finds existing solutions online
        │
        ▼
DOMAIN SPECIALISTS (Advisors - define WHAT)
├── Employer Specialist
├── Employee Specialist
└── Customer Specialist
        │
        ▼
DEVELOPMENT (Build HOW)
├── Frontend Agent
├── Backend Agent
└── Database Agent
        │
        ▼
QUALITY CONTROL
├── Testing Agent
├── Debug Agent
├── UI/UX Validator
└── Security Agent
```

**Files Created:**
- `docs/agents/AGENTS-OVERVIEW.md` - Master agent documentation
- `docs/agents/agent-code-research.md`
- `docs/agents/agent-employer-specialist.md`
- `docs/agents/agent-employee-specialist.md`
- `docs/agents/agent-customer-specialist.md`
- `docs/agents/agent-frontend.md`
- `docs/agents/agent-backend.md`
- `docs/agents/agent-database.md`
- `docs/agents/agent-debug.md`
- `docs/agents/agent-testing.md`
- `docs/agents/agent-ui-validator.md`
- `docs/agents/agent-security.md`

**Key Decision:** Domain Specialists are ADVISORS (define requirements), not coders. Frontend/Backend agents handle all actual code to ensure consistency.

#### ~09:15 - PWA Confirmed
**Decision:** App will be a Progressive Web App (PWA)
- Installable on phone home screen
- Works offline
- No app store needed
- Mobile-first design

**Updated:** All agent specs aligned with PWA stack:
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Supabase
- Vercel

#### ~09:30 - Workflow Documentation Created
**Created comprehensive workflow docs:**
- `docs/HOW-TO-WORK.md` - Complete guide with:
  - Quick start command
  - All agent names and purposes
  - Prompt templates for each agent
  - Example feature build workflow
  - Backup commands
- `docs/WORK-LOG.md` - Tracks all agent interactions
- `start.sh` - Quick start script

#### ~10:00 - Agent System Tested
- Tested Code Research agent (PWA setup) - SUCCESS
- Tested parallel agents (Employer, Employee, Customer, Database) - SUCCESS
- System working correctly

#### ~10:15 - Feature Planning Started (PAUSED)
**Started planning Employer profile tabs:**
- Confirmed 5 tabs: Jobs, Employees/Customers, Schedule, Messages, Settings
- Started defining Jobs tab (paused mid-planning)
- Plan saved to: `/Users/jean-micheldrouin/.claude/plans/breezy-stargazing-dove.md`

#### ~10:30 - Research Resources Generated
**Ran 3 Code Research agents in parallel:**
- Agent 1: Found 20 proven code solutions/libraries
- Agent 2: Found 20 UI designs/templates to copy
- Agent 3: Found 20 ready-to-use components

**Saved to:** `/Users/jean-micheldrouin/cleaning-app/docs/RESEARCH-RESOURCES.md`
- All links included for visual browsing
- Install commands ready
- Demos and previews linked

---

## Pending Tasks
- [ ] Finalize app features with detailed discussion
- [ ] Answer remaining questions in PROJECT.md
- [ ] Design database schema (Supabase tables)
- [ ] Set up Supabase project
- [ ] Set up Vercel project
- [ ] Initialize Next.js app with PWA config
- [ ] Define color scheme / design system

---

## Notes
- Following "vibe coding" golden rules from Shopify project
- All changes documented in this file
- Backups to be created before major changes
- 12 specialized agents ready to assist development

---

## Quick Start (Next Session)

**Option 1 - Use the script:**
```bash
/Users/jean-micheldrouin/cleaning-app/start.sh
```

**Option 2 - Manual:**
```bash
cd /Users/jean-micheldrouin/cleaning-app && claude
```

---

## TO RESUME FEATURE PLANNING (Copy-paste this)

```
I'm working on the Cleaning App project. Read these files:
- /Users/jean-micheldrouin/cleaning-app/RULES.md
- /Users/jean-micheldrouin/cleaning-app/CHANGELOG.md
- /Users/jean-micheldrouin/cleaning-app/PROJECT.md
- /Users/jean-micheldrouin/.claude/plans/breezy-stargazing-dove.md

We were planning Employer profile tabs. Resume where we left off - defining the Jobs tab.
```

---

**Full documentation:** See `docs/HOW-TO-WORK.md` for agent commands and workflows.

---

## December 5, 2025

### Session - Major Feature Implementation

#### Employer Profile - Tab 1: Jobs ✅
- Created job templates system with job codes (e.g., "CLN-001")
- CRUD operations for job templates
- Job details: title, description, duration, price, customer assignment
- Job sessions created from templates

#### Employer Profile - Tab 2: Users (Employees/Customers) ✅
- Two sub-tabs: Employees and Customers
- Full CRUD for both user types
- Employee fields: name, email, phone, status (ACTIVE/INACTIVE)
- Customer fields: name, email, phone, address
- Linking employees/customers to auth user accounts

#### Employer Profile - Tab 3: Schedule ✅
- Calendar view using react-big-calendar
- Views: Day, Week, 2 Weeks, Month
- Color-coded job statuses:
  - Gray: Open (>4 days away)
  - Orange: Warning (≤4 days)
  - Red: Urgent (≤2 days)
  - Yellow: Claimed
  - Blue: Approved
  - Purple: In Progress
  - Green: Completed
  - Teal: Evaluated
- Job popup with actions:
  - View details & assigned employee
  - Cancel Job
  - Move Job (reschedule)
  - Modify Price/Hour
  - Push to Messages (send to ANY employees, not just assigned)

#### Employer Profile - Tab 4: Messages ✅
- 5 sub-tabs implemented:
  1. **Chat** - Direct 1-on-1 conversations with employees
  2. **News** - Broadcast announcements to all employees
  3. **Team** - Read-only view of employee group chat
  4. **Jobs** - Messages pushed from Schedule tab
  5. **Swap** - Exchange request approvals

#### Employee Profile ✅
- **Marketplace** - Browse available jobs, claim jobs
- **My Jobs** - View claimed/approved jobs
- **Schedule** - Personal calendar view
- **Messages** - 5 tabs (Boss, Jobs, News, Team, Swap)
- Profile page - NOT YET DONE

#### Database/RLS Fixes
- Fixed infinite recursion in conversation_participants RLS
- Created `get_user_conversation_ids()` SECURITY DEFINER function
- Fixed schedule_messages INSERT policy with `WITH CHECK (true)`
- Fixed duplicate key issues in marketplace

#### Mobile Responsiveness
- Compact tab labels for small screens (10px on mobile)
- Notification badges as floating circles
- Bottom nav has iPhone safe-area support
- Calendar CSS responsive breakpoints

---

### Current Status

**EMPLOYER Profile:**
- [x] Tab 1: Jobs
- [x] Tab 2: Users (Employees/Customers)
- [x] Tab 3: Schedule
- [x] Tab 4: Messages
- [x] Tab 5: Settings (Logo, Notifications, Company Info, Account Management, Security)

**EMPLOYEE Profile:**
- [x] Marketplace
- [x] My Jobs
- [x] Schedule
- [x] Messages
- [ ] Profile

**CUSTOMER Profile:**
- [ ] Not started

---

#### Employer Settings Tab - COMPLETED 100%
- Added Logo Upload to Appearance Settings (with Supabase storage)
- Added Account Management section (centralized block/unblock for employees & customers)
- Added Change Email to Account Security

**Files created:**
- `/src/components/employer/AccountManagement.tsx`
- `/database/create_company_logos_bucket.sql`

---

### Key Files Modified
- `/src/app/employer/jobs/page.tsx`
- `/src/app/employer/users/page.tsx`
- `/src/app/employer/schedule/page.tsx`
- `/src/app/employer/messages/page.tsx`
- `/src/app/employee/marketplace/page.tsx`
- `/src/app/employee/jobs/page.tsx`
- `/src/app/employee/schedule/page.tsx`
- `/src/app/employee/messages/page.tsx`
- `/src/components/employer/ScheduleJobPopup.tsx`
- `/src/components/employer/ChatView.tsx`
- `/src/components/employer/ConversationList.tsx`
- `/src/components/employer/AnnouncementForm.tsx`
- `/src/components/employer/ExchangeRequestCard.tsx`
- `/src/components/employee/ExchangeBoard.tsx`
- `/database/fix_conversation_rls_v2.sql`
- `/database/fix_schedule_messages_rls_v2.sql`

---

### Session Continued - December 5, 2025 (Later)

#### Issue: Settings Page RLS Error
- Settings page showing "Error loading settings: {}"
- Cause: RLS policies blocking access to `employer_settings` and `company_info` tables

#### SQL Fixes Created:
- `/database/fix_settings_rls.sql` - Initial fix for settings RLS
- `/database/fix_settings_rls_v2.sql` - More comprehensive fix with table creation

#### Issue: Jobs Disappeared After RLS Fixes
- After running settings RLS fixes, Jobs page showed 0 jobs
- Jobs existed before the fix was applied
- Created `/database/fix_job_templates_rls.sql` to restore job_templates policies

#### Action Completed ✅
Fixed all RLS policies by:
1. Dropping ALL existing policies using dynamic SQL
2. Re-creating clean policies with unique names
3. Root cause: Duplicate/conflicting policy names were causing issues

#### Final working SQL (run in Supabase SQL Editor):
```sql
-- Check data exists
SELECT 'job_templates count:' as check, count(*) from job_templates;
SELECT 'employers count:' as check, count(*) from employers;

-- Recreate job_templates RLS policies
DROP POLICY IF EXISTS "Employers can view own job templates" ON job_templates;
DROP POLICY IF EXISTS "Employers can create job templates" ON job_templates;
DROP POLICY IF EXISTS "Employers can update job templates" ON job_templates;
DROP POLICY IF EXISTS "Employers can delete job templates" ON job_templates;
DROP POLICY IF EXISTS "Employees can view active jobs" ON job_templates;
DROP POLICY IF EXISTS "Customers can view their job templates" ON job_templates;

ALTER TABLE job_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employers can view own job templates"
ON job_templates FOR SELECT
USING (created_by IN (SELECT id FROM employers WHERE user_id = auth.uid()));

CREATE POLICY "Employees can view active jobs"
ON job_templates FOR SELECT
USING (status = 'ACTIVE' AND EXISTS (SELECT 1 FROM employees WHERE user_id = auth.uid() AND status = 'ACTIVE'));

CREATE POLICY "Customers can view their job templates"
ON job_templates FOR SELECT
USING (customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid()));

CREATE POLICY "Employers can create job templates"
ON job_templates FOR INSERT
WITH CHECK (created_by IN (SELECT id FROM employers WHERE user_id = auth.uid()));

CREATE POLICY "Employers can update job templates"
ON job_templates FOR UPDATE
USING (created_by IN (SELECT id FROM employers WHERE user_id = auth.uid()));

CREATE POLICY "Employers can delete job templates"
ON job_templates FOR DELETE
USING (created_by IN (SELECT id FROM employers WHERE user_id = auth.uid()));
```

#### Settings Tab Review
| Section | Status | Notes |
|---------|--------|-------|
| App Appearance | Partial | Logo, color, language work. **Dark mode saves but doesn't apply to UI** (needs theme provider) |
| Notifications | UI Only | Toggles save to DB, but push notifications not sent (needs Firebase) |
| Company Information | ✅ Works | All fields save correctly |
| Account Management | ✅ Works | Block/unblock employees & customers |
| Account & Security | Partial | Password, logout, delete work. Email change sends verification. |

#### Firebase Push Notifications Setup
**Files created:**
- `/public/firebase-messaging-sw.js` - Service worker for background notifications
- `/src/lib/firebase/notifications.ts` - Helper functions for requesting permission
- `/database/create_fcm_tokens_table.sql` - SQL for storing FCM tokens

**Updated:**
- `/src/components/employer/NotificationSettings.tsx` - Added permission request UI

**Action Required:** Run this SQL in Supabase:
```sql
CREATE TABLE IF NOT EXISTS fcm_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  device_type VARCHAR(20) DEFAULT 'web',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, token)
);

ALTER TABLE fcm_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fcm_tokens_select" ON fcm_tokens FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "fcm_tokens_insert" ON fcm_tokens FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "fcm_tokens_update" ON fcm_tokens FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "fcm_tokens_delete" ON fcm_tokens FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_fcm_tokens_user_id ON fcm_tokens(user_id);
```

#### Employee Profile Tab 5 - Enhanced
**Updated:** `/src/app/employee/profile/page.tsx`
- Added Firebase push notifications (same as Employer)
- Added Logout button
- Push notifications toggle with permission status indicator

#### Known TODO
- [ ] Dark mode - removed for now, needs better design (CSS exists but UI was poor)
- [x] Integrate Firebase push notifications (permission request working, sending needs backend)
- [x] Employee Profile tab - DONE (was already implemented, added push notifications)
- [x] Customer Profile (3 tabs) - ALREADY DONE
  - Tab 1: Reviews (ReviewForm + ReviewCard components)
  - Tab 2: My Jobs (JobDetailCard component)
  - Tab 3: Messages (CustomerChat component)

---

### Session Continued - December 5, 2025 (Employee Profile Fixes)

#### Employee Profile Feature Verification & Fixes

**Verification against detailed plan (`breezy-stargazing-dove.md`) identified gaps:**

1. **Job Image Display** - MarketplaceJobCard only showed placeholder
2. **Missing "Pending" and "Refused" sections** in My Jobs
3. **No "Cancel Interest" button** on pending jobs
4. **No "Request Exchange" button** on approved jobs
5. **Missing "Two Weeks" calendar view** in Schedule

#### Fixes Implemented:

**1. Job Image Support**
- Added `image_url` field to `job_templates` table
- Updated TypeScript types in `/src/types/database.ts`
- Updated `MarketplaceJobCard.tsx` to display job images with fallback
- SQL migration: `/database/add_job_template_image.sql`

**2. My Jobs Page - 5 Tab Sections**
- Changed from 4 tabs to 5: Pending, Approved, Active, Done, Refused
- Added `REFUSED` status to `JobSessionStatus` enum
- Updated tab UI with compact mobile design
- SQL migration: `/database/add_refused_status.sql`

**3. MyJobCard - Cancel Interest Button**
- Added "Cancel" button for CLAIMED (pending) jobs
- Confirmation dialog before canceling
- Releases job back to marketplace (status → OFFERED, assigned_to → null)

**4. MyJobCard - Request Exchange Button**
- Added "Request Exchange" button for APPROVED jobs
- Posts job to exchange board (job_exchanges table)
- Other employees can request the job, employer approves

**5. Employee Schedule - Two Weeks View**
- Added `work_week` to calendar views array
- Custom message label: "2 Weeks"
- Views now: Month, Week, 2 Weeks, Day, Agenda

#### Files Modified:
- `/src/types/database.ts` - Added `REFUSED` status, `image_url` field
- `/src/components/employee/MarketplaceJobCard.tsx` - Image display
- `/src/components/employee/MyJobCard.tsx` - Cancel + Exchange buttons
- `/src/app/employee/jobs/page.tsx` - 5 tab sections
- `/src/app/employee/schedule/page.tsx` - 2 Weeks view

#### SQL Files Created:
- `/database/add_job_template_image.sql`
- `/database/add_refused_status.sql`

---

### Session Continued - December 5, 2025 (Job Scheduling Options)

#### Enhanced Job Creation Form - Scheduling Options ✅

Added 5 new scheduling options when creating a job template:

**1. Frequency (times per week)**
- Changed from text input to dropdown selector
- Options: 1x, 2x, 3x, 4x, 5x, 6x, 7x per week
- Cleaner UI with better validation

**2. Specific Dates Picker**
- New scheduling mode toggle: "By Days of Week" vs "By Specific Dates"
- Date picker to add individual dates
- Badge chips display selected dates with remove button
- Dates stored as `DATE[]` array in database

**3. Date Range (Start/End)**
- Start Date: When job scheduling begins
- End Date: When job scheduling ends (optional, null = indefinite)
- Both fields use native date inputs

**4. Exclude Dates (Holidays)**
- Date picker for holiday/skip dates
- Red badge chips for visual distinction
- Useful for vacations, holidays, special closures
- Stored as `DATE[]` array in database

**5. Preferred Employee**
- Dropdown selector with all active employees
- Auto-assign preference when creating job sessions
- Optional "No preference" option

#### Files Modified:
- `/src/types/database.ts` - Added scheduling fields to JobTemplate interface
- `/src/app/employer/jobs/new/page.tsx` - New scheduling UI with all 5 options

#### SQL Migration Created:
- `/database/add_scheduling_fields.sql` - Adds new columns to job_templates table

**Run in Supabase SQL Editor:**
```sql
ALTER TABLE job_templates ADD COLUMN IF NOT EXISTS specific_dates DATE[] DEFAULT NULL;
ALTER TABLE job_templates ADD COLUMN IF NOT EXISTS start_date DATE DEFAULT NULL;
ALTER TABLE job_templates ADD COLUMN IF NOT EXISTS end_date DATE DEFAULT NULL;
ALTER TABLE job_templates ADD COLUMN IF NOT EXISTS exclude_dates DATE[] DEFAULT NULL;
ALTER TABLE job_templates ADD COLUMN IF NOT EXISTS preferred_employee_id UUID DEFAULT NULL REFERENCES employees(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_job_templates_preferred_employee ON job_templates(preferred_employee_id);
```

#### Jobs History Page ✅

Added `/employer/jobs/history` page with:
- Compact list view of all completed/evaluated jobs
- Search by job code, title, customer, employee
- Filters: Customer, Employee, Rating, Date range, Review status
- Expandable rows showing description, address, completion time, and review
- Star rating display (single star + number for compact view)
- Access via "History" button on Jobs page header

**File created:** `/src/app/employer/jobs/history/page.tsx`

#### Job Image Upload & Enhanced Marketplace Card ✅

**Job Creation Form:**
- Added image upload field with preview
- Image shown to employees in marketplace
- Storage bucket: `job-images`

**MarketplaceJobCard Enhanced:**
- Shows job image (or placeholder with customer code)
- Job title and description
- Scheduled date badge
- Duration, Pay rate, Start time in 3-column grid
- Available days/schedule
- Customer name and address

**SQL Required:** Run `/database/create_job_images_bucket.sql` in Supabase

**Files modified:**
- `/src/app/employer/jobs/new/page.tsx` - Image upload
- `/src/components/employee/MarketplaceJobCard.tsx` - Enhanced layout

---
