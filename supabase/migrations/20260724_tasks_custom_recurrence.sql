-- Recorrência personalizada em tarefas
-- Formato: custom_Nd (dias), custom_Nw (semanas), custom_Nm (meses)
-- Ex: custom_3d = a cada 3 dias, custom_2w = a cada 2 semanas

-- 1. Remove o CHECK antigo que só aceita valores fixos
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_recurrence_pattern_check;

-- 2. Adiciona constraint flexível: padrões predefinidos OU custom_N[dwm]
ALTER TABLE tasks ADD CONSTRAINT tasks_recurrence_pattern_check
  CHECK (
    recurrence_pattern IN ('daily','weekly','biweekly','monthly','quarterly')
    OR recurrence_pattern ~ '^custom_[1-9][0-9]*[dwm]$'
  );

-- 3. Atualiza a função do trigger para suportar padrões personalizados
CREATE OR REPLACE FUNCTION fn_spawn_recurring_task()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_next_due DATE;
  v_suffix   TEXT;
  v_unit     CHAR;
  v_count    INT;
BEGIN
  IF NEW.status = 'concluido'
    AND (OLD.status IS DISTINCT FROM 'concluido')
    AND NEW.recurrence_pattern IS NOT NULL
    AND NEW.due_date IS NOT NULL
  THEN
    IF NEW.recurrence_pattern LIKE 'custom_%' THEN
      -- Extrai sufixo após 'custom_', ex: '3d', '2w', '1m'
      v_suffix := SUBSTRING(NEW.recurrence_pattern FROM 8);
      v_unit   := RIGHT(v_suffix, 1);
      v_count  := LEFT(v_suffix, LENGTH(v_suffix) - 1)::INT;
      v_next_due := CASE v_unit
        WHEN 'd' THEN (NEW.due_date::date + (v_count || ' days')::INTERVAL)::date
        WHEN 'w' THEN (NEW.due_date::date + (v_count * 7 || ' days')::INTERVAL)::date
        WHEN 'm' THEN (NEW.due_date::date + (v_count || ' months')::INTERVAL)::date
        ELSE NULL
      END;
    ELSE
      v_next_due := CASE NEW.recurrence_pattern
        WHEN 'daily'     THEN (NEW.due_date::date + INTERVAL '1 day')::date
        WHEN 'weekly'    THEN (NEW.due_date::date + INTERVAL '7 days')::date
        WHEN 'biweekly'  THEN (NEW.due_date::date + INTERVAL '14 days')::date
        WHEN 'monthly'   THEN (NEW.due_date::date + INTERVAL '1 month')::date
        WHEN 'quarterly' THEN (NEW.due_date::date + INTERVAL '3 months')::date
        ELSE NULL
      END;
    END IF;

    IF v_next_due IS NOT NULL THEN
      INSERT INTO tasks (
        name, description, priority, status, due_date,
        company_id, list_id, recurrence_pattern, parent_task_id, auth_user_id
      ) VALUES (
        NEW.name, NEW.description, NEW.priority, 'a_receber', v_next_due,
        NEW.company_id, NEW.list_id, NEW.recurrence_pattern, NEW.id, NEW.auth_user_id
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
