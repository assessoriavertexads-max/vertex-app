
-- Spaces
CREATE TABLE IF NOT EXISTS public.spaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  auth_user_id UUID DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.spaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access spaces" ON public.spaces FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Lists
CREATE TABLE IF NOT EXISTS public.lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  space_id UUID REFERENCES public.spaces(id) ON DELETE CASCADE,
  auth_user_id UUID DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access lists" ON public.lists FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tasks
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pendente',
  priority TEXT NOT NULL DEFAULT 'media',
  due_date DATE,
  list_id UUID REFERENCES public.lists(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  auth_user_id UUID DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access tasks" ON public.tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Automation Rules
CREATE TABLE IF NOT EXISTS public.automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  trigger_event TEXT NOT NULL,
  trigger_value TEXT NOT NULL,
  action_type TEXT NOT NULL,
  action_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT true,
  auth_user_id UUID DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access automation_rules" ON public.automation_rules FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Financial transactions
CREATE TABLE IF NOT EXISTS public.financial_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  type TEXT NOT NULL DEFAULT 'expense',
  status TEXT NOT NULL DEFAULT 'pending',
  due_date DATE,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  auth_user_id UUID DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access financial_transactions" ON public.financial_transactions FOR ALL TO authenticated USING (true) WITH CHECK (true);
