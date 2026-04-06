
-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can view companies" ON public.companies;
DROP POLICY IF EXISTS "Anyone can insert companies" ON public.companies;
DROP POLICY IF EXISTS "Anyone can update companies" ON public.companies;
DROP POLICY IF EXISTS "Anyone can delete companies" ON public.companies;
DROP POLICY IF EXISTS "Anyone can view leads" ON public.leads;
DROP POLICY IF EXISTS "Anyone can insert leads" ON public.leads;
DROP POLICY IF EXISTS "Anyone can update leads" ON public.leads;
DROP POLICY IF EXISTS "Anyone can delete leads" ON public.leads;

-- Recreate with public access (anon + authenticated)
CREATE POLICY "Public read companies" ON public.companies FOR SELECT USING (true);
CREATE POLICY "Public insert companies" ON public.companies FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update companies" ON public.companies FOR UPDATE USING (true);
CREATE POLICY "Public delete companies" ON public.companies FOR DELETE USING (true);

CREATE POLICY "Public read leads" ON public.leads FOR SELECT USING (true);
CREATE POLICY "Public insert leads" ON public.leads FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update leads" ON public.leads FOR UPDATE USING (true);
CREATE POLICY "Public delete leads" ON public.leads FOR DELETE USING (true);
