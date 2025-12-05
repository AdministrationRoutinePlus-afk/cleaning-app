# Session State - Cleaning App

**Last Updated:** December 4, 2025
**Status:** Building Frontend Features

---

## QUICK RESUME INSTRUCTIONS

Copy-paste this to resume:
```
Read these files to continue:
1. /Users/jean-micheldrouin/cleaning-app/docs/SESSION-STATE.md (THIS FILE)
2. /Users/jean-micheldrouin/cleaning-app/docs/AGENT-CHECKLIST.md
3. /Users/jean-micheldrouin/cleaning-app/src/src/types/database.ts
```

---

## COMPLETED PHASES

### Phase 1: Infrastructure ✅
- [x] GitHub repo: https://github.com/AdministrationRoutinePlus-afk/cleaning-app
- [x] Next.js 16 project with PWA config
- [x] Supabase client (server + browser)
- [x] Firebase config (push notifications)
- [x] .env.local with all credentials

### Phase 2: Database ✅
- [x] 24 tables created in Supabase
- [x] 11 enum types
- [x] 2 storage buckets (job-images, employee-documents)
- [x] RLS policies configured
- [x] SQL files in `/database/` folder

### Phase 3: Frontend Foundation ✅
- [x] BottomNav component (3 profiles)
- [x] Login/Register pages with Supabase Auth
- [x] Route structure (13 pages placeholder)
- [x] Shared types file `/src/types/database.ts`
- [x] Agent coordination checklist

### Phase 4: Employer Features ✅
- [x] Jobs tab (list, create, JobCard, JobSessionCard)
- [x] Users tab (employees, customers, cards, add customer)
- [x] Schedule tab (calendar, popup, reschedule)
- [x] Messages tab (direct, announcements, exchanges)
- [x] Settings tab (appearance, notifications, company, account)

---

## CURRENT PHASE: Employee Features

### TODO - Employee Profile (5 tabs):
- [ ] Marketplace - Swipe interface (Tinder-like)
- [ ] My Jobs - Interested/Pending/Approved/Refused sections
- [ ] Schedule - Personal calendar + export
- [ ] Messages - Chat + Exchange section
- [ ] Profile - Personal info, availability, void cheque

### TODO - Customer Features (3 tabs):
- [ ] Reviews - Submit evaluations
- [ ] My Jobs - View job descriptions
- [ ] Messages - Chat with employer

---

## KEY FILES REFERENCE

| Purpose | Path |
|---------|------|
| Types (SINGLE SOURCE) | `/src/src/types/database.ts` |
| Agent Rules | `/docs/AGENT-CHECKLIST.md` |
| Project Structure | `/docs/SUBAGENT-INSTRUCTIONS.md` |
| Database Schema | `/database/000_FULL_SCHEMA.sql` |
| Supabase Client | `/src/src/lib/supabase/client.ts` |
| Main Layout | `/src/src/app/layout.tsx` |

---

## AGENT COORDINATION RULES

1. **All agents MUST read:**
   - `/docs/AGENT-CHECKLIST.md`
   - `/src/src/types/database.ts`

2. **Database column:** Use `user_id` (NOT auth_user_id)

3. **Types:** Import from `@/types/database` only

4. **After agents complete:** Run `npm run build` to verify

---

## CREDENTIALS (Reference Only)

All credentials are in:
- `/src/.env.local`
- Plan file: `/Users/jean-micheldrouin/.claude/plans/breezy-stargazing-dove.md`

Supabase Dashboard: https://supabase.com/dashboard/project/ktweomrmoezepoihtyqn

---

## GIT STATUS

Latest commits pushed to: `origin/main`
All work is committed and pushed.

---

## NEXT ACTIONS

1. Verify Messages + Settings build passes
2. Commit Employer features (Messages, Settings)
3. Launch agents for Employee features (Marketplace, My Jobs, Schedule, Messages, Profile)
4. Integration verification
5. Launch agents for Customer features
6. Final testing
