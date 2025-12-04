# How to Work on This Project

## Quick Start Command

When starting a new session, open terminal and run:

```bash
cd /Users/jean-micheldrouin/cleaning-app && claude
```

Then tell Claude:
```
Read the project context: RULES.md, CHANGELOG.md, PROJECT.md, and docs/agents/AGENTS-OVERVIEW.md
```

Or copy-paste this full prompt:
```
I'm working on the Cleaning App project. Read these files for context:
- /Users/jean-micheldrouin/cleaning-app/RULES.md
- /Users/jean-micheldrouin/cleaning-app/CHANGELOG.md
- /Users/jean-micheldrouin/cleaning-app/PROJECT.md
- /Users/jean-micheldrouin/cleaning-app/docs/agents/AGENTS-OVERVIEW.md
```

---

## Subagent Names & Purposes

| Agent Name | Purpose | When to Use |
|------------|---------|-------------|
| `code-research` | Find existing solutions online | Before building any feature |
| `employer-specialist` | Define Employer requirements | Planning Employer features |
| `employee-specialist` | Define Employee requirements | Planning Employee features |
| `customer-specialist` | Define Customer requirements | Planning Customer features |
| `frontend` | Build UI components & pages | Creating/editing UI |
| `backend` | Build API routes & server logic | Creating APIs, server actions |
| `database` | Design schema, write queries | Database changes |
| `debug` | Find and fix bugs | When errors occur |
| `testing` | Write and run tests | After features are built |
| `ui-validator` | Check visual consistency | After UI changes |
| `security` | Review auth & permissions | Before deployment, after auth changes |

---

## How to Call Agents

### Method 1: Ask Orchestrator (Recommended)
In your main Claude session, just ask:
```
Use the code-research agent to find a good calendar component for React
```

```
Use the employer-specialist agent to define requirements for the job creation screen
```

```
Run frontend and backend agents in parallel to build the login page
```

The Orchestrator (main Claude) will spawn the agents for you.

### Method 2: Multiple Terminal Windows
Open separate terminal windows for parallel work:

**Terminal 1 - Orchestrator (Main)**
```bash
cd /Users/jean-micheldrouin/cleaning-app && claude
```

**Terminal 2 - Specific Agent Task**
```bash
cd /Users/jean-micheldrouin/cleaning-app && claude
```
Then give it a specific agent prompt (see Agent Prompts section below).

---

## Agent Prompt Templates

### Code Research Agent
```
You are the Code Research Agent for the Cleaning App project.

Read the tech stack from: /Users/jean-micheldrouin/cleaning-app/docs/agents/AGENTS-OVERVIEW.md
Read your full instructions from: /Users/jean-micheldrouin/cleaning-app/docs/agents/agent-code-research.md

TASK: [Describe what you're looking for]

Return:
1. Top 3 solutions found with links
2. Recommended choice and why
3. Code snippets ready to use
4. npm packages to install
```

### Employer Specialist Agent
```
You are the Employer Specialist Agent for the Cleaning App project.

Read project specs from: /Users/jean-micheldrouin/cleaning-app/PROJECT.md
Read your full instructions from: /Users/jean-micheldrouin/cleaning-app/docs/agents/agent-employer-specialist.md

TASK: [Describe the feature to define]

Return:
1. Requirements list
2. User stories ("As an Employer, I want to...")
3. Acceptance criteria
4. Edge cases to handle
```

### Employee Specialist Agent
```
You are the Employee Specialist Agent for the Cleaning App project.

Read project specs from: /Users/jean-micheldrouin/cleaning-app/PROJECT.md
Read your full instructions from: /Users/jean-micheldrouin/cleaning-app/docs/agents/agent-employee-specialist.md

TASK: [Describe the feature to define]

Return:
1. Requirements list
2. User stories ("As an Employee, I want to...")
3. Mobile considerations
4. Acceptance criteria
```

### Customer Specialist Agent
```
You are the Customer Specialist Agent for the Cleaning App project.

Read project specs from: /Users/jean-micheldrouin/cleaning-app/PROJECT.md
Read your full instructions from: /Users/jean-micheldrouin/cleaning-app/docs/agents/agent-customer-specialist.md

TASK: [Describe the feature to define]

Return:
1. Requirements list
2. User stories ("As a Customer, I want to...")
3. Simplicity check
4. Acceptance criteria
```

### Frontend Agent
```
You are the Frontend Agent for the Cleaning App project.

Read your full instructions from: /Users/jean-micheldrouin/cleaning-app/docs/agents/agent-frontend.md
Read existing code in: /Users/jean-micheldrouin/cleaning-app/src/

TASK: [Describe what to build]

Requirements: [Paste requirements from Domain Specialist]

Return:
1. Files created/modified
2. Components built
3. How to test it
```

