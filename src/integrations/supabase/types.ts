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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      admin_logs: {
        Row: {
          action: string
          admin_user_id: string | null
          created_at: string
          details: Json
          id: string
          resource: string | null
        }
        Insert: {
          action: string
          admin_user_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          resource?: string | null
        }
        Update: {
          action?: string
          admin_user_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          resource?: string | null
        }
        Relationships: []
      }
      audience_contacts: {
        Row: {
          contact_count: number
          display_name: string | null
          eligibility: string
          first_found_at: string
          id: string
          last_campaign_id: string | null
          last_contacted_at: string | null
          source_group_id: string | null
          status: string
          telegram_user_id: number
          tenant_id: string
          username: string | null
        }
        Insert: {
          contact_count?: number
          display_name?: string | null
          eligibility?: string
          first_found_at?: string
          id?: string
          last_campaign_id?: string | null
          last_contacted_at?: string | null
          source_group_id?: string | null
          status?: string
          telegram_user_id: number
          tenant_id: string
          username?: string | null
        }
        Update: {
          contact_count?: number
          display_name?: string | null
          eligibility?: string
          first_found_at?: string
          id?: string
          last_campaign_id?: string | null
          last_contacted_at?: string | null
          source_group_id?: string | null
          status?: string
          telegram_user_id?: number
          tenant_id?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audience_contacts_source_group_id_fkey"
            columns: ["source_group_id"]
            isOneToOne: false
            referencedRelation: "discovered_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audience_contacts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_transactions: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          network: string
          paid_at: string | null
          plan_id: string | null
          status: string
          tenant_id: string
          tx_hash: string | null
          wallet_address: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          network?: string
          paid_at?: string | null
          plan_id?: string | null
          status?: string
          tenant_id: string
          tx_hash?: string | null
          wallet_address?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          network?: string
          paid_at?: string | null
          plan_id?: string | null
          status?: string
          tenant_id?: string
          tx_hash?: string | null
          wallet_address?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_transactions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_transactions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_states: {
        Row: {
          payload: Json
          state: string
          telegram_user_id: number
          updated_at: string
        }
        Insert: {
          payload?: Json
          state?: string
          telegram_user_id: number
          updated_at?: string
        }
        Update: {
          payload?: Json
          state?: string
          telegram_user_id?: number
          updated_at?: string
        }
        Relationships: []
      }
      campaign_groups: {
        Row: {
          campaign_id: string
          error: string | null
          group_id: string
          id: string
          sent_at: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          campaign_id: string
          error?: string | null
          group_id: string
          id?: string
          sent_at?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          campaign_id?: string
          error?: string | null
          group_id?: string
          id?: string
          sent_at?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_groups_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_groups_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "discovered_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_groups_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_jobs: {
        Row: {
          attempts: number
          campaign_id: string
          created_at: string
          id: string
          job_type: string
          last_error: string | null
          locked_at: string | null
          run_after: string
          status: string
          target_id: string
          tenant_id: string
        }
        Insert: {
          attempts?: number
          campaign_id: string
          created_at?: string
          id?: string
          job_type: string
          last_error?: string | null
          locked_at?: string | null
          run_after?: string
          status?: string
          target_id: string
          tenant_id: string
        }
        Update: {
          attempts?: number
          campaign_id?: string
          created_at?: string
          id?: string
          job_type?: string
          last_error?: string | null
          locked_at?: string | null
          run_after?: string
          status?: string
          target_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_jobs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_jobs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_logs: {
        Row: {
          campaign_id: string | null
          created_at: string
          details: Json
          id: string
          level: string
          message: string
          tenant_id: string
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          level?: string
          message: string
          tenant_id: string
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          level?: string
          message?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_logs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_recipients: {
        Row: {
          campaign_id: string
          contact_id: string | null
          error: string | null
          id: string
          sent_at: string | null
          status: string
          telegram_user_id: number
          tenant_id: string
        }
        Insert: {
          campaign_id: string
          contact_id?: string | null
          error?: string | null
          id?: string
          sent_at?: string | null
          status?: string
          telegram_user_id: number
          tenant_id: string
        }
        Update: {
          campaign_id?: string
          contact_id?: string | null
          error?: string | null
          id?: string
          sent_at?: string | null
          status?: string
          telegram_user_id?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_recipients_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "audience_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_recipients_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          completed_at: string | null
          completed_count: number
          connection_id: string | null
          created_at: string
          failed_count: number
          id: string
          message: Json
          name: string
          scheduled_at: string | null
          started_at: string | null
          status: string
          template_id: string | null
          tenant_id: string
          total_targets: number
          type: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          completed_count?: number
          connection_id?: string | null
          created_at?: string
          failed_count?: number
          id?: string
          message?: Json
          name: string
          scheduled_at?: string | null
          started_at?: string | null
          status?: string
          template_id?: string | null
          tenant_id: string
          total_targets?: number
          type?: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          completed_count?: number
          connection_id?: string | null
          created_at?: string
          failed_count?: number
          id?: string
          message?: Json
          name?: string
          scheduled_at?: string | null
          started_at?: string | null
          status?: string
          template_id?: string | null
          tenant_id?: string
          total_targets?: number
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "telegram_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "message_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_sessions: {
        Row: {
          created_at: string
          customer_id: string
          expires_at: string
          id: string
          tenant_id: string
          token_hash: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          expires_at: string
          id?: string
          tenant_id: string
          token_hash: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          expires_at?: string
          id?: string
          tenant_id?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_sessions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          created_at: string
          email: string
          email_verified: boolean
          id: string
          last_login_at: string | null
          name: string | null
          password_hash: string
          status: string
          telegram_user_id: number | null
          telegram_username: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          email_verified?: boolean
          id?: string
          last_login_at?: string | null
          name?: string | null
          password_hash: string
          status?: string
          telegram_user_id?: number | null
          telegram_username?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          email_verified?: boolean
          id?: string
          last_login_at?: string | null
          name?: string | null
          password_hash?: string
          status?: string
          telegram_user_id?: number | null
          telegram_username?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      discovered_groups: {
        Row: {
          access_hash: string | null
          approved_at: string | null
          can_send_messages: boolean | null
          connection_id: string | null
          discovered_at: string
          entity_type: string | null
          id: string
          join_error: string | null
          joined_at: string | null
          last_resolved_connection_id: string | null
          last_send_error: string | null
          last_send_test_connection_id: string | null
          last_write_error: string | null
          last_promoted_at: string | null
          matched_keywords: string[]
          member_count: number | null
          sendable_checked_at: string | null
          sendable_status: string
          status: string
          telegram_group_id: number | null
          tenant_id: string
          title: string
          username: string | null
          writable_checked_at: string | null
          writable_status: string | null
        }
        Insert: {
          access_hash?: string | null
          approved_at?: string | null
          can_send_messages?: boolean | null
          connection_id?: string | null
          discovered_at?: string
          entity_type?: string | null
          id?: string
          join_error?: string | null
          joined_at?: string | null
          last_resolved_connection_id?: string | null
          last_send_error?: string | null
          last_send_test_connection_id?: string | null
          last_write_error?: string | null
          last_promoted_at?: string | null
          matched_keywords?: string[]
          member_count?: number | null
          sendable_checked_at?: string | null
          sendable_status?: string
          status?: string
          telegram_group_id?: number | null
          tenant_id: string
          title: string
          username?: string | null
          writable_checked_at?: string | null
          writable_status?: string | null
        }
        Update: {
          access_hash?: string | null
          approved_at?: string | null
          can_send_messages?: boolean | null
          connection_id?: string | null
          discovered_at?: string
          entity_type?: string | null
          id?: string
          join_error?: string | null
          joined_at?: string | null
          last_resolved_connection_id?: string | null
          last_send_error?: string | null
          last_send_test_connection_id?: string | null
          last_write_error?: string | null
          last_promoted_at?: string | null
          matched_keywords?: string[]
          member_count?: number | null
          sendable_checked_at?: string | null
          sendable_status?: string
          status?: string
          telegram_group_id?: number | null
          tenant_id?: string
          title?: string
          username?: string | null
          writable_checked_at?: string | null
          writable_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "discovered_groups_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "telegram_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discovered_groups_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      group_category_members: {
        Row: {
          category_id: string
          created_at: string
          group_id: string
          id: string
          tenant_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          group_id: string
          id?: string
          tenant_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          group_id?: string
          id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_category_members_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "group_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_category_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "discovered_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_category_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      group_categories: {
        Row: {
          category_type: string
          created_at: string
          id: string
          name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          category_type?: string
          created_at?: string
          id?: string
          name: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          category_type?: string
          created_at?: string
          id?: string
          name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      group_memberships: {
        Row: {
          connection_id: string | null
          created_at: string
          error: string | null
          group_id: string
          id: string
          joined_at: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          connection_id?: string | null
          created_at?: string
          error?: string | null
          group_id: string
          id?: string
          joined_at?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          connection_id?: string | null
          created_at?: string
          error?: string | null
          group_id?: string
          id?: string
          joined_at?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_memberships_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "telegram_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_memberships_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "discovered_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_memberships_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      keywords: {
        Row: {
          created_at: string
          id: string
          keyword: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          keyword: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          keyword?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "keywords_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          body: string
          buttons: Json
          created_at: string
          id: string
          media_type: string | null
          media_url: string | null
          name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          body?: string
          buttons?: Json
          created_at?: string
          id?: string
          media_type?: string | null
          media_url?: string | null
          name: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          body?: string
          buttons?: Json
          created_at?: string
          id?: string
          media_type?: string | null
          media_url?: string | null
          name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          read_at: string | null
          tenant_id: string
          title: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          read_at?: string | null
          tenant_id: string
          title: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          read_at?: string | null
          tenant_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          code: string
          created_at: string
          duration_days: number
          id: string
          is_active: boolean
          max_audience: number
          max_campaigns: number
          max_connections: number
          max_groups: number
          monthly_message_limit: number
          name: string
          price_usd: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          duration_days?: number
          id?: string
          is_active?: boolean
          max_audience?: number
          max_campaigns?: number
          max_connections?: number
          max_groups?: number
          monthly_message_limit?: number
          name: string
          price_usd?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          duration_days?: number
          id?: string
          is_active?: boolean
          max_audience?: number
          max_campaigns?: number
          max_connections?: number
          max_groups?: number
          monthly_message_limit?: number
          name?: string
          price_usd?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          payment_status: string
          plan_id: string
          started_at: string
          status: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          payment_status?: string
          plan_id: string
          started_at?: string
          status?: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          payment_status?: string
          plan_id?: string
          started_at?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      system_logs: {
        Row: {
          action: string
          created_at: string
          customer_id: string | null
          details: Json
          id: string
          resource: string | null
          status: string
          tenant_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          customer_id?: string | null
          details?: Json
          id?: string
          resource?: string | null
          status?: string
          tenant_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          customer_id?: string | null
          details?: Json
          id?: string
          resource?: string | null
          status?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_logs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "system_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      telegram_connections: {
        Row: {
          account_name: string | null
          created_at: string
          error_message: string | null
          health: string | null
          health_score: number
          health_summary: string
          health_updated_at: string
          id: string
          label: string
          last_active_at: string | null
          last_used_at: string | null
          last_sync_at: string | null
          restriction_reason: string | null
          restriction_status: string | null
          status: string
          telegram_id: number | null
          telegram_user_id: number | null
          tenant_id: string
          updated_at: string
          username: string | null
        }
        Insert: {
          account_name?: string | null
          created_at?: string
          error_message?: string | null
          health?: string | null
          health_score?: number
          health_summary?: string
          health_updated_at?: string
          id?: string
          label: string
          last_active_at?: string | null
          last_used_at?: string | null
          last_sync_at?: string | null
          restriction_reason?: string | null
          restriction_status?: string | null
          status?: string
          telegram_id?: number | null
          telegram_user_id?: number | null
          tenant_id: string
          updated_at?: string
          username?: string | null
        }
        Update: {
          account_name?: string | null
          created_at?: string
          error_message?: string | null
          health?: string | null
          health_score?: number
          health_summary?: string
          health_updated_at?: string
          id?: string
          label?: string
          last_active_at?: string | null
          last_used_at?: string | null
          last_sync_at?: string | null
          restriction_reason?: string | null
          restriction_status?: string | null
          status?: string
          telegram_id?: number | null
          telegram_user_id?: number | null
          tenant_id?: string
          updated_at?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "telegram_connections_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      session_health_events: {
        Row: {
          connection_id: string | null
          created_at: string
          details: Json
          evidence_type: string
          id: string
          reason: string | null
          score_delta: number
          tenant_id: string
        }
        Insert: {
          connection_id?: string | null
          created_at?: string
          details?: Json
          evidence_type: string
          id?: string
          reason?: string | null
          score_delta?: number
          tenant_id: string
        }
        Update: {
          connection_id?: string | null
          created_at?: string
          details?: Json
          evidence_type?: string
          id?: string
          reason?: string | null
          score_delta?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_health_events_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "telegram_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_health_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_members: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_members_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          id: string
          messages_used: number
          name: string
          notes: string | null
          plan_expires_at: string | null
          plan_id: string | null
          status: string
          updated_at: string
          usage_period_start: string
        }
        Insert: {
          created_at?: string
          id?: string
          messages_used?: number
          name: string
          notes?: string | null
          plan_expires_at?: string | null
          plan_id?: string | null
          status?: string
          updated_at?: string
          usage_period_start?: string
        }
        Update: {
          created_at?: string
          id?: string
          messages_used?: number
          name?: string
          notes?: string | null
          plan_expires_at?: string | null
          plan_id?: string | null
          status?: string
          updated_at?: string
          usage_period_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenants_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
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
    }
    Enums: {
      app_role: "super_admin" | "customer" | "customer_user"
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
      app_role: ["super_admin", "customer", "customer_user"],
    },
  },
} as const
