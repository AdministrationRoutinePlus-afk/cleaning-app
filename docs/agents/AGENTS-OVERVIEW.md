# Cleaning App - Subagents Overview

## Purpose
Specialized agents to handle specific tasks, ensuring quality, speed, and consistency throughout development.

---

## Tech Stack (ALL Agents Must Follow)

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Framework** | Next.js 14 (App Router) | React framework, SSR, routing |
| **Language** | TypeScript | Type safety |
| **Styling** | Tailwind CSS | Utility-first CSS |
| **Database** | Supabase (PostgreSQL) | Data storage, real-time |
| **Auth** | Supabase Auth | User authentication |
| **Hosting** | Vercel | Deployment, serverless |
| **App Type** | PWA | Installable, offline-capable |

### PWA Requirements
- Service Worker for offline caching
- Web App Manifest (manifest.json)
- Mobile-first responsive design
- Installable on iOS/Android home screen
- Push notifications (where supported)

---

## Agent Team (12 Agents)

### Orchestrator (Main Claude)
Coordinates all agents, makes final decisions, updates documentation.

---

### Research Layer
| Agent | Role |
|-------|------|
| **Code Research** | Finds existing solutions, libraries, working code snippets online |

---

### Domain Specialists (Advisors - Define WHAT to build)
| Agent | Role |
|-------|------|
| **Employer Specialist** | Defines requirements for Employer features, validates business logic |
| **Employee Specialist** | Defines requirements for Employee features, validates user flows |
| **Customer Specialist** | Defines requirements for Customer features, validates evaluation system |

---

### Development Layer (Build HOW)
| Agent | Role |
|-------|------|
| **Frontend** | UI components, pages, styling, React/Next.js, Tailwind |
| **Backend** | API routes, server logic, Supabase integration |
| **Database** | Schema design, queries, migrations, RLS policies |

---

### Quality Control Layer
| Agent | Role |
|-------|------|
| **Debug** | Finds and fixes bugs, analyzes error logs |
| **Testing** | Writes and runs tests, validates functionality |
| **UI/UX Validator** | Visual consistency, aesthetics, accessibility |
| **Security** | Auth, permissions, data protection, vulnerability checks |

---

## Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                     ORCHESTRATOR                            │
│              (Coordinates everything)                       │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    CODE RESEARCH                            │
│         Finds existing solutions before building            │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  DOMAIN SPECIALISTS                         │
│    Employer │ Employee │ Customer                           │
│    Define WHAT to build, requirements, user needs           │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    DEVELOPMENT                              │
│         Frontend │ Backend │ Database                       │
│              Build HOW (actual code)                        │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   QUALITY CONTROL                           │
│      Testing │ Debug │ UI/UX Validator │ Security           │
│              Validate everything works                      │
└─────────────────────────────────────────────────────────────┘
```

---

## Golden Rules for ALL Agents

Every agent MUST:
1. **Read before editing** - Understand existing code/context first
2. **Document actions** - Report what was done back to Orchestrator
3. **Small changes** - One fix/feature at a time
4. **Follow existing patterns** - Match the codebase style
5. **Comment code** - Explain the "why" not just the "what"
6. **Report back clearly** - Summarize findings/actions for Orchestrator

---

## Agent Documentation Files
- `agent-code-research.md`
- `agent-employer-specialist.md`
- `agent-employee-specialist.md`
- `agent-customer-specialist.md`
- `agent-frontend.md`
- `agent-backend.md`
- `agent-database.md`
- `agent-debug.md`
- `agent-testing.md`
- `agent-ui-validator.md`
- `agent-security.md`

---

*Last updated: December 4, 2025*
