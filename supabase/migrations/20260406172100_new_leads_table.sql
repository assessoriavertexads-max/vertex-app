-- Drop existing leads table if it exists
DROP TABLE IF EXISTS leads;

-- Insert some companies if not exist
INSERT INTO companies (name, document, status) VALUES 
('TechCorp Solutions', '12.345.678/0001-90', 'active'),
('Padaria do João', '98.765.432/0001-10', 'lead')
ON CONFLICT DO NOTHING;

CREATE TABLE leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  value NUMERIC(10, 2) DEFAULT 0,
  status TEXT DEFAULT 'prospect',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can view leads" ON leads FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anyone can insert leads" ON leads FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Anyone can update leads" ON leads FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Anyone can delete leads" ON leads FOR DELETE TO authenticated USING (true);

-- Update trigger
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Inserir alguns dados de teste
INSERT INTO leads (title, company_id, value, status) VALUES 
('Campanha Tráfego Pago', (SELECT id FROM companies WHERE name = 'TechCorp Solutions' LIMIT 1), 5000, 'prospect'),
('Assessoria Completa', (SELECT id FROM companies WHERE name = 'Padaria do João' LIMIT 1), 1500, 'negotiation');