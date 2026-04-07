-- Add auth_user_id to remaining tables and fix RLS policies

-- Add to spaces
ALTER TABLE spaces ADD COLUMN auth_user_id UUID DEFAULT auth.uid();
ALTER TABLE spaces ALTER COLUMN auth_user_id SET NOT NULL;
ALTER TABLE spaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own spaces"
ON spaces
FOR SELECT
USING (auth_user_id = auth.uid());

CREATE POLICY "Users can insert their own spaces"
ON spaces
FOR INSERT
WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY "Users can update their own spaces"
ON spaces
FOR UPDATE
USING (auth_user_id = auth.uid())
WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY "Users can delete their own spaces"
ON spaces
FOR DELETE
USING (auth_user_id = auth.uid());

-- Add to lists
ALTER TABLE lists ADD COLUMN auth_user_id UUID DEFAULT auth.uid();
ALTER TABLE lists ALTER COLUMN auth_user_id SET NOT NULL;
ALTER TABLE lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own lists"
ON lists
FOR SELECT
USING (auth_user_id = auth.uid());

CREATE POLICY "Users can insert their own lists"
ON lists
FOR INSERT
WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY "Users can update their own lists"
ON lists
FOR UPDATE
USING (auth_user_id = auth.uid())
WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY "Users can delete their own lists"
ON lists
FOR DELETE
USING (auth_user_id = auth.uid());

-- Add to tasks
ALTER TABLE tasks ADD COLUMN auth_user_id UUID DEFAULT auth.uid();
ALTER TABLE tasks ALTER COLUMN auth_user_id SET NOT NULL;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own tasks"
ON tasks
FOR SELECT
USING (auth_user_id = auth.uid());

CREATE POLICY "Users can insert their own tasks"
ON tasks
FOR INSERT
WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY "Users can update their own tasks"
ON tasks
FOR UPDATE
USING (auth_user_id = auth.uid())
WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY "Users can delete their own tasks"
ON tasks
FOR DELETE
USING (auth_user_id = auth.uid());

-- Fix leads policies (currently allows anyone)
DROP POLICY "Anyone can view leads" ON leads;
DROP POLICY "Anyone can insert leads" ON leads;
DROP POLICY "Anyone can update leads" ON leads;
DROP POLICY "Anyone can delete leads" ON leads;

-- Add auth_user_id to leads
ALTER TABLE leads ADD COLUMN auth_user_id UUID DEFAULT auth.uid();
ALTER TABLE leads ALTER COLUMN auth_user_id SET NOT NULL;

CREATE POLICY "Users can view their own leads"
ON leads
FOR SELECT
USING (auth_user_id = auth.uid());

CREATE POLICY "Users can insert their own leads"
ON leads
FOR INSERT
WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY "Users can update their own leads"
ON leads
FOR UPDATE
USING (auth_user_id = auth.uid())
WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY "Users can delete their own leads"
ON leads
FOR DELETE
USING (auth_user_id = auth.uid());