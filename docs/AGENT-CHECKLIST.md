# Agent Coordination Checklist

## MANDATORY FILES TO READ BEFORE WORKING

Every agent MUST read these files first:

1. `/Users/jean-micheldrouin/cleaning-app/RULES.md` - Project rules
2. `/Users/jean-micheldrouin/cleaning-app/docs/SUBAGENT-INSTRUCTIONS.md` - Tech stack & patterns
3. `/Users/jean-micheldrouin/cleaning-app/src/src/types/database.ts` - **TYPE DEFINITIONS (CRITICAL)**

## CRITICAL RULES

### 1. Types
- **ALWAYS** import types from `@/types/database`
- **NEVER** create duplicate type definitions
- **NEVER** guess column names - check the types file

### 2. Database Column Names
The correct column name linking to auth.users is: `user_id` (NOT auth_user_id)

### 3. Imports
```typescript
// CORRECT - Types
import type { JobTemplate, Employee, Customer } from '@/types/database'

// CORRECT - Supabase client
import { createClient } from '@/lib/supabase/client' // Client-side
import { createClient } from '@/lib/supabase/server' // Server-side

// CORRECT - UI Components
import { Button } from '@/components/ui/button'
```

### 4. Component Structure
```typescript
'use client' // Only if using hooks/interactivity

import { useState } from 'react'
import type { SomeType } from '@/types/database'
import { createClient } from '@/lib/supabase/client'

interface Props {
  // props here
}

export function ComponentName({ prop }: Props) {
  // hooks first
  // handlers
  // return JSX
}
```

### 5. Supabase Queries
```typescript
// CORRECT query format
const { data, error } = await supabase
  .from('table_name')
  .select('*')
  .eq('user_id', userId) // NOT auth_user_id

// With joins
const { data } = await supabase
  .from('job_sessions')
  .select(`
    *,
    job_template:job_templates(*),
    employee:employees(*)
  `)
```

### 6. File Locations
- Pages: `/src/src/app/[profile]/[feature]/page.tsx`
- Components: `/src/src/components/[ComponentName].tsx`
- Shared UI: `/src/src/components/ui/[component].tsx`
- Types: `/src/src/types/database.ts` (DO NOT CREATE OTHERS)
- Hooks: `/src/src/hooks/[hookName].ts`

### 7. shadcn/ui Installation
```bash
cd /Users/jean-micheldrouin/cleaning-app/src
npx shadcn@latest add [component-name]
```

## VERIFICATION BEFORE COMPLETING

Before marking task complete, verify:
- [ ] All types imported from `@/types/database`
- [ ] No duplicate type definitions created
- [ ] Database queries use correct column names (user_id)
- [ ] File created in correct location
- [ ] Build passes: `npm run build`
- [ ] No TypeScript errors

## RETURN FORMAT

When completing a task, return:
1. List of files created/modified with full paths
2. Any dependencies installed
3. Any issues encountered
4. Confirmation that build passes
