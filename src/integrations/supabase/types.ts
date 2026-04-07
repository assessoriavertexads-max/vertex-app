export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
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
        }
        Insert: {
          id?: string
          name: string
          document?: string | null
          status?: string | null
          asaas_customer_id?: string | null
          custom_data?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          document?: string | null
          status?: string | null
          asaas_customer_id?: string | null
          custom_data?: Json | null
          created_at?: string
        }
        Relationships: []
      }
      company_assets: {
        Row: {
          id: string
          name: string
          type: string | null
          value: number | null
          status: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          type?: string | null
          value?: number | null
          status?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          type?: string | null
          value?: number | null
          status?: string | null
          created_at?: string
        }
        Relationships: []
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
        }
        Relationships: [
          {
            foreignKeyName: "company_metrics_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_transactions: {
        Row: {
          id: string
          company_id: string | null
          type: string
          amount: number
          status: string | null
          due_date: string
          asaas_payment_id: string | null
          asaas_payment_url: string | null
          asaas_subscription_id: string | null
          subscription_cycle: string | null
          category: string | null
          created_at: string
        }
        Insert: {
          id?: string
          company_id?: string | null
          type: string
          amount: number
          status?: string | null
          due_date: string
          asaas_payment_id?: string | null
          asaas_payment_url?: string | null
          asaas_subscription_id?: string | null
          subscription_cycle?: string | null
          category?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          company_id?: string | null
          type?: string
          amount?: number
          status?: string | null
          due_date?: string
          asaas_payment_id?: string | null
          asaas_payment_url?: string | null
          asaas_subscription_id?: string | null
          subscription_cycle?: string | null
          category?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          id: string
          company_id: string | null
          title: string
          funnel_stage: string | null
          estimated_value: number | null
          legal_status: string | null
          created_at: string
        }
        Insert: {
          id?: string
          company_id?: string | null
          title: string
          funnel_stage?: string | null
          estimated_value?: number | null
          legal_status?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          company_id?: string | null
          title?: string
          funnel_stage?: string | null
          estimated_value?: number | null
          legal_status?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          id: string
          company_id: string | null
          title: string
          description: string | null
          status: string | null
          assigned_to: string | null
          due_date: string | null
          created_at: string
        }
        Insert: {
          id?: string
          company_id?: string | null
          title: string
          description?: string | null
          status?: string | null
          assigned_to?: string | null
          due_date?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          company_id?: string | null
          title?: string
          description?: string | null
          status?: string | null
          assigned_to?: string | null
          due_date?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
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

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
