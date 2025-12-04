-- =============================================
-- CLEANING APP DATABASE SCHEMA
-- Part 6: Settings Tables (3 tables)
-- =============================================

-- 1. EMPLOYER SETTINGS
CREATE TABLE employer_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id UUID NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
  theme theme_type DEFAULT 'LIGHT',
  primary_color VARCHAR(7) DEFAULT '#3B82F6',
  logo_url TEXT,
  language VARCHAR(5) DEFAULT 'en',
  push_enabled BOOLEAN DEFAULT TRUE,
  notify_new_message BOOLEAN DEFAULT TRUE,
  notify_job_claimed BOOLEAN DEFAULT TRUE,
  notify_exchange_request BOOLEAN DEFAULT TRUE,
  reminder_2_days BOOLEAN DEFAULT TRUE,
  reminder_1_day BOOLEAN DEFAULT TRUE,
  reminder_6_hours BOOLEAN DEFAULT TRUE,
  sound_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employer_id)
);

-- 2. NOTIFICATION SETTINGS (Per-user notification preferences)
CREATE TABLE notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_type VARCHAR(50) NOT NULL,
  is_enabled BOOLEAN DEFAULT TRUE,
  push_enabled BOOLEAN DEFAULT TRUE,
  in_app_enabled BOOLEAN DEFAULT TRUE,
  UNIQUE(user_id, notification_type)
);

-- 3. REMINDER SETTINGS
CREATE TABLE reminder_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employer_id UUID NOT NULL REFERENCES employers(id) ON DELETE CASCADE,
  reminder_2_days BOOLEAN DEFAULT TRUE,
  reminder_1_day BOOLEAN DEFAULT TRUE,
  reminder_6_hours BOOLEAN DEFAULT TRUE,
  UNIQUE(employer_id)
);

-- Indexes for settings tables
CREATE INDEX idx_employer_settings_employer ON employer_settings(employer_id);
CREATE INDEX idx_notification_settings_user ON notification_settings(user_id);
CREATE INDEX idx_reminder_settings_employer ON reminder_settings(employer_id);
