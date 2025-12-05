-- Fix RLS for employer_settings table

-- Drop existing policies if any
DROP POLICY IF EXISTS "Employers can manage their settings" ON employer_settings;
DROP POLICY IF EXISTS "Employers can view their settings" ON employer_settings;
DROP POLICY IF EXISTS "Employers can insert their settings" ON employer_settings;
DROP POLICY IF EXISTS "Employers can update their settings" ON employer_settings;

-- Create proper policies
CREATE POLICY "Employers can view their settings"
ON employer_settings FOR SELECT
USING (
  employer_id IN (SELECT id FROM employers WHERE user_id = auth.uid())
);

CREATE POLICY "Employers can insert their settings"
ON employer_settings FOR INSERT
WITH CHECK (
  employer_id IN (SELECT id FROM employers WHERE user_id = auth.uid())
);

CREATE POLICY "Employers can update their settings"
ON employer_settings FOR UPDATE
USING (
  employer_id IN (SELECT id FROM employers WHERE user_id = auth.uid())
);

-- Fix RLS for company_info table

DROP POLICY IF EXISTS "Employers can view their company info" ON company_info;
DROP POLICY IF EXISTS "Employers can insert their company info" ON company_info;
DROP POLICY IF EXISTS "Employers can update their company info" ON company_info;

CREATE POLICY "Employers can view their company info"
ON company_info FOR SELECT
USING (
  employer_id IN (SELECT id FROM employers WHERE user_id = auth.uid())
);

CREATE POLICY "Employers can insert their company info"
ON company_info FOR INSERT
WITH CHECK (
  employer_id IN (SELECT id FROM employers WHERE user_id = auth.uid())
);

CREATE POLICY "Employers can update their company info"
ON company_info FOR UPDATE
USING (
  employer_id IN (SELECT id FROM employers WHERE user_id = auth.uid())
);
