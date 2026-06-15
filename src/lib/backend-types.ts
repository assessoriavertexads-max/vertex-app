export interface CompanyOption {
  id: string;
  name: string;
  asaas_customer_id?: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface LeadInsert {
  title: string;
  company_id?: string | null;
  estimated_value?: number | null;
  funnel_stage?: string | null;
  legal_status?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
}

export interface LeadWithCompany {
  id: string;
  title: string;
  company_id: string | null;
  estimated_value?: number | null;
  funnel_stage?: string | null;
  legal_status?: string | null;
  status?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  scheduled_at?: string | null;
  source?: string | null;
  loss_reason?: string | null;
  won_at?: string | null;
  lost_at?: string | null;
  created_at?: string;
  updated_at?: string;
  companies?: { name: string } | null;
}

export type TaskStatus = 'a_receber' | 'em_progresso' | 'concluido' | string;
export type TaskPriority = 'alta' | 'media' | 'baixa' | 'normal' | string;
export type RecurrenceFrequency = 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | string;

export interface TaskRecurrence {
  frequency: RecurrenceFrequency;
  occurrences: number;
}

export interface TaskItem {
  id: string;
  name: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  company_id?: string | null;
  list_id?: string | null;
  recurrence?: TaskRecurrence | null;
  companies?: { name: string } | null;
}

export interface TaskInsert {
  name: string;
  description?: string;
  priority: TaskPriority;
  due_date?: string | null;
  company_id?: string | null;
  list_id?: string | null;
  status?: TaskStatus;
  recurrence?: TaskRecurrence | null;
}

export type TaskCreateInput = Omit<TaskInsert, 'list_id' | 'status'>;

export interface TaskUpdate {
  name?: string;
  description?: string | null;
  priority?: TaskPriority;
  due_date?: string | null;
  company_id?: string | null;
  list_id?: string | null;
  status?: TaskStatus;
  recurrence?: TaskRecurrence | null;
}

export interface TransactionInsert {
  company_id?: string | null;
  type: 'income' | 'expense';
  amount: number;
  due_date: string;
  category?: string | null;
  status: string;
  subscription_cycle: string | null;
  billing_type?: string;
}

export interface TransactionWithCompany {
  id: string;
  company_id: string | null;
  type: 'income' | 'expense' | string;
  amount: number;
  due_date: string;
  category: string | null;
  status: string;
  subscription_cycle: string | null;
  asaas_payment_url?: string | null;
  asaas_subscription_id?: string | null;
  asaas_payment_id?: string | null;
  billing_type?: string | null;
  companies?: { name: string; phone?: string | null } | null;
}