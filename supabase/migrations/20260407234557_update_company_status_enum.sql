-- Update companies table to use new status enum: ativo, stand-by, inativo, cancelado

-- Add auth_user_id column if it doesn't exist (for proper RLS)
ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Update existing lead status values to ativo (default transition)
UPDATE public.companies 
SET status = 'ativo' 
WHERE status = 'lead';

-- Update churn to cancelado
UPDATE public.companies 
SET status = 'cancelado' 
WHERE status = 'churn';

-- Update any "active" to "ativo"
UPDATE public.companies 
SET status = 'ativo' 
WHERE status = 'active';

-- Change default status from 'lead' to 'ativo'
ALTER TABLE public.companies 
ALTER COLUMN status SET DEFAULT 'ativo';

-- Add CHECK constraint for valid status values
ALTER TABLE public.companies
ADD CONSTRAINT valid_company_status 
CHECK (status IN ('ativo', 'stand-by', 'inativo', 'cancelado'));

-- Create an index on status for faster queries
CREATE INDEX IF NOT EXISTS idx_companies_status ON public.companies(status);
CREATE INDEX IF NOT EXISTS idx_companies_auth_user_id ON public.companies(auth_user_id);
