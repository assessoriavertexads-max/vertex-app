-- Create contracts table for PROCESSOS E DOCUMENTOS > CONTRATOS ARQUIVADOS
CREATE TABLE IF NOT EXISTS public.contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  file_url TEXT,
  notes TEXT,
  signed_at TIMESTAMP WITH TIME ZONE,
  expires_at DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view contracts"
  ON public.contracts FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert contracts"
  ON public.contracts FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update contracts"
  ON public.contracts FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete contracts"
  ON public.contracts FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_contracts_updated_at
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
