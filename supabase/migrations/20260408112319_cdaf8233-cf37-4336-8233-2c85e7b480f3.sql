
-- Drop all public policies on companies
DROP POLICY IF EXISTS "Public read companies" ON companies;
DROP POLICY IF EXISTS "Public insert companies" ON companies;
DROP POLICY IF EXISTS "Public update companies" ON companies;
DROP POLICY IF EXISTS "Public delete companies" ON companies;

-- Drop all public policies on leads
DROP POLICY IF EXISTS "Public read leads" ON leads;
DROP POLICY IF EXISTS "Public insert leads" ON leads;
DROP POLICY IF EXISTS "Public update leads" ON leads;
DROP POLICY IF EXISTS "Public delete leads" ON leads;

-- Create authenticated-only policies for companies
CREATE POLICY "Auth read companies" ON companies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert companies" ON companies FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update companies" ON companies FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth delete companies" ON companies FOR DELETE TO authenticated USING (true);

-- Create authenticated-only policies for leads
CREATE POLICY "Auth read leads" ON leads FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert leads" ON leads FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update leads" ON leads FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth delete leads" ON leads FOR DELETE TO authenticated USING (true);
