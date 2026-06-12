-- Migration 013: Fix missing schema components
-- Fixes critical issues: missing is_admin() function, missing contributions tables,
-- missing notification columns, incomplete test_progress schema

-- Helper function used in RLS policies across migrations 007-010
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT role = 'admin' FROM profiles WHERE id = auth.uid();
$$;

-- Contributions system tables (referenced in migration 007 RPCs but never created)
CREATE TABLE IF NOT EXISTS contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  subject_id text,
  content text NOT NULL,
  explanation text,
  status text DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contribution_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contribution_id uuid NOT NULL REFERENCES contributions(id) ON DELETE CASCADE,
  content text NOT NULL,
  is_correct boolean DEFAULT false,
  position int
);

-- Indexes for contributions queries
CREATE INDEX IF NOT EXISTS idx_contributions_user_id ON contributions(user_id);
CREATE INDEX IF NOT EXISTS idx_contributions_status ON contributions(status);
CREATE INDEX IF NOT EXISTS idx_contribution_options_contribution_id ON contribution_options(contribution_id);

-- RLS for contributions
ALTER TABLE contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE contribution_options ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contributions_select ON contributions;
DROP POLICY IF EXISTS contributions_insert ON contributions;
DROP POLICY IF EXISTS contributions_update_admin ON contributions;
DROP POLICY IF EXISTS contribution_options_select ON contribution_options;

CREATE POLICY contributions_select ON contributions FOR SELECT USING (true);
CREATE POLICY contributions_insert ON contributions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY contributions_update_admin ON contributions FOR UPDATE USING (is_admin());

CREATE POLICY contribution_options_select ON contribution_options FOR SELECT USING (true);
CREATE POLICY contribution_options_insert ON contribution_options FOR INSERT
  WITH CHECK (EXISTS(SELECT 1 FROM contributions WHERE id = contribution_id AND user_id = auth.uid()));

-- Add missing columns to notifications table
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS related_question_id text;

-- Ensure test_progress has all required columns from migration 007
ALTER TABLE test_progress ADD COLUMN IF NOT EXISTS quiz_key text;
ALTER TABLE test_progress ADD COLUMN IF NOT EXISTS states jsonb;
ALTER TABLE test_progress ADD COLUMN IF NOT EXISTS correct_count int DEFAULT 0;
ALTER TABLE test_progress ADD COLUMN IF NOT EXISTS answered_count int DEFAULT 0;
ALTER TABLE test_progress ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Add unique constraint on (user_id, quiz_key) if it doesn't exist
-- Note: This may fail if existing data violates it; examine and clean before running
DO $$
BEGIN
  ALTER TABLE test_progress ADD CONSTRAINT test_progress_user_quiz_key_unique UNIQUE(user_id, quiz_key);
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;
