export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// Company Status Enum
export type CompanyStatus = 'ativo' | 'stand-by' | 'inativo' | 'cancelado'

export const COMPANY_STATUS_LABELS: Record<CompanyStatus, string> = {
  'ativo': 'Ativo',
  'stand-by': 'Stand-by',
  'inativo': 'Inativo',
  'cancelado': 'Cancelado'
}

export const COMPANY_STATUS_COLORS: Record<CompanyStatus, string> = {
  'ativo': 'bg-green-500/20 text-green-400',
  'stand-by': 'bg-blue-500/20 text-blue-400',
  'inativo': 'bg-gray-500/20 text-gray-400',
  'cancelado': 'bg-red-500/20 text-red-400'
}

export interface Database {
  public: {
    Tables: {
      companies: {
        Row: {
          id: string
          name: string
          document: string | null
          status: string | null
          asaas_customer_id: string | null
          custom_data: Json | null
          created_at: string
          auth_user_id: string
        }
        Insert: {
          id?: string
          name: string
          document?: string | null
          status?: string | null
          asaas_customer_id?: string | null
          custom_data?: Json | null
          created_at?: string
          auth_user_id?: string
        }
        Update: {
          id?: string
          name?: string
          document?: string | null
          status?: string | null
          asaas_customer_id?: string | null
          custom_data?: Json | null
          created_at?: string
          auth_user_id?: string
        }
      }
      leads: {
        Row: {
          id: string
          title: string
          company_id: string | null
          estimated_value: number | null
          funnel_stage: string | null
          legal_status: string | null
          created_at: string
          updated_at: string
          auth_user_id: string
        }
        Insert: {
          id?: string
          title: string
          company_id?: string | null
          estimated_value?: number | null
          funnel_stage?: string | null
          legal_status?: string | null
          created_at?: string
          updated_at?: string
          auth_user_id?: string
        }
        Update: {
          id?: string
          title?: string
          company_id?: string | null
          estimated_value?: number | null
          funnel_stage?: string | null
          legal_status?: string | null
          created_at?: string
          updated_at?: string
          auth_user_id?: string
        }
      }
      financial_transactions: {
        Row: {
          id: string
          company_id: string | null
          type: string
          amount: number
          due_date: string
          category: string | null
          status: string
          subscription_cycle: string | null
          created_at: string
          auth_user_id: string
        }
        Insert: {
          id?: string
          company_id?: string | null
          type: string
          amount: number
          due_date: string
          category?: string | null
          status: string
          subscription_cycle?: string | null
          created_at?: string
          auth_user_id?: string
        }
        Update: {
          id?: string
          company_id?: string | null
          type?: string
          amount?: number
          due_date?: string
          category?: string | null
          status?: string
          subscription_cycle?: string | null
          created_at?: string
          auth_user_id?: string
        }
      }
      tasks: {
        Row: {
          id: string
          list_id: string | null
          company_id: string | null
          name: string
          description: string | null
          status: string | null
          priority: string | null
          due_date: string | null
          created_at: string
          auth_user_id: string
        }
        Insert: {
          id?: string
          list_id?: string | null
          company_id?: string | null
          name: string
          description?: string | null
          status?: string | null
          priority?: string | null
          due_date?: string | null
          created_at?: string
          auth_user_id?: string
        }
        Update: {
          id?: string
          list_id?: string | null
          company_id?: string | null
          name?: string
          description?: string | null
          status?: string | null
          priority?: string | null
          due_date?: string | null
          created_at?: string
          auth_user_id?: string
        }
      }
      lists: {
        Row: {
          id: string
          space_id: string | null
          name: string
          created_at: string
          auth_user_id: string
        }
        Insert: {
          id?: string
          space_id?: string | null
          name: string
          created_at?: string
          auth_user_id?: string
        }
        Update: {
          id?: string
          space_id?: string | null
          name?: string
          created_at?: string
          auth_user_id?: string
        }
      }
      spaces: {
        Row: {
          id: string
          name: string
          icon: string | null
          created_at: string
          auth_user_id: string
        }
        Insert: {
          id?: string
          name: string
          icon?: string | null
          created_at?: string
          auth_user_id?: string
        }
        Update: {
          id?: string
          name?: string
          icon?: string | null
          created_at?: string
          auth_user_id?: string
        }
      }
      company_assets: {
        Row: {
          id: string
          company_id: string | null
          name: string
          type: string | null
          value: number | null
          status: string | null
          created_at: string
          auth_user_id: string
        }
        Insert: {
          id?: string
          company_id?: string | null
          name: string
          type?: string | null
          value?: number | null
          status?: string | null
          created_at?: string
          auth_user_id?: string
        }
        Update: {
          id?: string
          company_id?: string | null
          name?: string
          type?: string | null
          value?: number | null
          status?: string | null
          created_at?: string
          auth_user_id?: string
        }
      }
      company_metrics: {
        Row: {
          id: string
          company_id: string | null
          metric_date: string
          ad_spend: number | null
          revenue_generated: number | null
          leads_generated: number | null
          ai_recommendation: string | null
          created_at: string
          auth_user_id: string
        }
        Insert: {
          id?: string
          company_id?: string | null
          metric_date: string
          ad_spend?: number | null
          revenue_generated?: number | null
          leads_generated?: number | null
          ai_recommendation?: string | null
          created_at?: string
          auth_user_id?: string
        }
        Update: {
          id?: string
          company_id?: string | null
          metric_date?: string
          ad_spend?: number | null
          revenue_generated?: number | null
          leads_generated?: number | null
          ai_recommendation?: string | null
          created_at?: string
          auth_user_id?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, keyof Database>]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema['Tables'] & PublicSchema['Views'])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions['schema']]['Tables'] &
        Database[PublicTableNameOrOptions['schema']]['Views'])
    : never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions['schema']]['Tables'] &
      Database[PublicTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema['Tables'] &
      PublicSchema['Views'])
  ? (PublicSchema['Tables'] &
      PublicSchema['Views'])[PublicTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema['Tables']
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions['schema']]['Tables']
    : never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema['Tables']
  ? PublicSchema['Tables'][PublicTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema['Tables']
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions['schema']]['Tables']
    : never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema['Tables']
  ? PublicSchema['Tables'][PublicTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema['Enums']
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions['schema']]['Enums']
    : never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions['schema']]['Enums'][EnumName]
  : PublicTableNameOrOptions extends keyof PublicSchema['Enums']
  ? PublicSchema['Enums'][PublicTableNameOrOptions]
  : never
