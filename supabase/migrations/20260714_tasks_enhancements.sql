-- Melhorias na tabela tasks: checklist, tags, responsável, estimativa, dependências

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS checklist      JSONB     DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS tags           TEXT[]    DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS assigned_to    TEXT,
  ADD COLUMN IF NOT EXISTS estimated_hours NUMERIC(5,1),
  ADD COLUMN IF NOT EXISTS blocked_by_ids UUID[]    DEFAULT '{}';

COMMENT ON COLUMN tasks.checklist       IS 'Array de {id, text, done} — subtarefas internas';
COMMENT ON COLUMN tasks.tags            IS 'Etiquetas livres para categorização';
COMMENT ON COLUMN tasks.assigned_to    IS 'Nome do responsável pela tarefa';
COMMENT ON COLUMN tasks.estimated_hours IS 'Estimativa de tempo em horas';
COMMENT ON COLUMN tasks.blocked_by_ids  IS 'IDs de tarefas que bloqueiam esta (dependências)';
