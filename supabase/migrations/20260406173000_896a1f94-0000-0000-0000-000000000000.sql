CREATE TABLE financial_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  status TEXT DEFAULT 'pending',
  due_date DATE NOT NULL,
  category TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Inserir dados de teste (vai pegar a primeira empresa que você cadastrou)
INSERT INTO financial_transactions (company_id, type, amount, status, due_date, category)
VALUES 
((SELECT id FROM companies LIMIT 1), 'income', 5000, 'paid', '2026-05-10', 'Assessoria Mensal'),
((SELECT id FROM companies LIMIT 1), 'expense', 850, 'paid', '2026-05-05', 'Ferramentas');