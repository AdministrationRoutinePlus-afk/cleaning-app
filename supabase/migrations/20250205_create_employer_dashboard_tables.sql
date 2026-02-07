-- Migration: Create employer dashboard tables
-- Purpose: Add employer_notes, employer_todos, and job_session_notes tables
-- for the Employer Dashboard feature

-- =============================================
-- ENUM TYPES
-- =============================================

CREATE TYPE employer_note_type AS ENUM ('ILLNESS', 'ABSENCE', 'PERFORMANCE', 'OTHER');
CREATE TYPE todo_priority AS ENUM ('LOW', 'MEDIUM', 'HIGH');
CREATE TYPE job_session_note_type AS ENUM ('CLIENT_FEEDBACK', 'INTERNAL', 'FOLLOW_UP');

-- =============================================
-- 1. EMPLOYER NOTES
-- Employee-related notes (illness, absence, performance)
-- =============================================

CREATE TABLE IF NOT EXISTS employer_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id UUID NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  note_type employer_note_type NOT NULL DEFAULT 'OTHER',
  title TEXT NOT NULL,
  content TEXT,
  note_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_employer_notes_employer_id
  ON employer_notes(employer_id);
CREATE INDEX IF NOT EXISTS idx_employer_notes_employee_id
  ON employer_notes(employee_id);
CREATE INDEX IF NOT EXISTS idx_employer_notes_note_date
  ON employer_notes(note_date);
CREATE INDEX IF NOT EXISTS idx_employer_notes_note_type
  ON employer_notes(note_type);

-- Enable RLS
ALTER TABLE employer_notes ENABLE ROW LEVEL SECURITY;

-- Employers can manage their own notes (full CRUD)
CREATE POLICY "Employers can manage their notes"
  ON employer_notes
  FOR ALL
  USING (
    employer_id IN (
      SELECT id FROM employers WHERE user_id = auth.uid()
    )
  );

-- =============================================
-- 2. EMPLOYER TODOS
-- To-do list items for employers
-- =============================================

CREATE TABLE IF NOT EXISTS employer_todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id UUID NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  is_completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  priority todo_priority NOT NULL DEFAULT 'MEDIUM',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_employer_todos_employer_id
  ON employer_todos(employer_id);
CREATE INDEX IF NOT EXISTS idx_employer_todos_is_completed
  ON employer_todos(is_completed);
CREATE INDEX IF NOT EXISTS idx_employer_todos_due_date
  ON employer_todos(due_date);
CREATE INDEX IF NOT EXISTS idx_employer_todos_priority
  ON employer_todos(priority);

-- Enable RLS
ALTER TABLE employer_todos ENABLE ROW LEVEL SECURITY;

-- Employers can manage their own todos (full CRUD)
CREATE POLICY "Employers can manage their todos"
  ON employer_todos
  FOR ALL
  USING (
    employer_id IN (
      SELECT id FROM employers WHERE user_id = auth.uid()
    )
  );

-- =============================================
-- 3. JOB SESSION NOTES
-- Notes attached to specific job sessions
-- =============================================

CREATE TABLE IF NOT EXISTS job_session_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_session_id UUID NOT NULL REFERENCES job_sessions(id) ON DELETE CASCADE,
  employer_id UUID NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
  note_type job_session_note_type NOT NULL DEFAULT 'INTERNAL',
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_job_session_notes_session_id
  ON job_session_notes(job_session_id);
CREATE INDEX IF NOT EXISTS idx_job_session_notes_employer_id
  ON job_session_notes(employer_id);
CREATE INDEX IF NOT EXISTS idx_job_session_notes_note_type
  ON job_session_notes(note_type);

-- Enable RLS
ALTER TABLE job_session_notes ENABLE ROW LEVEL SECURITY;

-- Employers can manage notes on sessions they own
CREATE POLICY "Employers can manage their job session notes"
  ON job_session_notes
  FOR ALL
  USING (
    employer_id IN (
      SELECT id FROM employers WHERE user_id = auth.uid()
    )
  );
