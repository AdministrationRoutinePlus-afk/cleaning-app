# Cleaning App - Golden Rules

## Project Info
- **Project Name:** Cleaning Job Ticket App (name TBD)
- **Stack:** Next.js + Supabase + Vercel
- **Created:** December 4, 2025

---

## What is This Project?
A job ticket marketplace for cleaning services with 3 user roles:
- **Employer:** Creates jobs, manages staff & customers, controls schedules
- **Employee:** Picks jobs from marketplace, views calendar, gets scheduled
- **Customer:** Evaluates completed jobs

---

## Golden Rules

### 1. Always Backup Before Changes
- Create a backup before starting a session
- Create a backup after major features are completed
- **Command:** `./backup.sh` or manual zip to `/backups/`

### 2. Use Version Control / Changelog
- Document every change with date and description
- Note what files were modified
- Include the "why" not just the "what"
- **File:** `CHANGELOG.md`

### 3. Make Small, Incremental Changes
- One feature or fix at a time
- Commit after each change
- Test before moving to the next task
- Easier to rollback if something breaks

### 4. Test After Each Change
- Run the app locally after changes
- Check different user roles if applicable
- Verify the change works as expected

### 5. Read Before Editing
- AI must read a file before modifying it
- Understand the existing code structure
- Don't assume - verify

### 6. Don't Trust Blindly
- Review what the AI proposes
- Ask questions if something seems wrong
- You are the final decision maker

### 7. Comment Your Code
- Add clear comments explaining logic
- Document function purposes
- Note any workarounds or TODOs

### 8. Save Session Notes
- Update CHANGELOG.md during the session
- Document new features added
- Note any issues encountered

---

## Quick Reference

### Start New Session
Tell Claude:
> Read the notes at `/Users/jean-micheldrouin/cleaning-app/RULES.md`, `CHANGELOG.md`, and `PROJECT.md` to get context.

### File Locations
| Item | Location |
|------|----------|
| Project Root | `/Users/jean-micheldrouin/cleaning-app/` |
| Source Code | `/Users/jean-micheldrouin/cleaning-app/src/` |
| Documentation | `/Users/jean-micheldrouin/cleaning-app/docs/` |
| Backups | `/Users/jean-micheldrouin/cleaning-app/backups/` |
| Changelog | `/Users/jean-micheldrouin/cleaning-app/CHANGELOG.md` |
| Project Specs | `/Users/jean-micheldrouin/cleaning-app/PROJECT.md` |

---

## Session Checklist

### Start of Session
- [ ] Create backup (if code exists)
- [ ] Review CHANGELOG.md for context
- [ ] Review PROJECT.md for specs

### During Session
- [ ] Make small changes
- [ ] Test after each change
- [ ] Backup after major features
- [ ] Update CHANGELOG.md

### End of Session
- [ ] Create final backup
- [ ] Update CHANGELOG.md with all changes
- [ ] Note any pending tasks

---

*Last updated: December 4, 2025*
