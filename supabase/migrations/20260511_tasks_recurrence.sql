-- Tarefas recorrentes: colunas + motor de lazy-generation via trigger
-- Constraint: NUNCA gera todas as ocorrências de uma vez.
-- A próxima ocorrência é criada apenas quando a atual for concluída.

-- 1. Adiciona colunas à tabela tasks
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS recurrence_pattern TEXT
    CHECK (recurrence_pattern IN ('daily','weekly','biweekly','monthly','quarterly')),
  ADD COLUMN IF NOT EXISTS parent_task_id UUID
    REFERENCES tasks(id) ON DELETE SET NULL;

COMMENT ON COLUMN tasks.recurrence_pattern IS
  'Frequência de recorrência. Quando concluída, o trigger cria a próxima ocorrência.';
COMMENT ON COLUMN tasks.parent_task_id IS
  'ID da tarefa-pai que originou esta ocorrência (lazy chain).';

-- 2. Função de trigger: spawn da próxima ocorrência
-- SECURITY DEFINER: necessário para bypass de RLS no INSERT.
-- auth_user_id é copiado da tarefa concluída para manter multi-tenancy.
CREATE OR REPLACE FUNCTION fn_spawn_recurring_task()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_next_due DATE;
BEGIN
  -- Só dispara quando status muda para 'concluido', há padrão de recorrência e due_date definida
  IF NEW.status = 'concluido'
    AND (OLD.status IS DISTINCT FROM 'concluido')
    AND NEW.recurrence_pattern IS NOT NULL
    AND NEW.due_date IS NOT NULL
  THEN
    v_next_due := CASE NEW.recurrence_pattern
      WHEN 'daily'     THEN (NEW.due_date::date + INTERVAL '1 day')::date
      WHEN 'weekly'    THEN (NEW.due_date::date + INTERVAL '7 days')::date
      WHEN 'biweekly'  THEN (NEW.due_date::date + INTERVAL '14 days')::date
      WHEN 'monthly'   THEN (NEW.due_date::date + INTERVAL '1 month')::date
      WHEN 'quarterly' THEN (NEW.due_date::date + INTERVAL '3 months')::date
    END;

    INSERT INTO tasks (
      name,
      description,
      priority,
      status,
      due_date,
      company_id,
      list_id,
      recurrence_pattern,
      parent_task_id,
      auth_user_id
    ) VALUES (
      NEW.name,
      NEW.description,
      NEW.priority,
      'a_receber',
      v_next_due,
      NEW.company_id,
      NEW.list_id,
      NEW.recurrence_pattern,
      NEW.id,
      NEW.auth_user_id
    );
  END IF;

  RETURN NEW;
END;
$$;

-- 3. Associa o trigger à tabela tasks
DROP TRIGGER IF EXISTS trg_tasks_recurrence ON tasks;
CREATE TRIGGER trg_tasks_recurrence
  AFTER UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION fn_spawn_recurring_task();
