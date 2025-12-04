# Cleaning App - Project Specifications

## Overview
A job ticket marketplace for cleaning services connecting Employers, Employees, and Customers.

---

## User Roles

### 1. Employer (Admin)
**Who:** Business owner / Manager
**Can do:**
- Create and manage job tickets
- View/edit all employee profiles
- View/edit all customer profiles
- Approve/reject employee job requests
- Full control over scheduling
- Assign jobs directly to employees
- View all ratings and evaluations
- Dashboard with overview of all activity

### 2. Employee (Worker)
**Who:** Cleaning staff
**Can do:**
- Browse job ticket marketplace
- Pick/request jobs
- View personal calendar (approved jobs)
- View their own ratings/evaluations
- Update availability (TBD)
- View job details and customer info

### 3. Customer (Client)
**Who:** People receiving cleaning services
**Can do:**
- Evaluate completed job tickets
- Rate employee performance
- Leave written reviews
- View history of their jobs (TBD)

---

## Core Features

### Job Tickets
- **Fields (TBD):**
  - Title
  - Description
  - Location/Address
  - Date & Time
  - Duration (estimated)
  - Pay/Rate (?)
  - Required skills (?)
  - Urgency level (?)
  - Status (open, claimed, approved, in-progress, completed, evaluated)

### Marketplace
- List of available job tickets
- Filters (date, location, type?)
- Employee can "claim" or "request" a ticket

### Calendar
- Employee: Personal schedule of approved jobs
- Employer: Overview of all scheduled jobs / all employees

### Evaluation System
- Customer rates completed jobs
- Star rating (1-5?)
- Written review option
- Visible to: Employee (own), Employer (all)

---

## Technical Stack

### App Type: PWA (Progressive Web App)
- Installable on iOS/Android home screen
- Works offline (with caching)
- Mobile-first responsive design
- Push notifications (where supported)
- No app store required

### Frontend
- **Next.js 14** (App Router, React framework)
- **Tailwind CSS** (utility-first styling)
- **TypeScript** (strict type safety)
- **PWA features:**
  - Service Worker (offline caching)
  - Web App Manifest
  - Install prompt

### Backend
- **Supabase**
  - PostgreSQL database
  - Authentication (email, magic links, maybe Google)
  - Row Level Security (RLS) for role-based access
  - Real-time subscriptions (for live updates)
  - Storage (for images if needed)

### Hosting
- **Vercel** (Next.js deployment, automatic HTTPS)
- **Supabase** (database hosting)

### Testing
- **Vitest** (unit/integration tests)
- **Playwright** (E2E tests)
- **Testing Library** (component tests)

---

## Database Schema (Draft)

### Tables (to be refined)

```
users
  - id (uuid, primary key)
  - email
  - role (employer | employee | customer)
  - full_name
  - phone
  - created_at

job_tickets
  - id (uuid, primary key)
  - title
  - description
  - location
  - scheduled_date
  - scheduled_time
  - duration_hours
  - status (open | claimed | approved | in_progress | completed | evaluated)
  - created_by (employer id)
  - assigned_to (employee id, nullable)
  - customer_id (nullable)
  - created_at
  - updated_at

evaluations
  - id (uuid, primary key)
  - job_ticket_id
  - customer_id
  - employee_id
  - rating (1-5)
  - comment
  - created_at
```

---

## Questions to Resolve

1. **Job claiming:** First-come-first-serve or request/approval?
2. **Pay/rates:** Are job tickets paid? Show amount?
3. **Customer creation:** Who creates customer profiles?
4. **Notifications:** Email? Push? In-app?
5. ~~**Mobile:** Web-only or need mobile app?~~ → **RESOLVED: PWA**
6. **Multiple employees per job?**
7. **Recurring jobs?**
8. **App name?**

---

## Pages/Screens (Draft)

### Public
- Login page
- Register page (if self-registration)

### Employer Dashboard
- Overview (stats, recent activity)
- Job Tickets (list, create, edit)
- Employees (list, profiles)
- Customers (list, profiles)
- Schedule (calendar view)
- Evaluations (all reviews)

### Employee Dashboard
- Marketplace (available jobs)
- My Jobs (claimed/approved)
- My Calendar
- My Profile
- My Ratings

### Customer Portal
- Pending evaluations
- Past evaluations
- (Simple, minimal interface)

---

## Status
**Phase:** Planning
**Next:** Finalize features through discussion

---

*Last updated: December 4, 2025*
