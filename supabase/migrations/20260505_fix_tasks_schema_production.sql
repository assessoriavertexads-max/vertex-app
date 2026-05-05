-- Corrige schema da tabela tasks em produção
-- A tabela foi criada com 'title' em vez de 'name', e sem as colunas priority e auth_user_id

ALTER TABLE public.tasks RENAME COLUMN title TO name;

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal';
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS auth_user_id UUID DEFAULT auth.uid();

NOTIFY pgrst, 'reload schema';
