export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      bot_features: {
        Row: {
          config: Json
          enabled: boolean
          feature_key: Database["public"]["Enums"]["bot_feature_key"]
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          config?: Json
          enabled?: boolean
          feature_key: Database["public"]["Enums"]["bot_feature_key"]
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          config?: Json
          enabled?: boolean
          feature_key?: Database["public"]["Enums"]["bot_feature_key"]
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          budget_range: string | null
          channel: Database["public"]["Enums"]["integration_provider"]
          created_at: string
          customer_avatar: string | null
          customer_intent: string | null
          customer_name: string
          external_id: string | null
          id: string
          interested_categories: string[] | null
          last_message: string | null
          last_message_at: string
          lead_score: number
          lead_tag: Database["public"]["Enums"]["lead_tag"] | null
          preferred_language: string | null
          status: Database["public"]["Enums"]["conversation_status"]
          summary: string | null
          unread_count: number
          user_id: string
        }
        Insert: {
          budget_range?: string | null
          channel: Database["public"]["Enums"]["integration_provider"]
          created_at?: string
          customer_avatar?: string | null
          customer_intent?: string | null
          customer_name: string
          external_id?: string | null
          id?: string
          interested_categories?: string[] | null
          last_message?: string | null
          last_message_at?: string
          lead_score?: number
          lead_tag?: Database["public"]["Enums"]["lead_tag"] | null
          preferred_language?: string | null
          status?: Database["public"]["Enums"]["conversation_status"]
          summary?: string | null
          unread_count?: number
          user_id: string
        }
        Update: {
          budget_range?: string | null
          channel?: Database["public"]["Enums"]["integration_provider"]
          created_at?: string
          customer_avatar?: string | null
          customer_intent?: string | null
          customer_name?: string
          external_id?: string | null
          id?: string
          interested_categories?: string[] | null
          last_message?: string | null
          last_message_at?: string
          lead_score?: number
          lead_tag?: Database["public"]["Enums"]["lead_tag"] | null
          preferred_language?: string | null
          status?: Database["public"]["Enums"]["conversation_status"]
          summary?: string | null
          unread_count?: number
          user_id?: string
        }
        Relationships: []
      }
      daily_metrics: {
        Row: {
          ai_revenue: number
          avg_response_seconds: number
          chats_count: number
          conversion_rate: number
          created_at: string
          csat: number
          id: string
          metric_date: string
          new_customers: number
          orders_count: number
          returning_customers: number
          revenue: number
          user_id: string
        }
        Insert: {
          ai_revenue?: number
          avg_response_seconds?: number
          chats_count?: number
          conversion_rate?: number
          created_at?: string
          csat?: number
          id?: string
          metric_date: string
          new_customers?: number
          orders_count?: number
          returning_customers?: number
          revenue?: number
          user_id: string
        }
        Update: {
          ai_revenue?: number
          avg_response_seconds?: number
          chats_count?: number
          conversion_rate?: number
          created_at?: string
          csat?: number
          id?: string
          metric_date?: string
          new_customers?: number
          orders_count?: number
          returning_customers?: number
          revenue?: number
          user_id?: string
        }
        Relationships: []
      }
      integrations: {
        Row: {
          config: Json
          connected_at: string | null
          created_at: string
          id: string
          provider: Database["public"]["Enums"]["integration_provider"]
          reply_mode: string
          status: Database["public"]["Enums"]["integration_status"]
          store_name: string | null
          user_id: string
        }
        Insert: {
          config?: Json
          connected_at?: string | null
          created_at?: string
          id?: string
          provider: Database["public"]["Enums"]["integration_provider"]
          reply_mode?: string
          status?: Database["public"]["Enums"]["integration_status"]
          store_name?: string | null
          user_id: string
        }
        Update: {
          config?: Json
          connected_at?: string | null
          created_at?: string
          id?: string
          provider?: Database["public"]["Enums"]["integration_provider"]
          reply_mode?: string
          status?: Database["public"]["Enums"]["integration_status"]
          store_name?: string | null
          user_id?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          amount: number
          created_at: string
          id: string
          invoice_number: string
          pdf_url: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          invoice_number: string
          pdf_url?: string | null
          status?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          invoice_number?: string
          pdf_url?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          sender: string
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          sender: string
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          sender?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          link: string | null
          message: string | null
          metadata: Json
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string | null
          metadata?: Json
          read?: boolean
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string | null
          metadata?: Json
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          amount: number
          channel: Database["public"]["Enums"]["integration_provider"] | null
          closed_by_ai: boolean
          conversation_id: string | null
          created_at: string
          customer_name: string
          customer_phone: string | null
          fulfillment_status: string
          id: string
          notes: string | null
          order_number: string
          payment_method: string
          payment_status: string
          product_name: string
          quantity: number
          shipped_at: string | null
          shipping_address: string | null
          status: string
          status_updated_at: string
          tracking_number: string | null
          tracking_url: string | null
          user_id: string
        }
        Insert: {
          amount: number
          channel?: Database["public"]["Enums"]["integration_provider"] | null
          closed_by_ai?: boolean
          conversation_id?: string | null
          created_at?: string
          customer_name: string
          customer_phone?: string | null
          fulfillment_status?: string
          id?: string
          notes?: string | null
          order_number: string
          payment_method?: string
          payment_status?: string
          product_name: string
          quantity?: number
          shipped_at?: string | null
          shipping_address?: string | null
          status?: string
          status_updated_at?: string
          tracking_number?: string | null
          tracking_url?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          channel?: Database["public"]["Enums"]["integration_provider"] | null
          closed_by_ai?: boolean
          conversation_id?: string | null
          created_at?: string
          customer_name?: string
          customer_phone?: string | null
          fulfillment_status?: string
          id?: string
          notes?: string | null
          order_number?: string
          payment_method?: string
          payment_status?: string
          product_name?: string
          quantity?: number
          shipped_at?: string | null
          shipping_address?: string | null
          status?: string
          status_updated_at?: string
          tracking_number?: string | null
          tracking_url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          currency: string
          features: Json
          highlight: boolean
          is_active: boolean
          key: string
          name: string
          price_monthly: number
          price_yearly: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          currency?: string
          features?: Json
          highlight?: boolean
          is_active?: boolean
          key: string
          name: string
          price_monthly?: number
          price_yearly?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          currency?: string
          features?: Json
          highlight?: boolean
          is_active?: boolean
          key?: string
          name?: string
          price_monthly?: number
          price_yearly?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      platform_features: {
        Row: {
          enabled: boolean
          feature_key: string
          label: string
          required_plan: string
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          feature_key: string
          label?: string
          required_plan?: string
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          feature_key?: string
          label?: string
          required_plan?: string
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          category: string | null
          compare_at_price: number | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          low_stock_threshold: number
          name: string
          price: number
          sku: string | null
          status: string
          stock: number
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          compare_at_price?: number | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          low_stock_threshold?: number
          name: string
          price?: number
          sku?: string | null
          status?: string
          stock?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          compare_at_price?: number | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          low_stock_threshold?: number
          name?: string
          price?: number
          sku?: string | null
          status?: string
          stock?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bot_enabled: boolean
          company_name: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          locale: string
          suspended: boolean
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bot_enabled?: boolean
          company_name?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          locale?: string
          suspended?: boolean
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bot_enabled?: boolean
          company_name?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          locale?: string
          suspended?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          amount: number
          created_at: string
          current_period_end: string
          current_period_start: string
          id: string
          plan: Database["public"]["Enums"]["subscription_plan"]
          status: Database["public"]["Enums"]["subscription_status"]
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          id?: string
          plan?: Database["public"]["Enums"]["subscription_plan"]
          status?: Database["public"]["Enums"]["subscription_status"]
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          id?: string
          plan?: Database["public"]["Enums"]["subscription_plan"]
          status?: Database["public"]["Enums"]["subscription_status"]
          user_id?: string
        }
        Relationships: []
      }
      training_documents: {
        Row: {
          content: string | null
          created_at: string
          doc_type: string
          id: string
          status: string
          title: string
          url: string | null
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          doc_type: string
          id?: string
          status?: string
          title: string
          url?: string | null
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          doc_type?: string
          id?: string
          status?: string
          title?: string
          url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      seed_demo_data_for: { Args: { uid: string }; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "customer"
      bot_feature_key:
        | "sales_search"
        | "sales_recommend"
        | "sales_crosssell"
        | "sales_bundle"
        | "sales_dynamic_pricing"
        | "cs_chat_24_7"
        | "cs_order_check"
        | "cs_tracking"
        | "cs_faq"
        | "cs_multilang"
        | "ops_stock"
        | "ops_process_order"
        | "ops_warranty"
        | "ops_reorder"
        | "ops_fraud"
        | "mkt_segment"
        | "mkt_promo"
        | "mkt_cart_recovery"
        | "mkt_churn"
        | "mkt_ads_audience"
      conversation_status: "active" | "resolved" | "human_takeover"
      integration_provider:
        | "shopify"
        | "woocommerce"
        | "lazada"
        | "shopee"
        | "line_oa"
        | "messenger"
        | "instagram"
        | "web_widget"
      integration_status: "connected" | "disconnected" | "error"
      lead_tag: "hot" | "warm" | "cold"
      subscription_plan: "free" | "starter" | "growth" | "enterprise"
      subscription_status: "active" | "past_due" | "canceled" | "trialing"
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
    Enums: {
      app_role: ["admin", "customer"],
      bot_feature_key: [
        "sales_search",
        "sales_recommend",
        "sales_crosssell",
        "sales_bundle",
        "sales_dynamic_pricing",
        "cs_chat_24_7",
        "cs_order_check",
        "cs_tracking",
        "cs_faq",
        "cs_multilang",
        "ops_stock",
        "ops_process_order",
        "ops_warranty",
        "ops_reorder",
        "ops_fraud",
        "mkt_segment",
        "mkt_promo",
        "mkt_cart_recovery",
        "mkt_churn",
        "mkt_ads_audience",
      ],
      conversation_status: ["active", "resolved", "human_takeover"],
      integration_provider: [
        "shopify",
        "woocommerce",
        "lazada",
        "shopee",
        "line_oa",
        "messenger",
        "instagram",
        "web_widget",
      ],
      integration_status: ["connected", "disconnected", "error"],
      lead_tag: ["hot", "warm", "cold"],
      subscription_plan: ["free", "starter", "growth", "enterprise"],
      subscription_status: ["active", "past_due", "canceled", "trialing"],
    },
  },
} as const
