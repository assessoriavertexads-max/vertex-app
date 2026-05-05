-- Fix definitivo: RLS permissivo para tasks, lists e spaces
-- Remove todas as políticas conflitantes e cria uma única por tabela

-- ── TASKS ─────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can view their own tasks"    ON public.tasks;
  DROP POLICY IF EXISTS "Users can insert their own tasks"  ON public.tasks;
  DROP POLICY IF EXISTS "Users can update their own tasks"  ON public.tasks;
  DROP POLICY IF EXISTS "Users can delete their own tasks"  ON public.tasks;
  DROP POLICY IF EXISTS "auth_users_tasks_all"              ON public.tasks;
  DROP POLICY IF EXISTS "Authenticated full access tasks"   ON public.tasks;
  DROP POLICY IF EXISTS "Users read own tasks"              ON public.tasks;
  DROP POLICY IF EXISTS "Users insert own tasks"            ON public.tasks;
  DROP POLICY IF EXISTS "Users update own tasks"            ON public.tasks;
  DROP POLICY IF EXISTS "Users delete own tasks"            ON public.tasks;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "tasks_authenticated_all" ON public.tasks
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── LISTS ─────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can view their own lists"    ON public.lists;
  DROP POLICY IF EXISTS "Users can insert their own lists"  ON public.lists;
  DROP POLICY IF EXISTS "Users can update their own lists"  ON public.lists;
  DROP POLICY IF EXISTS "Users can delete their own lists"  ON public.lists;
  DROP POLICY IF EXISTS "auth_users_lists_all"              ON public.lists;
  DROP POLICY IF EXISTS "Authenticated full access lists"   ON public.lists;
  DROP POLICY IF EXISTS "Users read own lists"              ON public.lists;
  DROP POLICY IF EXISTS "Users insert own lists"            ON public.lists;
  DROP POLICY IF EXISTS "Users update own lists"            ON public.lists;
  DROP POLICY IF EXISTS "Users delete own lists"            ON public.lists;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE public.lists ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "lists_authenticated_all" ON public.lists
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── SPACES ────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can view their own spaces"    ON public.spaces;
  DROP POLICY IF EXISTS "Users can insert their own spaces"  ON public.spaces;
  DROP POLICY IF EXISTS "Users can update their own spaces"  ON public.spaces;
  DROP POLICY IF EXISTS "Users can delete their own spaces"  ON public.spaces;
  DROP POLICY IF EXISTS "auth_users_spaces_all"              ON public.spaces;
  DROP POLICY IF EXISTS "Authenticated full access spaces"   ON public.spaces;
  DROP POLICY IF EXISTS "Users read own spaces"              ON public.spaces;
  DROP POLICY IF EXISTS "Users insert own spaces"            ON public.spaces;
  DROP POLICY IF EXISTS "Users update own spaces"            ON public.spaces;
  DROP POLICY IF EXISTS "Users delete own spaces"            ON public.spaces;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE public.spaces ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "spaces_authenticated_all" ON public.spaces
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
