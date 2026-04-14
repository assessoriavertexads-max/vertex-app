-- Safe migration: ensure all required schema is applied
-- Safe to run multiple times (idempotent)

-- ── Companies: add optional columns ───────────────────────────────────────────
ALTER TABLE companies ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS meta_ad_account_id TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS google_ad_account_id TEXT;

-- ── Spaces / Lists / Tasks (create only if absent) ────────────────────────────
CREATE TABLE IF NOT EXISTS spaces (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  space_id UUID REFERENCES spaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  list_id UUID REFERENCES lists(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'a_receber',
  priority TEXT DEFAULT 'normal',
  due_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ── Automation rules ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS automation_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  trigger_event TEXT NOT NULL DEFAULT 'lead_stage_change',
  trigger_value TEXT NOT NULL,
  action_type TEXT NOT NULL DEFAULT 'create_task',
  action_data JSONB NOT NULL DEFAULT '{}',
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── RLS for automation_rules ──────────────────────────────────────────────────
ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "auth_users_automation_rules_all" ON automation_rules
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Ensure auth_user_id exists where RLS policies may reference it ────────────
ALTER TABLE spaces ADD COLUMN IF NOT EXISTS auth_user_id UUID DEFAULT auth.uid();
ALTER TABLE lists ADD COLUMN IF NOT EXISTS auth_user_id UUID DEFAULT auth.uid();
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS auth_user_id UUID DEFAULT auth.uid();
ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS auth_user_id UUID DEFAULT auth.uid();

-- ── RLS for spaces ────────────────────────────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE spaces ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Drop old restrictive policy if present, replace with permissive for authenticated
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can view their own spaces" ON spaces;
  DROP POLICY IF EXISTS "Users can insert their own spaces" ON spaces;
  DROP POLICY IF EXISTS "Users can update their own spaces" ON spaces;
  DROP POLICY IF EXISTS "Users can delete their own spaces" ON spaces;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "auth_users_spaces_all" ON spaces
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── RLS for lists ─────────────────────────────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE lists ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can view their own lists" ON lists;
  DROP POLICY IF EXISTS "Users can insert their own lists" ON lists;
  DROP POLICY IF EXISTS "Users can update their own lists" ON lists;
  DROP POLICY IF EXISTS "Users can delete their own lists" ON lists;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "auth_users_lists_all" ON lists
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── RLS for tasks ─────────────────────────────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Drop old restrictive policies (auth_user_id check causes errors if rows were inserted without it)
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can view their own tasks" ON tasks;
  DROP POLICY IF EXISTS "Users can insert their own tasks" ON tasks;
  DROP POLICY IF EXISTS "Users can update their own tasks" ON tasks;
  DROP POLICY IF EXISTS "Users can delete their own tasks" ON tasks;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "auth_users_tasks_all" ON tasks
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
