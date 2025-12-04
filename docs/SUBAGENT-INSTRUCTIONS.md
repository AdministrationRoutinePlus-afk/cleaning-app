# Subagent Instructions - Cleaning App

## Quick Start for ANY Subagent

Before working, read these files:
1. `/Users/jean-micheldrouin/cleaning-app/RULES.md` - Golden rules
2. `/Users/jean-micheldrouin/cleaning-app/docs/SUBAGENT-INSTRUCTIONS.md` - This file
3. `/Users/jean-micheldrouin/.claude/plans/breezy-stargazing-dove.md` - Full feature plan

---

## Project Structure

```
/Users/jean-micheldrouin/cleaning-app/
├── docs/                    # Documentation
│   ├── agents/              # Agent spec files
│   ├── SUBAGENT-INSTRUCTIONS.md  # THIS FILE
│   ├── HOW-TO-WORK.md
│   └── RESEARCH-RESOURCES.md
├── src/                     # Next.js 16 App
│   ├── src/
│   │   ├── app/             # Pages (App Router)
│   │   ├── components/      # React components (create as needed)
│   │   ├── lib/             # Utilities
│   │   │   ├── supabase/    # Supabase client
│   │   │   └── firebase/    # Firebase config
│   │   ├── types/           # TypeScript types (create as needed)
│   │   └── hooks/           # Custom hooks (create as needed)
│   ├── public/              # Static assets
│   └── .env.local           # Environment variables (DO NOT COMMIT)
├── CHANGELOG.md
├── RULES.md
└── PROJECT.md
```

---

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 16 | React framework with App Router |
| TypeScript | 5.x | Type safety |
| Tailwind CSS | 4.x | Styling |
| Supabase | Latest | Database, Auth, Storage, Realtime |
| Firebase | Latest | Push notifications only |
| shadcn/ui | Latest | UI components (install as needed) |

---

## Credentials & Services

### Supabase
- **URL:** https://ktweomrmoezepoihtyqn.supabase.co
- **Dashboard:** https://supabase.com/dashboard/project/ktweomrmoezepoihtyqn
- **Anon Key:** In `.env.local`
- **Service Role Key:** In `.env.local` (server-side only!)

### Firebase
- **Project:** routine-plus-cleaning-app
- **Console:** https://console.firebase.google.com/project/routine-plus-cleaning-app
- **Config:** In `.env.local`

### GitHub
- **Repo:** https://github.com/AdministrationRoutinePlus-afk/cleaning-app

### Vercel
- **Will deploy from:** GitHub repo (connect when ready)

---

## Database Schema Summary

### 24 Tables (see plan file for full schemas)

**Users (4):**
- `employers` - Employer profiles
- `employees` - Employee profiles
- `customers` - Customer profiles
- `company_info` - Company details

**Jobs (7):**
- `job_templates` - Reusable job definitions
- `job_steps` - Step-by-step instructions
- `job_step_images` - Images for steps
- `job_step_checklist` - Checklist items in steps
- `job_sessions` - Individual job instances
- `job_session_progress` - Employee progress on steps
- `job_session_checklist_progress` - Checklist completion

**Messages (4):**
- `conversations` - Chat conversations
- `conversation_participants` - Who's in each chat
- `messages` - Individual messages
- `schedule_messages` - Job pushes from employer

**Interactions (4):**
- `evaluations` - Customer reviews
- `strikes` - Issues logged
- `job_exchanges` - Job swap requests
- `notifications` - All notifications

**Settings (3):**
- `employer_settings` - App settings
- `notification_settings` - Per-user notification toggles
- `reminder_settings` - Reminder configuration

**Availability (2):**
- `employee_availability` - Weekly availability
- `employee_availability_dates` - Specific date overrides

### Storage Buckets (2)
- `job-images` - Step instruction images (public read)
- `employee-documents` - Void cheques (private)

---

## Enum Types

```sql
-- Job Template Status
CREATE TYPE job_template_status AS ENUM ('DRAFT', 'ACTIVE');

-- Job Session Status
CREATE TYPE job_session_status AS ENUM (
  'OFFERED', 'CLAIMED', 'APPROVED', 'IN_PROGRESS',
  'COMPLETED', 'EVALUATED', 'CANCELLED'
);

-- Employee Status
CREATE TYPE employee_status AS ENUM ('PENDING', 'ACTIVE', 'INACTIVE', 'BLOCKED');

-- Customer Status
CREATE TYPE customer_status AS ENUM ('ACTIVE', 'INACTIVE', 'BLOCKED');

-- Exchange Status
CREATE TYPE exchange_status AS ENUM ('PENDING', 'APPROVED', 'DENIED');

-- Strike Severity
CREATE TYPE strike_severity AS ENUM ('MINOR', 'MAJOR', 'CRITICAL');

-- Conversation Type
CREATE TYPE conversation_type AS ENUM ('DIRECT', 'ANNOUNCEMENT', 'EMPLOYEE_GROUP');

-- User Type (for notifications)
CREATE TYPE user_type AS ENUM ('EMPLOYER', 'EMPLOYEE', 'CUSTOMER');

-- Day of Week
CREATE TYPE day_of_week AS ENUM ('MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN');

-- Strike Target Type
CREATE TYPE strike_target_type AS ENUM ('CUSTOMER', 'EMPLOYEE');
```

