-- Histórico de interações por empresa (ligações, reuniões, e-mails, anotações)

CREATE TABLE IF NOT EXISTS company_interactions (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id  UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  type        TEXT        NOT NULL DEFAULT 'note'
              CHECK (type IN ('note', 'call', 'meeting', 'email', 'whatsapp')),
  description TEXT        NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE company_interactions ENABLE ROW LEVEL SECURITY;

-- Usuário pode gerenciar interações de suas próprias empresas
CREATE POLICY "Users manage own company interactions"
  ON company_interactions FOR ALL
  USING (
    company_id IN (
      SELECT id FROM companies WHERE auth_user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_ci_company   ON company_interactions(company_id);
CREATE INDEX IF NOT EXISTS idx_ci_created   ON company_interactions(created_at DESC);

COMMENT ON TABLE company_interactions IS 'Histórico de interações com clientes: ligações, reuniões, e-mails, anotações.';
