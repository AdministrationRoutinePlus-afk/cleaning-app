# Cleaning App - Work Log

This file tracks all agent interactions and work done.

---

## How to Use This Log

After each agent task, add an entry:

```markdown
### [DATE] [TIME] - [AGENT NAME]
**Task:** [What was asked]
**Result:** [What was returned]
**Files Changed:** [List of files]
**Next Steps:** [What to do next]
```

---

## Log Entries

### December 4, 2025 - Session 1

#### 08:42 - ORCHESTRATOR
**Task:** Initialize project structure
**Result:** Created folders and documentation
**Files Changed:**
- Created /cleaning-app/ folder structure
- Created RULES.md
- Created CHANGELOG.md
- Created PROJECT.md

#### 09:00 - ORCHESTRATOR
**Task:** Create subagent system
**Result:** 12 agent specs created
**Files Changed:**
- Created docs/agents/AGENTS-OVERVIEW.md
- Created 11 agent spec files

#### 09:15 - ORCHESTRATOR
**Task:** Confirm PWA and document workflow
**Result:** All agents aligned with PWA stack
**Files Changed:**
- Updated AGENTS-OVERVIEW.md with tech stack
- Updated PROJECT.md with PWA details
- Created docs/HOW-TO-WORK.md

---

### December 5, 2025 - Job Scheduling Redesign

#### Window-Based Scheduling Model
**Task:** Redesign job scheduling from frequency-based to window-based model

**Problem:** Old model used `available_days` + `frequency_per_week` which was confusing and created wrong sessions (e.g., Thursday appearing when only Fri/Sat/Sun selected).

**Solution:** New window-based model:
- Job has a **time window** spanning from (start_day, start_time) to (end_day, end_time)
- Example: Friday 5pm → Sunday 8pm = ONE job per week
- Employee completes job anytime within window

**Database Changes:**
```sql
ALTER TABLE job_templates
ADD COLUMN window_start_day TEXT,
ADD COLUMN window_end_day TEXT;

ALTER TABLE job_sessions
ADD COLUMN scheduled_end_date DATE;
```

**Files Changed:**
- `/src/types/database.ts` - Added `window_start_day`, `window_end_day` to JobTemplate; `scheduled_end_date` to JobSession
- `/src/app/employer/jobs/new/page.tsx` - New UI with day+time dropdowns, rewrote `createJobSessions()`
- `/src/app/employer/jobs/[id]/edit/page.tsx` - Same changes as new page
- `/database/update_scheduling_model.sql` - Migration script

**How Sessions Are Created:**
- Recurring: One session per week, starts on `window_start_day`, spans to calculated end date
- One-time: Sessions for each specific date selected
- `scheduled_end_date` stores when window closes (for multi-day jobs)

---

#### User Account Management (Username/Password Auth)
**Task:** Add ability to create/view/edit login credentials for employees and customers

**Solution:** Username-based auth using fake email format (`username@cleaning.local`) with server-side API routes using service role key.

**New API Routes:**
- `/api/auth/create-user/route.ts` - Creates auth user with username/password
- `/api/auth/get-user-credentials/route.ts` - Gets username by user_id
- `/api/auth/update-password/route.ts` - Updates password for user

**Files Changed:**
- `/src/app/employer/users/page.tsx` - Added account creation fields to employee/customer forms
- `/src/app/employer/users/employee/[id]/page.tsx` - Added "Login Credentials" card
- `/src/app/employer/users/customer/[id]/page.tsx` - Added "Login Credentials" card

**Features:**
- Create account when adding new employee/customer (optional checkbox)
- View username in profile (password shown as `••••••••`)
- Change password from profile page
- Create account for existing users without one

---

#### Schedule Page Redesign
**Task:** Redesign employer schedule page with 3 tabs and dual views

**Solution:** 3-tab layout with Calendar and List views:
- **Tab 1: Open Jobs** - OFFERED status (Gray >4 days, Orange ≤4 days, Red ≤2 days urgent)
- **Tab 2: Assigned** - CLAIMED (yellow) + APPROVED (blue)
- **Tab 3: In Progress** - IN_PROGRESS (purple), COMPLETED (green), EVALUATED (teal)

**Files Changed:**
- `/src/app/employer/schedule/page.tsx` - Complete rewrite with tabs, calendar, and list views

**Features:**
- Toggle between Calendar/List view per tab
- List view shows: job code, title, customer, address, date/time, duration, employee info, price
- Click any job to open popup with actions
- Tab-specific color legends

---

#### Login Page Username Support
**Task:** Update login to accept username instead of email

**Files Changed:**
- `/src/app/login/page.tsx` - Changed email field to username, auto-converts to `username@cleaning.local`

---

#### Bug Fixes
- **MarketplaceJobCard null check** - Added guard for null `job_template` to prevent crash
- **Marketplace filtering** - Filter out orphaned job_sessions (where job_template is null)

**Files Changed:**
- `/src/components/employee/MarketplaceJobCard.tsx` - Added null check
- `/src/app/employee/marketplace/page.tsx` - Filter out sessions with null job_template

---

#### Database Issue
**Note:** Database was found completely empty (all tables wiped externally). Recreated admin employer account:
- Username: `admin`
- Password: `123456`

---

## Template for New Entries

Copy and paste this for each agent interaction:

```markdown
### [DATE] [TIME] - [AGENT]
**Task:**
**Result:**
**Files Changed:**
-
**Next Steps:**
-
```

---
