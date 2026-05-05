-- Garante que a coluna list_id existe na tabela tasks
-- Caso a tabela tenha sido criada antes desta migração, a coluna pode estar faltando.

-- Garantir que spaces e lists existem
CREATE TABLE IF NOT EXISTS spaces (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  space_id UUID REFERENCES spaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Adicionar list_id se não existir
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS list_id UUID REFERENCES lists(id) ON DELETE SET NULL;

-- Garantir que a coluna due_date é DATE (ou TIMESTAMPTZ) — não trocar tipo se já existir,
-- apenas documentar que tasks.due_date aceita formato YYYY-MM-DD.
