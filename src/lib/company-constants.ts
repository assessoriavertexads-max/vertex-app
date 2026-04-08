export type CompanyStatus = 'lead' | 'ativo' | 'inativo' | 'suspenso';

export const COMPANY_STATUS_LABELS: Record<CompanyStatus, string> = {
  lead: 'Lead',
  ativo: 'Ativo',
  inativo: 'Inativo',
  suspenso: 'Suspenso',
};

export const COMPANY_STATUS_COLORS: Record<CompanyStatus, string> = {
  lead: 'bg-blue-100 text-blue-800',
  ativo: 'bg-green-100 text-green-800',
  inativo: 'bg-gray-100 text-gray-800',
  suspenso: 'bg-red-100 text-red-800',
};