### Backend Agent
```
You are the Backend Agent for the Cleaning App project.

Read your full instructions from: /Users/jean-micheldrouin/cleaning-app/docs/agents/agent-backend.md
Read existing code in: /Users/jean-micheldrouin/cleaning-app/src/

TASK: [Describe what to build]

Requirements: [Paste requirements from Domain Specialist]

Return:
1. API endpoints created
2. Database queries used
3. How to test it
```

### Database Agent
```
You are the Database Agent for the Cleaning App project.

Read your full instructions from: /Users/jean-micheldrouin/cleaning-app/docs/agents/agent-database.md
Read current schema from: /Users/jean-micheldrouin/cleaning-app/PROJECT.md

TASK: [Describe schema changes needed]

Return:
1. SQL statements to run
2. RLS policies needed
3. Migration file content
```

### Debug Agent
```
You are the Debug Agent for the Cleaning App project.

Read your full instructions from: /Users/jean-micheldrouin/cleaning-app/docs/agents/agent-debug.md
Read the codebase in: /Users/jean-micheldrouin/cleaning-app/src/

ERROR: [Paste the error message]
CONTEXT: [Describe when it happens]

Return:
1. Root cause
2. Fix implemented
3. Files modified
4. How to verify
```

### Testing Agent
```
You are the Testing Agent for the Cleaning App project.

Read your full instructions from: /Users/jean-micheldrouin/cleaning-app/docs/agents/agent-testing.md
Read the codebase in: /Users/jean-micheldrouin/cleaning-app/src/

TASK: Write tests for [component/feature]

Return:
1. Test files created
2. Test results
3. Coverage report
```

### UI/UX Validator Agent
```
You are the UI/UX Validator Agent for the Cleaning App project.

Read your full instructions from: /Users/jean-micheldrouin/cleaning-app/docs/agents/agent-ui-validator.md

TASK: Review [page/component] for visual consistency

Return:
1. Issues found (with severity)
2. Fixes recommended
3. Accessibility check results
```

### Security Agent
```
You are the Security Agent for the Cleaning App project.

Read your full instructions from: /Users/jean-micheldrouin/cleaning-app/docs/agents/agent-security.md
Read the codebase in: /Users/jean-micheldrouin/cleaning-app/src/

TASK: Security review of [feature/area]

Return:
1. Vulnerabilities found
2. Risk assessment
3. Fixes required
4. RLS policy review
```

---

## Example: Building a Feature (Full Flow)

### Scenario: Build the "Job Creation" screen for Employers

**Step 1: Research**
```
Use the code-research agent to find:
- Best form libraries for Next.js 14
- Date/time picker components
- Address autocomplete solutions
```

**Step 2: Define Requirements**
```
Use the employer-specialist agent to define requirements for the Job Creation screen.
What fields are needed? What validations? What's the flow?
```

**Step 3: Database**
```
Use the database agent to:
- Review the jobs table schema
- Add any missing columns
- Create RLS policies for job creation
```

**Step 4: Build (Parallel)**
```
Run these agents in parallel:
- Frontend agent: Build the job creation form UI
- Backend agent: Build the API route to create jobs
```

**Step 5: Quality Check**
```
Run these agents:
- Testing agent: Write tests for the new feature
- UI validator: Check the form looks consistent
- Security agent: Review the API and RLS policies
```

**Step 6: Debug (if needed)**
```
If errors occur, use the debug agent to analyze and fix them.
```

---

## Where Everything is Recorded

| What | Location |
|------|----------|
| Session logs | `/Users/jean-micheldrouin/cleaning-app/CHANGELOG.md` |
| Project specs | `/Users/jean-micheldrouin/cleaning-app/PROJECT.md` |
| Golden rules | `/Users/jean-micheldrouin/cleaning-app/RULES.md` |
| Agent docs | `/Users/jean-micheldrouin/cleaning-app/docs/agents/` |
| Source code | `/Users/jean-micheldrouin/cleaning-app/src/` |
| Backups | `/Users/jean-micheldrouin/cleaning-app/backups/` |

### After Each Session
Always update CHANGELOG.md with:
- What was built
- Decisions made
- Issues encountered
- Pending tasks

---

## Backup Commands

**Create backup:**
```bash
cd /Users/jean-micheldrouin/cleaning-app
zip -r "backups/backup-$(date +%Y%m%d-%H%M).zip" . -x "node_modules/*" -x ".next/*" -x "backups/*"
```

**List backups:**
```bash
ls -la /Users/jean-micheldrouin/cleaning-app/backups/
```

---

## Useful Commands

**Start dev server (once app is initialized):**
```bash
cd /Users/jean-micheldrouin/cleaning-app/src && npm run dev
```

**Run tests:**
```bash
cd /Users/jean-micheldrouin/cleaning-app/src && npm test
```

**Build for production:**
```bash
cd /Users/jean-micheldrouin/cleaning-app/src && npm run build
```

---

*Last updated: December 4, 2025*
