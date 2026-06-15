-- ─────────────────────────────────────────────────────────────────────────────
-- Lead Forms — formulários públicos de captação (estilo Typeform)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lead_forms (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id  UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title         TEXT        NOT NULL,
  slug          TEXT        NOT NULL UNIQUE,
  description   TEXT,
  questions     JSONB       NOT NULL DEFAULT '[]',
  settings      JSONB       NOT NULL DEFAULT '{}',
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  response_count INTEGER    NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.lead_form_responses (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id       UUID        NOT NULL REFERENCES public.lead_forms(id) ON DELETE CASCADE,
  lead_id       UUID        REFERENCES public.leads(id) ON DELETE SET NULL,
  answers       JSONB       NOT NULL DEFAULT '{}',
  submitted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE public.lead_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_form_responses ENABLE ROW LEVEL SECURITY;

-- Formulários: apenas o dono acessa
DROP POLICY IF EXISTS "lead_forms_select" ON public.lead_forms;
DROP POLICY IF EXISTS "lead_forms_insert" ON public.lead_forms;
DROP POLICY IF EXISTS "lead_forms_update" ON public.lead_forms;
DROP POLICY IF EXISTS "lead_forms_delete" ON public.lead_forms;
DROP POLICY IF EXISTS "lead_forms_public_read" ON public.lead_forms;

CREATE POLICY "lead_forms_select"      ON public.lead_forms FOR SELECT USING (auth.uid() = auth_user_id);
CREATE POLICY "lead_forms_insert"      ON public.lead_forms FOR INSERT WITH CHECK (auth.uid() = auth_user_id);
CREATE POLICY "lead_forms_update"      ON public.lead_forms FOR UPDATE USING (auth.uid() = auth_user_id);
CREATE POLICY "lead_forms_delete"      ON public.lead_forms FOR DELETE USING (auth.uid() = auth_user_id);
-- Formulários ativos são lidos publicamente (para exibir o form)
CREATE POLICY "lead_forms_public_read" ON public.lead_forms FOR SELECT USING (is_active = true);

-- Respostas: apenas o dono vê
DROP POLICY IF EXISTS "form_responses_select" ON public.lead_form_responses;
CREATE POLICY "form_responses_select" ON public.lead_form_responses
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.lead_forms f WHERE f.id = form_id AND f.auth_user_id = auth.uid())
  );

-- Índices
CREATE INDEX IF NOT EXISTS idx_lead_forms_user ON public.lead_forms(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_lead_forms_slug ON public.lead_forms(slug);
CREATE INDEX IF NOT EXISTS idx_form_responses_form ON public.lead_form_responses(form_id);
