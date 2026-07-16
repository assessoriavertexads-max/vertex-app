-- ── Projetos ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS projects (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  name         TEXT        NOT NULL,
  description  TEXT,
  company_id   UUID        REFERENCES companies(id) ON DELETE SET NULL,
  status       TEXT        NOT NULL DEFAULT 'active'
               CHECK (status IN ('active','paused','completed','cancelled')),
  start_date   DATE,
  end_date     DATE,
  is_template  BOOLEAN     DEFAULT FALSE,
  auth_user_id UUID        DEFAULT auth.uid(),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own projects"
  ON projects FOR ALL USING (auth_user_id = auth.uid());

-- ── Milestones ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS project_milestones (
  id          UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id  UUID    NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        TEXT    NOT NULL,
  due_date    DATE,
  status      TEXT    NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending','done')),
  sort_order  INT     DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE project_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own milestones"
  ON project_milestones FOR ALL
  USING (
    project_id IN (SELECT id FROM projects WHERE auth_user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_milestones_project ON project_milestones(project_id);

-- ── Vincula tarefas a projetos ───────────────────────────────────────────────

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);

-- ── Webhooks (Zapier / Make) ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS webhook_configs (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  name         TEXT        NOT NULL,
  url          TEXT        NOT NULL,
  events       TEXT[]      NOT NULL DEFAULT '{}',
  active       BOOLEAN     DEFAULT TRUE,
  auth_user_id UUID        DEFAULT auth.uid(),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE webhook_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own webhooks"
  ON webhook_configs FOR ALL USING (auth_user_id = auth.uid());

COMMENT ON TABLE projects IS 'Projetos vinculados a clientes com milestones e tarefas.';
COMMENT ON TABLE project_milestones IS 'Etapas/marcos de um projeto.';
COMMENT ON TABLE webhook_configs IS 'Webhooks outbound para Zapier, Make e similares.';
