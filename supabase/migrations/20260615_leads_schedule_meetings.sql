-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Campos de contato e agendamento em leads
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS email        TEXT,
  ADD COLUMN IF NOT EXISTS phone        TEXT,
  ADD COLUMN IF NOT EXISTS notes        TEXT,
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source       TEXT;   -- ex: 'form', 'manual'

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Meetings — agendamentos criados por formulários
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.meetings (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id          UUID        REFERENCES public.leads(id) ON DELETE SET NULL,
  form_id          UUID        REFERENCES public.lead_forms(id) ON DELETE SET NULL,
  scheduled_at     TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER     NOT NULL DEFAULT 30,
  title            TEXT,
  notes            TEXT,
  status           TEXT        NOT NULL DEFAULT 'scheduled',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "meetings_select" ON public.meetings;
DROP POLICY IF EXISTS "meetings_insert" ON public.meetings;
DROP POLICY IF EXISTS "meetings_update" ON public.meetings;
DROP POLICY IF EXISTS "meetings_delete" ON public.meetings;

CREATE POLICY "meetings_select" ON public.meetings FOR SELECT USING (auth.uid() = auth_user_id);
CREATE POLICY "meetings_insert" ON public.meetings FOR INSERT WITH CHECK (auth.uid() = auth_user_id);
CREATE POLICY "meetings_update" ON public.meetings FOR UPDATE USING (auth.uid() = auth_user_id);
CREATE POLICY "meetings_delete" ON public.meetings FOR DELETE USING (auth.uid() = auth_user_id);

CREATE INDEX IF NOT EXISTS idx_meetings_user        ON public.meetings(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_meetings_lead        ON public.meetings(lead_id);
CREATE INDEX IF NOT EXISTS idx_meetings_scheduled   ON public.meetings(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_leads_scheduled_at   ON public.leads(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_leads_auth_user      ON public.leads(auth_user_id);
