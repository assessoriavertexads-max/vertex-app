-- Tabela de regras de automação
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

ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "automation_select" ON automation_rules FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "automation_insert" ON automation_rules FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "automation_update" ON automation_rules FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "automation_delete" ON automation_rules FOR DELETE USING (auth.uid() IS NOT NULL);
