# Session State - Cleaning App

**Last Updated:** December 4, 2025
**Status:** Customer Features (Final Phase)

---

## QUICK RESUME INSTRUCTIONS

Copy-paste this to resume:
```
Read these files to continue:
1. /Users/jean-micheldrouin/cleaning-app/docs/SESSION-STATE.md (THIS FILE)
2. /Users/jean-micheldrouin/cleaning-app/docs/AGENT-CHECKLIST.md
3. /Users/jean-micheldrouin/cleaning-app/docs/agent-logs/ (for agent history)
```

---

## COMPLETED PHASES

### Phase 1: Infrastructure ✅
- [x] GitHub repo: https://github.com/AdministrationRoutinePlus-afk/cleaning-app
- [x] Next.js 16 project with PWA config
- [x] Supabase + Firebase configured

### Phase 2: Database ✅
- [x] 24 tables, 11 enums, 2 storage buckets
- [x] RLS policies configured

### Phase 3: Frontend Foundation ✅
- [x] BottomNav, Login/Register, Routes
- [x] Shared types `/src/types/database.ts`

### Phase 4: Employer Features ✅
- [x] All 5 tabs complete (Jobs, Users, Schedule, Messages, Settings)

### Phase 5: Employee Features ✅
- [x] All 5 tabs complete (Marketplace, My Jobs, Schedule, Messages, Profile)
- [x] Step-by-step execution page

---

## CURRENT: Customer Features (3 tabs)

- [ ] Reviews - Submit evaluations (1-5 stars + notes)
- [ ] My Jobs - View job descriptions (read-only)
- [ ] Messages - Chat with employer

---

## KEY FILES

| Purpose | Path |
|---------|------|
| Types | `/src/src/types/database.ts` |
| Agent Rules | `/docs/AGENT-CHECKLIST.md` |
| Agent Logs | `/docs/agent-logs/` |

---

## AGENT RULES

1. Read `/docs/AGENT-CHECKLIST.md` first
2. Use `user_id` (NOT auth_user_id)
3. Types from `@/types/database` only
4. Verify with `npm run build`

---

## CREDENTIALS

- `.env.local` in `/src/`
- Supabase: https://supabase.com/dashboard/project/ktweomrmoezepoihtyqn