---

## Authentication Rules

| Profile | Registration | Activation |
|---------|--------------|------------|
| Employer | Self-register | Immediate |
| Employee | Self-register | Employer must activate |
| Customer | Employer creates | Immediate |

---

## 3 User Profiles & Their Tabs

### EMPLOYER (5 tabs)
1. **Jobs** - Create/manage job templates and sessions
2. **Employees/Customers** - Manage users, strikes, registrations
3. **Schedule** - Calendar view, reschedule, push jobs
4. **Messages** - Direct chat, announcements, exchange approvals
5. **Settings** - App config, notifications, company info, block users

### EMPLOYEE (5 tabs)
1. **Marketplace** - Swipe interface (RIGHT=interested, LEFT=skip)
2. **My Jobs** - Interested/Pending/Approved/Refused sections
3. **Schedule** - Personal calendar, export, reminders
4. **Messages** - Chat, announcements, exchanges
5. **Profile/Settings** - Personal info, void cheque, availability

### CUSTOMER (3 tabs)
1. **Reviews** - Submit evaluations (1-5 stars + notes)
2. **My Jobs** - View job descriptions (read-only)
3. **Messages** - Chat with employer

---

## Key Flows

### Job Flow
```
Employer creates job template
    ↓
Employer activates → appears in marketplace
    ↓
Employee swipes RIGHT (interested)
    ↓
Employer approves → job scheduled
    ↓
Employee starts job → step-by-step mode
    ↓
Employee completes → customer notified
    ↓
Customer submits review → EVALUATED
```

### Exchange Flow
```
Employee A has APPROVED job they can't do
    ↓
Posts to Exchange section
    ↓
Employee B clicks "Ask for it"
    ↓
Employee A picks Employee B
    ↓
Employer receives notification
    ↓
Employer APPROVES or DENIES
    ↓
If approved → job reassigned
```

---

## Coding Standards

### File Naming
- Components: `PascalCase.tsx` (e.g., `JobCard.tsx`)
- Pages: `page.tsx` in route folders
- Utilities: `camelCase.ts` (e.g., `formatDate.ts`)
- Types: `types.ts` or `*.types.ts`

### Component Structure
```tsx
// 1. Imports
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// 2. Types
interface Props {
  jobId: string
}

// 3. Component
export function JobCard({ jobId }: Props) {
  // hooks first
  const [loading, setLoading] = useState(false)

  // handlers
  const handleClick = () => {}

  // render
  return <div>...</div>
}
```

### Database Queries
```tsx
// Client-side (in components)
import { createClient } from '@/lib/supabase/client'
const supabase = createClient()
const { data, error } = await supabase.from('jobs').select('*')

// Server-side (in Server Components or API routes)
import { createClient } from '@/lib/supabase/server'
const supabase = await createClient()
const { data, error } = await supabase.from('jobs').select('*')
```

---

## Installing UI Components

When you need a component from shadcn/ui:
```bash
cd /Users/jean-micheldrouin/cleaning-app/src
npx shadcn@latest add button
npx shadcn@latest add card
npx shadcn@latest add dialog
# etc.
```

---

## Running the App

```bash
cd /Users/jean-micheldrouin/cleaning-app/src
npm run dev      # Development server
npm run build    # Production build
npm run start    # Start production server
```

---

## Committing Changes

Always commit with this format:
```bash
git add .
git commit -m "$(cat <<'EOF'
Short description of changes

- Detail 1
- Detail 2

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
git push
```

---

## Agent-Specific Instructions

### DATABASE AGENT
- Work in Supabase Dashboard SQL Editor
- Create tables in dependency order (users first, then jobs, etc.)
- Always add RLS policies
- Test queries after creating tables

### BACKEND AGENT
- Create API routes in `/src/src/app/api/`
- Use Server Actions when possible
- Validate all inputs
- Handle errors gracefully

### FRONTEND AGENT
- Mobile-first design
- Use Tailwind CSS classes
- Install shadcn/ui components as needed
- Follow the component structure above

### TESTING AGENT
- Create tests in `__tests__/` folders
- Test critical flows (auth, job creation, etc.)
- Report bugs to Debug Agent

### SECURITY AGENT
- Review all RLS policies
- Check for SQL injection
- Validate auth on all routes
- Protect sensitive data (void cheques)

---

## Questions?

If unclear about requirements, check:
1. Plan file: `/Users/jean-micheldrouin/.claude/plans/breezy-stargazing-dove.md`
2. This file for technical details
3. Ask the orchestrator for clarification

---

*Last updated: December 4, 2025*
