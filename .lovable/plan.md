

## Plano: Conectar ao Supabase Externo (Vertex-ads)

### Contexto
O app atualmente aponta para o banco Lovable Cloud (`lbcgtbfizklsucblixkn`), mas o usuário quer usar seu projeto Supabase externo que já possui tabelas: `companies`, `company_assets`, `company_metrics`, `financial_transactions`, `leads`, `tasks`.

### Pré-requisito
O usuário precisa fornecer a **URL** e a **anon key** do projeto Supabase externo.

### Etapas

1. **Criar cliente Supabase externo** (`src/lib/supabase-external.ts`)
   - Instanciar `createClient` com as credenciais do projeto Vertex-ads
   - Usar as credenciais como constantes (são chaves públicas)

2. **Atualizar imports em todas as páginas**
   - `src/pages/Companies.tsx` — trocar import do client
   - `src/pages/CRM.tsx` — trocar import do client
   - `src/pages/Finance.tsx` — trocar import do client
   - `src/pages/Dashboard.tsx` — trocar import do client (se consulta DB)
   - `src/components/companies/NewCompanyModal.tsx` — trocar import
   - `src/components/crm/NewLeadModal.tsx` — trocar import
   - `src/components/finance/NewTransactionModal.tsx` — trocar import

3. **Atualizar tipos TypeScript**
   - Adaptar os tipos para refletir o schema do projeto externo (ex: coluna `asaas_customer_id` na tabela `companies`)
   - Pode ser necessário usar tipos manuais ou `any` temporariamente

4. **Testar conexão**
   - Verificar que dados do Supabase externo aparecem nas páginas

### Dependência
Aguardando as credenciais (URL + anon key) do usuário para prosseguir.

