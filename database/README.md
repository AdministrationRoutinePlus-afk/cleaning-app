# Database Setup - Cleaning App

## Quick Start

1. Go to [Supabase Dashboard](https://supabase.com/dashboard/project/ktweomrmoezepoihtyqn)
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `000_FULL_SCHEMA.sql`
4. Click **Run**

## Schema Overview

### Tables (24 total)

| Category | Tables | Count |
|----------|--------|-------|
| Users | employers, employees, customers, company_info | 4 |
| Jobs | job_templates, job_steps, job_step_images, job_step_checklist, job_sessions, job_session_progress, job_session_checklist_progress | 7 |
| Messages | conversations, conversation_participants, messages, schedule_messages | 4 |
| Interactions | evaluations, strikes, job_exchanges, notifications | 4 |
| Settings | employer_settings, notification_settings, reminder_settings | 3 |
| Availability | employee_availability, employee_availability_dates | 2 |

### Enums (11 total)

| Enum | Values |
|------|--------|
| job_template_status | DRAFT, ACTIVE |
| job_session_status | OFFERED, CLAIMED, APPROVED, IN_PROGRESS, COMPLETED, EVALUATED, CANCELLED |
| employee_status | PENDING, ACTIVE, INACTIVE, BLOCKED |
| customer_status | ACTIVE, INACTIVE, BLOCKED |
| exchange_status | PENDING, APPROVED, DENIED |
| strike_severity | MINOR, MAJOR, CRITICAL |
| strike_target_type | CUSTOMER, EMPLOYEE |
| conversation_type | DIRECT, ANNOUNCEMENT, EMPLOYEE_GROUP |
| user_type | EMPLOYER, EMPLOYEE, CUSTOMER |
| day_of_week | MON, TUE, WED, THU, FRI, SAT, SUN |
| theme_type | LIGHT, DARK |

### Storage Buckets (2)

| Bucket | Purpose | Access |
|--------|---------|--------|
| job-images | Step-by-step instruction images | Public read, authenticated write |
| employee-documents | Void cheques and private docs | Private (owner only) |

## File Structure

```
database/
├── 000_FULL_SCHEMA.sql          # Complete schema (run this one!)
├── 001_create_enums.sql         # Enum definitions
├── 002_create_user_tables.sql   # User tables
├── 003_create_job_tables.sql    # Job tables
├── 004_create_message_tables.sql # Message tables
├── 005_create_interaction_tables.sql # Interaction tables
├── 006_create_settings_tables.sql # Settings tables
├── 007_create_availability_tables.sql # Availability tables
├── 008_create_storage_buckets.sql # Storage buckets
├── 009_create_rls_policies.sql  # Row Level Security
└── README.md                    # This file
```

## Row Level Security

All tables have RLS enabled with policies that ensure:
- Users can only access their own data
- Employers can access all data they created
- Employees can only see active jobs and their own assignments
- Customers can only see their linked jobs and submit reviews

## Usage Notes

### For Employers
- Full CRUD on all their data
- Can view all employees and customers
- Can manage job templates, sessions, and evaluations

### For Employees
- Can view active jobs in marketplace
- Can claim/unclaim jobs
- Can update their own profile and availability
- Can create job exchanges

### For Customers
- Can view their linked jobs (read-only)
- Can submit and update evaluations
- Can chat with employer
