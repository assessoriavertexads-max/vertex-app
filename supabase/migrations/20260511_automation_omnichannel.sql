-- Evolução do motor de automação: suporte a e-mail, post_social e observabilidade
-- Migração segura: apenas ADD COLUMN IF NOT EXISTS, sem DROP TABLE

ALTER TABLE automation_rules
  ADD COLUMN IF NOT EXISTS email_subject  TEXT,
  ADD COLUMN IF NOT EXISTS last_run_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS run_count      INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error     TEXT;

COMMENT ON COLUMN automation_rules.email_subject IS
  'Assunto do e-mail (action_type=send_email). Suporta variáveis: {company_name}, {entity_name}, {due_date}.';
COMMENT ON COLUMN automation_rules.last_run_at IS
  'Última vez que esta regra foi disparada com sucesso pelo cron check-due-dates.';
COMMENT ON COLUMN automation_rules.run_count IS
  'Total acumulado de execuções bem-sucedidas desta regra.';
COMMENT ON COLUMN automation_rules.last_error IS
  'Última mensagem de erro registrada; null indica que a última execução foi bem-sucedida.';
