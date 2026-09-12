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
      account_deletions: {
        Row: {
          deleted_at: string
          id: number
          user_code: string | null
          user_email: string | null
        }
        Insert: {
          deleted_at?: string
          id?: never
          user_code?: string | null
          user_email?: string | null
        }
        Update: {
          deleted_at?: string
          id?: never
          user_code?: string | null
          user_email?: string | null
        }
        Relationships: []
      }
      admin_announcements: {
        Row: {
          action_label: string | null
          action_url: string | null
          admin_user_id: string
          body: string
          created_at: string
          delivery_type: string
          id: string
          published_at: string | null
          sent_count: number
          target_audience: string
          target_type: string
          target_user_id: string | null
          title: string
        }
        Insert: {
          action_label?: string | null
          action_url?: string | null
          admin_user_id: string
          body: string
          created_at?: string
          delivery_type?: string
          id?: string
          published_at?: string | null
          sent_count?: number
          target_audience?: string
          target_type?: string
          target_user_id?: string | null
          title: string
        }
        Update: {
          action_label?: string | null
          action_url?: string | null
          admin_user_id?: string
          body?: string
          created_at?: string
          delivery_type?: string
          id?: string
          published_at?: string | null
          sent_count?: number
          target_audience?: string
          target_type?: string
          target_user_id?: string | null
          title?: string
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          count: number
          date: string
          event_name: string
          id: string
        }
        Insert: {
          count?: number
          date?: string
          event_name: string
          id?: string
        }
        Update: {
          count?: number
          date?: string
          event_name?: string
          id?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          device_trust_enabled: boolean
          id: number
          otp_threshold_days: number
          updated_at: string
        }
        Insert: {
          device_trust_enabled?: boolean
          id?: number
          otp_threshold_days?: number
          updated_at?: string
        }
        Update: {
          device_trust_enabled?: boolean
          id?: number
          otp_threshold_days?: number
          updated_at?: string
        }
        Relationships: []
      }
      calendar_connections: {
        Row: {
          access_token: string | null
          created_at: string
          expires_at: string | null
          id: string
          last_synced_at: string | null
          provider: string
          provider_email: string | null
          refresh_token: string | null
          status: string
          sync_token: string | null
          user_id: string
        }
        Insert: {
          access_token?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          last_synced_at?: string | null
          provider: string
          provider_email?: string | null
          refresh_token?: string | null
          status?: string
          sync_token?: string | null
          user_id: string
        }
        Update: {
          access_token?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          last_synced_at?: string | null
          provider?: string
          provider_email?: string | null
          refresh_token?: string | null
          status?: string
          sync_token?: string | null
          user_id?: string
        }
        Relationships: []
      }
      calendar_events_cache: {
        Row: {
          all_day: boolean
          calendar_name: string | null
          color: string | null
          connection_id: string
          description: string | null
          end_at: string | null
          external_id: string
          id: string
          location: string | null
          provider: string
          raw_data: Json | null
          start_at: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          all_day?: boolean
          calendar_name?: string | null
          color?: string | null
          connection_id: string
          description?: string | null
          end_at?: string | null
          external_id: string
          id?: string
          location?: string | null
          provider: string
          raw_data?: Json | null
          start_at: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          all_day?: boolean
          calendar_name?: string | null
          color?: string | null
          connection_id?: string
          description?: string | null
          end_at?: string | null
          external_id?: string
          id?: string
          location?: string | null
          provider?: string
          raw_data?: Json | null
          start_at?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_cache_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "calendar_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          active: boolean
          address_text: string | null
          created_at: string
          display_name: string
          email: string | null
          id: string
          legal_name: string | null
          name: string
          notes: string | null
          phone: string | null
          tax_code: string | null
          updated_at: string
          user_id: string
          vat_number: string | null
        }
        Insert: {
          active?: boolean
          address_text?: string | null
          created_at?: string
          display_name: string
          email?: string | null
          id?: string
          legal_name?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          tax_code?: string | null
          updated_at?: string
          user_id: string
          vat_number?: string | null
        }
        Update: {
          active?: boolean
          address_text?: string | null
          created_at?: string
          display_name?: string
          email?: string | null
          id?: string
          legal_name?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          tax_code?: string | null
          updated_at?: string
          user_id?: string
          vat_number?: string | null
        }
        Relationships: []
      }
      contribution_action_config: {
        Row: {
          action_type: string
          color_bg: string
          color_text: string
          display_order: number
          frequency_label: string
          id: string
          is_active: boolean
          label: string
          points: number
          updated_at: string
        }
        Insert: {
          action_type: string
          color_bg?: string
          color_text?: string
          display_order?: number
          frequency_label?: string
          id?: string
          is_active?: boolean
          label: string
          points: number
          updated_at?: string
        }
        Update: {
          action_type?: string
          color_bg?: string
          color_text?: string
          display_order?: number
          frequency_label?: string
          id?: string
          is_active?: boolean
          label?: string
          points?: number
          updated_at?: string
        }
        Relationships: []
      }
      contribution_milestones: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          level: number
          name: string
          points_required: number
          reward_label: string
          reward_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          level: number
          name: string
          points_required: number
          reward_label: string
          reward_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          level?: number
          name?: string
          points_required?: number
          reward_label?: string
          reward_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      contribution_rewards: {
        Row: {
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          id: string
          notes: string | null
          period: string | null
          reward_type: string
          user_id: string
        }
        Insert: {
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          period?: string | null
          reward_type: string
          user_id: string
        }
        Update: {
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          period?: string | null
          reward_type?: string
          user_id?: string
        }
        Relationships: []
      }
      deadline_email_sent: {
        Row: {
          id: string
          resend_message_id: string | null
          sent_at: string
          tax_schedule_id: string
          threshold: number
          user_id: string
        }
        Insert: {
          id?: string
          resend_message_id?: string | null
          sent_at?: string
          tax_schedule_id: string
          threshold: number
          user_id: string
        }
        Update: {
          id?: string
          resend_message_id?: string | null
          sent_at?: string
          tax_schedule_id?: string
          threshold?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deadline_email_sent_tax_schedule_id_fkey"
            columns: ["tax_schedule_id"]
            isOneToOne: false
            referencedRelation: "tax_schedule"
            referencedColumns: ["id"]
          },
        ]
      }
      deadline_feedback: {
        Row: {
          created_at: string
          free_text: string | null
          id: string
          reason: string | null
          response: string
          schedule_event_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          free_text?: string | null
          id?: string
          reason?: string | null
          response: string
          schedule_event_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          free_text?: string | null
          id?: string
          reason?: string | null
          response?: string
          schedule_event_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deadline_feedback_schedule_event_id_fkey"
            columns: ["schedule_event_id"]
            isOneToOne: false
            referencedRelation: "tax_schedule"
            referencedColumns: ["id"]
          },
        ]
      }
      email_events: {
        Row: {
          bounce_type: string | null
          clicked_url: string | null
          created_at: string
          event_type: string
          id: string
          occurred_at: string
          raw_payload: Json
          recipient_email: string | null
          resend_message_id: string | null
          svix_id: string
          user_id: string | null
        }
        Insert: {
          bounce_type?: string | null
          clicked_url?: string | null
          created_at?: string
          event_type: string
          id?: string
          occurred_at?: string
          raw_payload: Json
          recipient_email?: string | null
          resend_message_id?: string | null
          svix_id: string
          user_id?: string | null
        }
        Update: {
          bounce_type?: string | null
          clicked_url?: string | null
          created_at?: string
          event_type?: string
          id?: string
          occurred_at?: string
          raw_payload?: Json
          recipient_email?: string | null
          resend_message_id?: string | null
          svix_id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      email_log: {
        Row: {
          batch_id: string | null
          error_message: string | null
          id: string
          recipient_email: string
          resend_message_id: string | null
          sent_at: string
          sent_by: string
          status: string
          subject: string
        }
        Insert: {
          batch_id?: string | null
          error_message?: string | null
          id?: string
          recipient_email: string
          resend_message_id?: string | null
          sent_at?: string
          sent_by: string
          status: string
          subject: string
        }
        Update: {
          batch_id?: string | null
          error_message?: string | null
          id?: string
          recipient_email?: string
          resend_message_id?: string | null
          sent_at?: string
          sent_by?: string
          status?: string
          subject?: string
        }
        Relationships: []
      }
      event_logs: {
        Row: {
          created_at: string
          event_name: string
          id: string
          props: Json | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event_name: string
          id?: string
          props?: Json | null
          user_id: string
        }
        Update: {
          created_at?: string
          event_name?: string
          id?: string
          props?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      fiscal_rules: {
        Row: {
          aliquota_sostitutiva_15: number
          aliquota_sostitutiva_5: number
          created_at: string
          fiscal_year: number
          id: string
          inps_rate_artigiani: number
          inps_rate_artigiani_alta: number
          inps_rate_commercianti: number
          inps_rate_commercianti_alta: number
          inps_rate_separata: number
          massimale_artigiani: number
          massimale_commercianti: number
          massimale_separata: number
          maternita_annuale: number
          minimale_artigiani: number
          minimale_commercianti: number
          reddito_minimale: number
          soglia_forfettario: number
          soglia_reddito_prima_fascia: number
          source_url_artigiani_commercianti: string | null
          source_url_separata: string | null
          updated_at: string
        }
        Insert: {
          aliquota_sostitutiva_15?: number
          aliquota_sostitutiva_5?: number
          created_at?: string
          fiscal_year: number
          id?: string
          inps_rate_artigiani?: number
          inps_rate_artigiani_alta?: number
          inps_rate_commercianti?: number
          inps_rate_commercianti_alta?: number
          inps_rate_separata?: number
          massimale_artigiani?: number
          massimale_commercianti?: number
          massimale_separata?: number
          maternita_annuale?: number
          minimale_artigiani?: number
          minimale_commercianti?: number
          reddito_minimale?: number
          soglia_forfettario?: number
          soglia_reddito_prima_fascia?: number
          source_url_artigiani_commercianti?: string | null
          source_url_separata?: string | null
          updated_at?: string
        }
        Update: {
          aliquota_sostitutiva_15?: number
          aliquota_sostitutiva_5?: number
          created_at?: string
          fiscal_year?: number
          id?: string
          inps_rate_artigiani?: number
          inps_rate_artigiani_alta?: number
          inps_rate_commercianti?: number
          inps_rate_commercianti_alta?: number
          inps_rate_separata?: number
          massimale_artigiani?: number
          massimale_commercianti?: number
          massimale_separata?: number
          maternita_annuale?: number
          minimale_artigiani?: number
          minimale_commercianti?: number
          reddito_minimale?: number
          soglia_forfettario?: number
          soglia_reddito_prima_fascia?: number
          source_url_artigiani_commercianti?: string | null
          source_url_separata?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      fiscal_year_settings: {
        Row: {
          acconti_imposta_versati: number
          acconti_inps_eccedenza_versati: number
          anno_apertura_piva: number | null
          ateco_code: string | null
          banner_fallback_commercialista_dismissed: boolean
          banner_rate_scadute_dismissed: boolean
          buffer_base: string
          created_at: string
          deadline_window_days: number
          fiscal_year: number
          id: string
          inps_enrollment_year: number | null
          inps_management: string
          inps_rate: number
          inps_type: string
          profit_coefficient: number
          prudenza_preset: string | null
          reserve_amount: number
          riduzione_35_attiva: boolean
          riduzione_50_attiva: boolean
          riduzione_50_scadenza: string | null
          safety_buffer_rate: number
          saldo_iniziale_cc: number
          tax_rate: number
          updated_at: string
          user_id: string
        }
        Insert: {
          acconti_imposta_versati?: number
          acconti_inps_eccedenza_versati?: number
          anno_apertura_piva?: number | null
          ateco_code?: string | null
          banner_fallback_commercialista_dismissed?: boolean
          banner_rate_scadute_dismissed?: boolean
          buffer_base?: string
          created_at?: string
          deadline_window_days?: number
          fiscal_year: number
          id?: string
          inps_enrollment_year?: number | null
          inps_management?: string
          inps_rate?: number
          inps_type?: string
          profit_coefficient?: number
          prudenza_preset?: string | null
          reserve_amount?: number
          riduzione_35_attiva?: boolean
          riduzione_50_attiva?: boolean
          riduzione_50_scadenza?: string | null
          safety_buffer_rate?: number
          saldo_iniziale_cc?: number
          tax_rate?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          acconti_imposta_versati?: number
          acconti_inps_eccedenza_versati?: number
          anno_apertura_piva?: number | null
          ateco_code?: string | null
          banner_fallback_commercialista_dismissed?: boolean
          banner_rate_scadute_dismissed?: boolean
          buffer_base?: string
          created_at?: string
          deadline_window_days?: number
          fiscal_year?: number
          id?: string
          inps_enrollment_year?: number | null
          inps_management?: string
          inps_rate?: number
          inps_type?: string
          profit_coefficient?: number
          prudenza_preset?: string | null
          reserve_amount?: number
          riduzione_35_attiva?: boolean
          riduzione_50_attiva?: boolean
          riduzione_50_scadenza?: string | null
          safety_buffer_rate?: number
          saldo_iniziale_cc?: number
          tax_rate?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      installment_deadlines: {
        Row: {
          created_at: string
          due_date: string
          expected_amount: number
          id: string
          installment_plan_id: string
          is_paid: boolean
          label: string
          receipt_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          due_date: string
          expected_amount: number
          id?: string
          installment_plan_id: string
          is_paid?: boolean
          label?: string
          receipt_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          due_date?: string
          expected_amount?: number
          id?: string
          installment_plan_id?: string
          is_paid?: boolean
          label?: string
          receipt_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "installment_deadlines_installment_plan_id_fkey"
            columns: ["installment_plan_id"]
            isOneToOne: false
            referencedRelation: "installment_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installment_deadlines_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      installment_plans: {
        Row: {
          client_name: string | null
          created_at: string
          description: string | null
          fiscal_year: number
          id: string
          rivalsa_inps_applied: boolean
          start_date: string
          status: string
          total_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          client_name?: string | null
          created_at?: string
          description?: string | null
          fiscal_year: number
          id?: string
          rivalsa_inps_applied?: boolean
          start_date?: string
          status?: string
          total_amount: number
          updated_at?: string
          user_id: string
        }
        Update: {
          client_name?: string | null
          created_at?: string
          description?: string | null
          fiscal_year?: number
          id?: string
          rivalsa_inps_applied?: boolean
          start_date?: string
          status?: string
          total_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      invoice_payments: {
        Row: {
          created_at: string
          data_incasso: string | null
          due_date: string | null
          id: string
          importo: number
          invoice_id: string
          label: string | null
          note: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data_incasso?: string | null
          due_date?: string | null
          id?: string
          importo: number
          invoice_id: string
          label?: string | null
          note?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data_incasso?: string | null
          due_date?: string | null
          id?: string
          importo?: number
          invoice_id?: string
          label?: string | null
          note?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          cliente: string | null
          created_at: string
          data_emissione: string
          data_incasso: string | null
          fiscal_year: number
          id: string
          importo_lordo: number
          note: string | null
          numero_fattura: string
          stato: Database["public"]["Enums"]["invoice_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          cliente?: string | null
          created_at?: string
          data_emissione?: string
          data_incasso?: string | null
          fiscal_year: number
          id?: string
          importo_lordo: number
          note?: string | null
          numero_fattura: string
          stato?: Database["public"]["Enums"]["invoice_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          cliente?: string | null
          created_at?: string
          data_emissione?: string
          data_incasso?: string | null
          fiscal_year?: number
          id?: string
          importo_lordo?: number
          note?: string | null
          numero_fattura?: string
          stato?: Database["public"]["Enums"]["invoice_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      launch_windows: {
        Row: {
          cap_remaining: number
          cap_total: number
          created_at: string
          ends_at: string
          id: string
          is_active: boolean
          lifetime_ends_at: string | null
          name: string
          prices: Json
          starts_at: string
        }
        Insert: {
          cap_remaining: number
          cap_total: number
          created_at?: string
          ends_at: string
          id?: string
          is_active?: boolean
          lifetime_ends_at?: string | null
          name: string
          prices?: Json
          starts_at: string
        }
        Update: {
          cap_remaining?: number
          cap_total?: number
          created_at?: string
          ends_at?: string
          id?: string
          is_active?: boolean
          lifetime_ends_at?: string | null
          name?: string
          prices?: Json
          starts_at?: string
        }
        Relationships: []
      }
      mfa_backup_codes: {
        Row: {
          created_at: string
          factor_id: string
          hashed_code: string
          id: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          factor_id: string
          hashed_code: string
          id?: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          factor_id?: string
          hashed_code?: string
          id?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      mfa_lockout_tracking: {
        Row: {
          backup_verified_at: string | null
          created_at: string
          failed_attempts: number
          id: string
          locked_until: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          backup_verified_at?: string | null
          created_at?: string
          failed_attempts?: number
          id?: string
          locked_until?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          backup_verified_at?: string | null
          created_at?: string
          failed_attempts?: number
          id?: string
          locked_until?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      newsletter_subscribers: {
        Row: {
          confirmed_at: string | null
          consent_given_at: string
          consent_text: string
          created_at: string
          double_opt_in_token: string | null
          email: string
          id: string
          lead_magnet: string | null
          source: string
          source_detail: string | null
          tags: string[]
          unsubscribed_at: string | null
        }
        Insert: {
          confirmed_at?: string | null
          consent_given_at?: string
          consent_text: string
          created_at?: string
          double_opt_in_token?: string | null
          email: string
          id?: string
          lead_magnet?: string | null
          source: string
          source_detail?: string | null
          tags?: string[]
          unsubscribed_at?: string | null
        }
        Update: {
          confirmed_at?: string | null
          consent_given_at?: string
          consent_text?: string
          created_at?: string
          double_opt_in_token?: string | null
          email?: string
          id?: string
          lead_magnet?: string | null
          source?: string
          source_detail?: string | null
          tags?: string[]
          unsubscribed_at?: string | null
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          category: string
          created_at: string
          email_enabled: boolean | null
          enabled: boolean
          id: string
          push_enabled: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          email_enabled?: boolean | null
          enabled?: boolean
          id?: string
          push_enabled?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          email_enabled?: boolean | null
          enabled?: boolean
          id?: string
          push_enabled?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          action_label: string | null
          action_url: string | null
          body: string
          category: string
          created_at: string
          delivery_channel: string
          dismissed_at: string | null
          email_sent_at: string | null
          id: string
          metadata: Json | null
          read_at: string | null
          sms_sent_at: string | null
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action_label?: string | null
          action_url?: string | null
          body: string
          category: string
          created_at?: string
          delivery_channel?: string
          dismissed_at?: string | null
          email_sent_at?: string | null
          id?: string
          metadata?: Json | null
          read_at?: string | null
          sms_sent_at?: string | null
          title: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          action_label?: string | null
          action_url?: string | null
          body?: string
          category?: string
          created_at?: string
          delivery_channel?: string
          dismissed_at?: string | null
          email_sent_at?: string | null
          id?: string
          metadata?: Json | null
          read_at?: string | null
          sms_sent_at?: string | null
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      nps_campaigns: {
        Row: {
          cooldown_days: number
          created_at: string
          enabled_triggers: Json
          end_date: string | null
          id: string
          is_active: boolean
          name: string
          repeat_interval: string
          start_date: string | null
          trigger_type: string
          updated_at: string
        }
        Insert: {
          cooldown_days?: number
          created_at?: string
          enabled_triggers?: Json
          end_date?: string | null
          id?: string
          is_active?: boolean
          name: string
          repeat_interval?: string
          start_date?: string | null
          trigger_type?: string
          updated_at?: string
        }
        Update: {
          cooldown_days?: number
          created_at?: string
          enabled_triggers?: Json
          end_date?: string | null
          id?: string
          is_active?: boolean
          name?: string
          repeat_interval?: string
          start_date?: string | null
          trigger_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      payment_discrepancies: {
        Row: {
          amount_estimated_cents: number
          amount_paid_cents: number
          bucket: string
          created_at: string
          delta_cents: number
          delta_pct: number | null
          discrepancy_category: string | null
          engine_params_snapshot: Json | null
          engine_version: string | null
          fiscal_year: number
          id: string
          marked_at: string
          note: string | null
          payment_id: string | null
          payment_window: string | null
          reason_code: string | null
          reference_year: number | null
          surcharge_cents: number
          tax_schedule_id: string | null
          tolerance_band: string
          user_id: string
        }
        Insert: {
          amount_estimated_cents: number
          amount_paid_cents: number
          bucket: string
          created_at?: string
          delta_cents: number
          delta_pct?: number | null
          discrepancy_category?: string | null
          engine_params_snapshot?: Json | null
          engine_version?: string | null
          fiscal_year: number
          id?: string
          marked_at?: string
          note?: string | null
          payment_id?: string | null
          payment_window?: string | null
          reason_code?: string | null
          reference_year?: number | null
          surcharge_cents?: number
          tax_schedule_id?: string | null
          tolerance_band: string
          user_id: string
        }
        Update: {
          amount_estimated_cents?: number
          amount_paid_cents?: number
          bucket?: string
          created_at?: string
          delta_cents?: number
          delta_pct?: number | null
          discrepancy_category?: string | null
          engine_params_snapshot?: Json | null
          engine_version?: string | null
          fiscal_year?: number
          id?: string
          marked_at?: string
          note?: string | null
          payment_id?: string | null
          payment_window?: string | null
          reason_code?: string | null
          reference_year?: number | null
          surcharge_cents?: number
          tax_schedule_id?: string | null
          tolerance_band?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_discrepancies_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_discrepancies_tax_schedule_id_fkey"
            columns: ["tax_schedule_id"]
            isOneToOne: false
            referencedRelation: "tax_schedule"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          notes: string | null
          payment_date: string
          payment_type: string
          tax_schedule_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          notes?: string | null
          payment_date?: string
          payment_type: string
          tax_schedule_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          notes?: string | null
          payment_date?: string
          payment_type?: string
          tax_schedule_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_tax_schedule_id_fkey"
            columns: ["tax_schedule_id"]
            isOneToOne: false
            referencedRelation: "tax_schedule"
            referencedColumns: ["id"]
          },
        ]
      }
      posthog_backfill_state: {
        Row: {
          cursor: string
          id: number
          updated_at: string
        }
        Insert: {
          cursor: string
          id?: number
          updated_at?: string
        }
        Update: {
          cursor?: string
          id?: number
          updated_at?: string
        }
        Relationships: []
      }
      pro_waitlist: {
        Row: {
          consent_given_at: string
          consent_text: string
          created_at: string
          email: string
          id: string
          invites_count: number
          queue_position_boost: number
          referral_token: string
          referred_by_token: string | null
          revoked_at: string | null
          unsubscribed_at: string | null
          user_id: string
        }
        Insert: {
          consent_given_at?: string
          consent_text: string
          created_at?: string
          email: string
          id?: string
          invites_count?: number
          queue_position_boost?: number
          referral_token: string
          referred_by_token?: string | null
          revoked_at?: string | null
          unsubscribed_at?: string | null
          user_id: string
        }
        Update: {
          consent_given_at?: string
          consent_text?: string
          created_at?: string
          email?: string
          id?: string
          invites_count?: number
          queue_position_boost?: number
          referral_token?: string
          referred_by_token?: string | null
          revoked_at?: string | null
          unsubscribed_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      processed_checkout_sessions: {
        Row: {
          checkout_session_id: string
          processed_at: string
          user_id: string
          window_id: string
        }
        Insert: {
          checkout_session_id: string
          processed_at?: string
          user_id: string
          window_id: string
        }
        Update: {
          checkout_session_id?: string
          processed_at?: string
          user_id?: string
          window_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "processed_checkout_sessions_window_id_fkey"
            columns: ["window_id"]
            isOneToOne: false
            referencedRelation: "launch_windows"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          admin_override_tier: string | null
          analytics_consent: boolean
          analytics_consent_at: string | null
          budget_allocation: Json | null
          created_at: string
          feedback_email_consent: boolean | null
          feedback_email_consent_at: string | null
          first_name: string | null
          id: string
          is_internal: boolean
          last_name: string | null
          last_otp_verified_at: string | null
          last_survey_completed_at: string | null
          marketing_email_consent: boolean
          marketing_email_consent_at: string | null
          onboarding_completed: boolean
          partita_iva: string | null
          privacy_policy_accepted_at: string | null
          privacy_policy_version: string | null
          tos_accepted_at: string | null
          tos_version: string | null
          updated_at: string
          user_code: string
          user_id: string
          wizard_variant: string | null
        }
        Insert: {
          admin_override_tier?: string | null
          analytics_consent?: boolean
          analytics_consent_at?: string | null
          budget_allocation?: Json | null
          created_at?: string
          feedback_email_consent?: boolean | null
          feedback_email_consent_at?: string | null
          first_name?: string | null
          id?: string
          is_internal?: boolean
          last_name?: string | null
          last_otp_verified_at?: string | null
          last_survey_completed_at?: string | null
          marketing_email_consent?: boolean
          marketing_email_consent_at?: string | null
          onboarding_completed?: boolean
          partita_iva?: string | null
          privacy_policy_accepted_at?: string | null
          privacy_policy_version?: string | null
          tos_accepted_at?: string | null
          tos_version?: string | null
          updated_at?: string
          user_code: string
          user_id: string
          wizard_variant?: string | null
        }
        Update: {
          admin_override_tier?: string | null
          analytics_consent?: boolean
          analytics_consent_at?: string | null
          budget_allocation?: Json | null
          created_at?: string
          feedback_email_consent?: boolean | null
          feedback_email_consent_at?: string | null
          first_name?: string | null
          id?: string
          is_internal?: boolean
          last_name?: string | null
          last_otp_verified_at?: string | null
          last_survey_completed_at?: string | null
          marketing_email_consent?: boolean
          marketing_email_consent_at?: string | null
          onboarding_completed?: boolean
          partita_iva?: string | null
          privacy_policy_accepted_at?: string | null
          privacy_policy_version?: string | null
          tos_accepted_at?: string | null
          tos_version?: string | null
          updated_at?: string
          user_code?: string
          user_id?: string
          wizard_variant?: string | null
        }
        Relationships: []
      }
      profit_coeff_presets: {
        Row: {
          ateco_code: string
          category: string | null
          coefficient: number
          created_at: string
          description: string
          id: string
        }
        Insert: {
          ateco_code: string
          category?: string | null
          coefficient: number
          created_at?: string
          description: string
          id?: string
        }
        Update: {
          ateco_code?: string
          category?: string | null
          coefficient?: number
          created_at?: string
          description?: string
          id?: string
        }
        Relationships: []
      }
      receipts: {
        Row: {
          client_id: string | null
          client_name: string | null
          created_at: string
          fiscal_year: number
          gross_amount: number
          id: string
          inps_amount: number | null
          installment_deadline_id: string | null
          installment_plan_id: string | null
          invoice_id: string | null
          invoice_number: string | null
          invoice_payment_id: string | null
          marca_bollo_amount: number
          marca_bollo_applied: boolean
          net_spendable: number | null
          notes: string | null
          receipt_date: string
          rivalsa_inps_amount: number
          rivalsa_inps_applied: boolean
          service_category_id: string | null
          source: string
          tax_amount: number | null
          taxable_amount: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id?: string | null
          client_name?: string | null
          created_at?: string
          fiscal_year: number
          gross_amount: number
          id?: string
          inps_amount?: number | null
          installment_deadline_id?: string | null
          installment_plan_id?: string | null
          invoice_id?: string | null
          invoice_number?: string | null
          invoice_payment_id?: string | null
          marca_bollo_amount?: number
          marca_bollo_applied?: boolean
          net_spendable?: number | null
          notes?: string | null
          receipt_date?: string
          rivalsa_inps_amount?: number
          rivalsa_inps_applied?: boolean
          service_category_id?: string | null
          source?: string
          tax_amount?: number | null
          taxable_amount?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string | null
          client_name?: string | null
          created_at?: string
          fiscal_year?: number
          gross_amount?: number
          id?: string
          inps_amount?: number | null
          installment_deadline_id?: string | null
          installment_plan_id?: string | null
          invoice_id?: string | null
          invoice_number?: string | null
          invoice_payment_id?: string | null
          marca_bollo_amount?: number
          marca_bollo_applied?: boolean
          net_spendable?: number | null
          notes?: string | null
          receipt_date?: string
          rivalsa_inps_amount?: number
          rivalsa_inps_applied?: boolean
          service_category_id?: string | null
          source?: string
          tax_amount?: number | null
          taxable_amount?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_installment_deadline_id_fkey"
            columns: ["installment_deadline_id"]
            isOneToOne: false
            referencedRelation: "installment_deadlines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_installment_plan_id_fkey"
            columns: ["installment_plan_id"]
            isOneToOne: false
            referencedRelation: "installment_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_invoice_payment_id_fkey"
            columns: ["invoice_payment_id"]
            isOneToOne: false
            referencedRelation: "invoice_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_service_category_id_fkey"
            columns: ["service_category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          confirmed_at: string | null
          created_at: string
          id: string
          invitee_email: string | null
          invitee_user_id: string | null
          ip_address: string | null
          points_awarded: boolean
          referrer_code: string
          referrer_user_id: string
          status: string
        }
        Insert: {
          confirmed_at?: string | null
          created_at?: string
          id?: string
          invitee_email?: string | null
          invitee_user_id?: string | null
          ip_address?: string | null
          points_awarded?: boolean
          referrer_code: string
          referrer_user_id: string
          status?: string
        }
        Update: {
          confirmed_at?: string | null
          created_at?: string
          id?: string
          invitee_email?: string | null
          invitee_user_id?: string | null
          ip_address?: string | null
          points_awarded?: boolean
          referrer_code?: string
          referrer_user_id?: string
          status?: string
        }
        Relationships: []
      }
      service_categories: {
        Row: {
          active: boolean | null
          color: string | null
          created_at: string
          icon: string | null
          id: string
          name: string
          sort_order: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean | null
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          sort_order?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean | null
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          sort_order?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          billing_interval: string | null
          cancel_at_period_end: boolean | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          tier: string
          updated_at: string
          user_id: string
        }
        Insert: {
          billing_interval?: string | null
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          billing_interval?: string | null
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      survey_responses: {
        Row: {
          campaign_id: string | null
          comment: string | null
          created_at: string
          free_text: string | null
          id: string
          score: number | null
          selected_reason: string
          survey_key: string
          trigger_source: string | null
          user_id: string
        }
        Insert: {
          campaign_id?: string | null
          comment?: string | null
          created_at?: string
          free_text?: string | null
          id?: string
          score?: number | null
          selected_reason: string
          survey_key: string
          trigger_source?: string | null
          user_id: string
        }
        Update: {
          campaign_id?: string | null
          comment?: string | null
          created_at?: string
          free_text?: string | null
          id?: string
          score?: number | null
          selected_reason?: string
          survey_key?: string
          trigger_source?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_responses_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "nps_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_schedule: {
        Row: {
          bucket: string
          created_at: string
          due_date: string
          id: string
          inps_advance: number
          inps_balance: number
          notes: string | null
          payment_year: number
          reference_year: number
          status: string
          tax_advance: number
          tax_balance: number
          total_expected: number
          total_paid: number
          updated_at: string
          user_id: string
        }
        Insert: {
          bucket: string
          created_at?: string
          due_date: string
          id?: string
          inps_advance?: number
          inps_balance?: number
          notes?: string | null
          payment_year: number
          reference_year: number
          status?: string
          tax_advance?: number
          tax_balance?: number
          total_expected?: number
          total_paid?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          bucket?: string
          created_at?: string
          due_date?: string
          id?: string
          inps_advance?: number
          inps_balance?: number
          notes?: string | null
          payment_year?: number
          reference_year?: number
          status?: string
          tax_advance?: number
          tax_balance?: number
          total_expected?: number
          total_paid?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tool_subscriptions: {
        Row: {
          category: string
          cost: number
          created_at: string
          frequency: string
          id: string
          is_active: boolean
          is_recurring: boolean
          name: string
          notes: string | null
          renewal_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          cost: number
          created_at?: string
          frequency?: string
          id?: string
          is_active?: boolean
          is_recurring?: boolean
          name: string
          notes?: string | null
          renewal_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          cost?: number
          created_at?: string
          frequency?: string
          id?: string
          is_active?: boolean
          is_recurring?: boolean
          name?: string
          notes?: string | null
          renewal_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_contributions: {
        Row: {
          action_type: string
          created_at: string
          id: string
          metadata: Json | null
          points: number
          user_id: string
        }
        Insert: {
          action_type: string
          created_at?: string
          id?: string
          metadata?: Json | null
          points: number
          user_id: string
        }
        Update: {
          action_type?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          points?: number
          user_id?: string
        }
        Relationships: []
      }
      user_milestone_claims: {
        Row: {
          admin_notes: string | null
          claimed_at: string | null
          id: string
          milestone_id: string
          reached_at: string
          reward_claimed: boolean
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          claimed_at?: string | null
          id?: string
          milestone_id: string
          reached_at?: string
          reward_claimed?: boolean
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          claimed_at?: string | null
          id?: string
          milestone_id?: string
          reached_at?: string
          reward_claimed?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_milestone_claims_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "contribution_milestones"
            referencedColumns: ["id"]
          },
        ]
      }
      user_notification_settings: {
        Row: {
          admin_messages_enabled: boolean
          aggiornamenti_enabled: boolean
          created_at: string
          feedback_enabled: boolean
          has_accountant: boolean
          id: string
          insights_enabled: boolean
          master_enabled: boolean
          reminder_thresholds: number[]
          scadenze_email_enabled: boolean
          scadenze_enabled: boolean
          tone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_messages_enabled?: boolean
          aggiornamenti_enabled?: boolean
          created_at?: string
          feedback_enabled?: boolean
          has_accountant?: boolean
          id?: string
          insights_enabled?: boolean
          master_enabled?: boolean
          reminder_thresholds?: number[]
          scadenze_email_enabled?: boolean
          scadenze_enabled?: boolean
          tone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_messages_enabled?: boolean
          aggiornamenti_enabled?: boolean
          created_at?: string
          feedback_enabled?: boolean
          has_accountant?: boolean
          id?: string
          insights_enabled?: boolean
          master_enabled?: boolean
          reminder_thresholds?: number[]
          scadenze_email_enabled?: boolean
          scadenze_enabled?: boolean
          tone?: string
          updated_at?: string
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
          role?: Database["public"]["Enums"]["app_role"]
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
      user_sessions: {
        Row: {
          count: number
          id: string
          session_date: string
          user_id: string
        }
        Insert: {
          count?: number
          id?: string
          session_date?: string
          user_id: string
        }
        Update: {
          count?: number
          id?: string
          session_date?: string
          user_id?: string
        }
        Relationships: []
      }
      user_tasks: {
        Row: {
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          labels: Json
          position: number
          priority: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          labels?: Json
          position?: number
          priority?: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          labels?: Json
          position?: number
          priority?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      waitlist_email_sent: {
        Row: {
          email_type: string
          id: string
          resend_id: string | null
          sent_at: string
          waitlist_id: string
          window_id: string
        }
        Insert: {
          email_type: string
          id?: string
          resend_id?: string | null
          sent_at?: string
          waitlist_id: string
          window_id: string
        }
        Update: {
          email_type?: string
          id?: string
          resend_id?: string | null
          sent_at?: string
          waitlist_id?: string
          window_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "waitlist_email_sent_waitlist_id_fkey"
            columns: ["waitlist_id"]
            isOneToOne: false
            referencedRelation: "pro_waitlist"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waitlist_email_sent_window_id_fkey"
            columns: ["window_id"]
            isOneToOne: false
            referencedRelation: "launch_windows"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist_leads: {
        Row: {
          confirmed_at: string | null
          consent_text: string
          created_at: string
          email: string
          id: string
          referred_by_token: string | null
          revoked_at: string | null
          source: string
          source_detail: string | null
        }
        Insert: {
          confirmed_at?: string | null
          consent_text: string
          created_at?: string
          email: string
          id?: string
          referred_by_token?: string | null
          revoked_at?: string | null
          source?: string
          source_detail?: string | null
        }
        Update: {
          confirmed_at?: string | null
          consent_text?: string
          created_at?: string
          email?: string
          id?: string
          referred_by_token?: string | null
          revoked_at?: string | null
          source?: string
          source_detail?: string | null
        }
        Relationships: []
      }
      wizard_drafts: {
        Row: {
          current_step_index: number
          data: Json
          updated_at: string
          user_id: string
          visible_steps: string[]
        }
        Insert: {
          current_step_index?: number
          data?: Json
          updated_at?: string
          user_id: string
          visible_steps?: string[]
        }
        Update: {
          current_step_index?: number
          data?: Json
          updated_at?: string
          user_id?: string
          visible_steps?: string[]
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _calc_totale_accantonamento: {
        Args: { p_fiscal_year: number; p_user_id: string }
        Returns: number
      }
      _contribution_totals: {
        Args: never
        Returns: {
          total_pts: number
          uid: string
        }[]
      }
      add_tag_to_subscriber: {
        Args: { p_email: string; p_tag: string }
        Returns: Json
      }
      admin_award_contribution: {
        Args: {
          p_action_type?: string
          p_all_users?: boolean
          p_points?: number
          p_reason?: string
          p_user_code?: string
        }
        Returns: number
      }
      admin_claim_milestone_for_user: {
        Args: { p_milestone_id: string; p_notes?: string; p_user_id: string }
        Returns: undefined
      }
      admin_create_milestone: {
        Args: {
          p_level: number
          p_name: string
          p_points_required: number
          p_reward_label: string
          p_reward_type: string
        }
        Returns: string
      }
      admin_delete_milestone: { Args: { p_id: string }; Returns: undefined }
      admin_get_milestone_achievers: {
        Args: never
        Returns: {
          claimed_at: string
          first_name: string
          milestone_id: string
          milestone_level: number
          milestone_name: string
          reward_claimed: boolean
          reward_label: string
          total_pts: number
          user_code: string
          user_id: string
        }[]
      }
      admin_get_pricing_survey_responses: {
        Args: never
        Returns: {
          created_at: string
          free_text: string
          id: string
          selected_reason: string
          user_code: string
        }[]
      }
      admin_record_call_contribution: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      admin_update_action_config: {
        Args: {
          p_action_type: string
          p_frequency_label: string
          p_label: string
          p_points: number
        }
        Returns: undefined
      }
      admin_update_milestone: {
        Args: {
          p_id: string
          p_is_active: boolean
          p_name: string
          p_points_required: number
          p_reward_label: string
          p_reward_type: string
        }
        Returns: undefined
      }
      check_lockout: { Args: { p_user_id: string }; Returns: Json }
      check_lockout_for_totp: { Args: { p_user_id: string }; Returns: Json }
      check_receipt_insert_limit: {
        Args: { _fiscal_year: number; _source: string; _user_id: string }
        Returns: boolean
      }
      cleanup_expired_data: { Args: never; Returns: Json }
      confirm_newsletter_subscription: {
        Args: { p_token: string }
        Returns: Json
      }
      decrement_launch_cap: {
        Args: {
          p_checkout_session_id: string
          p_user_id: string
          p_window_id: string
        }
        Returns: Json
      }
      generate_user_code: {
        Args: { p_created_at: string; p_first_name: string }
        Returns: string
      }
      get_ab_test_comparison: {
        Args: { p_from_date?: string; p_to_date?: string }
        Returns: Json
      }
      get_action_config: {
        Args: never
        Returns: {
          action_type: string
          color_bg: string
          color_text: string
          display_order: number
          frequency_label: string
          label: string
          points: number
        }[]
      }
      get_admin_leaderboard: {
        Args: { p_include_internal?: boolean; p_limit?: number }
        Returns: {
          first_name: string
          rank: number
          total_pts: number
          user_code: string
          user_id: string
        }[]
      }
      get_admin_qualified_users: {
        Args: { p_min_receipts?: number }
        Returns: {
          created_at: string
          email: string
          email_consent: boolean
          first_name: string
          inps_type: string
          receipt_count: number
          user_code: string
          user_id: string
        }[]
      }
      get_admin_user_contribution_breakdown: {
        Args: { p_user_id: string }
        Returns: {
          action_count: number
          action_type: string
          total_points: number
        }[]
      }
      get_client_monthly_trend: {
        Args: { p_client_id: string; p_fiscal_year: number; p_user_id: string }
        Returns: {
          gross_amount: number
          month: number
          receipt_count: number
        }[]
      }
      get_client_revenue_report: {
        Args: { p_fiscal_year?: number; p_user_id: string }
        Returns: {
          client_id: string
          client_name: string
          first_receipt_date: string
          last_receipt_date: string
          percentage: number
          receipt_count: number
          total_gross: number
          total_net: number
        }[]
      }
      get_consented_email_list: {
        Args: never
        Returns: {
          consent_at: string
          email: string
        }[]
      }
      get_cross_analysis: {
        Args: { p_fiscal_year?: number; p_user_id: string }
        Returns: {
          category_color: string
          category_id: string
          category_name: string
          client_id: string
          client_name: string
          receipt_count: number
          total_gross: number
        }[]
      }
      get_email_event_recipients: {
        Args: {
          p_category?: string
          p_event_type?: string
          p_limit?: number
          p_since?: string
        }
        Returns: {
          clicked_url: string
          event_type: string
          occurred_at: string
          recipient_email: string
          threshold: string
          user_id: string
        }[]
      }
      get_email_event_stats: {
        Args: { p_category?: string; p_since?: string }
        Returns: Json
      }
      get_email_event_trend: {
        Args: { p_category?: string; p_since?: string }
        Returns: Json
      }
      get_income_stats: { Args: { p_year: number }; Returns: Json }
      get_leaderboard: {
        Args: { p_limit?: number }
        Returns: {
          is_current: boolean
          rank: number
          total_pts: number
          user_id: string
        }[]
      }
      get_mfa_lockout_status: { Args: { p_user_id: string }; Returns: Json }
      get_milestones: {
        Args: never
        Returns: {
          id: string
          level: number
          name: string
          points_required: number
          reward_label: string
          reward_type: string
        }[]
      }
      get_my_contributions: {
        Args: never
        Returns: {
          admin_manual_pts: number
          calendar_survey_pts: number
          call_pts: number
          feedback_pts: number
          first_import_xml_pts: number
          monthly_referral_count: number
          my_rank: number
          nps_survey_pts: number
          pricing_survey_pts: number
          referral_pts: number
          total_pts: number
          welcome_gift_pts: number
        }[]
      }
      get_my_referral_info: { Args: never; Returns: Json }
      get_next_launch_window_date: { Args: never; Returns: string }
      get_nsm_adoption_funnel: { Args: never; Returns: Json }
      get_nsm_scadenze_coperte: {
        Args: {
          p_gestione_filter?: string
          p_reference_date?: string
          p_window_days?: number
        }
        Returns: Json
      }
      get_otp_stats: { Args: { p_threshold_days?: number }; Returns: Json }
      get_payment_discrepancy_stats: { Args: never; Returns: Json }
      get_public_user_count: { Args: never; Returns: number }
      get_service_monthly_trend: {
        Args: {
          p_fiscal_year: number
          p_service_id?: string
          p_user_id: string
        }
        Returns: {
          gross_amount: number
          month: number
          receipt_count: number
        }[]
      }
      get_service_revenue_report: {
        Args: { p_fiscal_year?: number; p_user_id: string }
        Returns: {
          first_receipt_date: string
          last_receipt_date: string
          percentage: number
          receipt_count: number
          service_color: string
          service_id: string
          service_name: string
          total_gross: number
          total_net: number
        }[]
      }
      get_ttv_dashboard: {
        Args: {
          p_from_date?: string
          p_to_date?: string
          p_trend_days?: number
          p_wizard_variant?: string
        }
        Returns: Json
      }
      get_waitlist_active_count: { Args: never; Returns: number }
      get_wizard_funnel: {
        Args: {
          p_from_date?: string
          p_gestione_filter?: string
          p_to_date?: string
          p_wizard_variant?: string
        }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_analytics_event: {
        Args: { p_event_name: string }
        Returns: undefined
      }
      increment_user_session: { Args: never; Returns: undefined }
      join_waitlist_lead: {
        Args: {
          p_consent_text: string
          p_email: string
          p_referred_by_token?: string
          p_source: string
          p_source_detail?: string
        }
        Returns: Json
      }
      mark_tax_schedule_paid: {
        Args: {
          p_amount_estimated_cents: number
          p_amount_paid_cents: number
          p_discrepancy_category?: string
          p_engine_snapshot?: Json
          p_engine_version?: string
          p_note?: string
          p_payment_date: string
          p_payment_type: string
          p_payment_window?: string
          p_reason_code?: string
          p_schedule_id: string
          p_surcharge_cents?: number
          p_tolerance_band: string
        }
        Returns: string
      }
      merge_waitlist_lead_if_exists: {
        Args: { p_email: string; p_user_id: string }
        Returns: Json
      }
      process_referral_signup: {
        Args: { p_referrer_code: string }
        Returns: undefined
      }
      record_calendar_survey_contribution: { Args: never; Returns: boolean }
      record_failed_attempt: { Args: { p_user_id: string }; Returns: Json }
      record_failed_totp_attempt: { Args: { p_user_id: string }; Returns: Json }
      record_feedback_contribution: { Args: never; Returns: boolean }
      record_first_import_contribution: { Args: never; Returns: undefined }
      record_nps_response: {
        Args: {
          p_campaign_id?: string
          p_comment?: string
          p_score: number
          p_survey_key?: string
          p_trigger_source?: string
        }
        Returns: Json
      }
      record_nps_survey_contribution: { Args: never; Returns: boolean }
      record_pricing_survey_contribution: { Args: never; Returns: boolean }
      reincrement_launch_cap: {
        Args: { p_window_id: string }
        Returns: boolean
      }
      reset_lockout: { Args: { p_user_id: string }; Returns: undefined }
      reset_lockout_after_totp: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      subscribe_to_newsletter: {
        Args: {
          p_email: string
          p_initial_tags?: string[]
          p_lead_magnet?: string
          p_source: string
          p_source_detail?: string
        }
        Returns: Json
      }
      unmark_tax_schedule_paid: {
        Args: { p_schedule_id: string }
        Returns: undefined
      }
      unsubscribe_newsletter: {
        Args: { p_token_or_email: string }
        Returns: Json
      }
      unsubscribe_scadenze: { Args: { p_user_id: string }; Returns: boolean }
      unsubscribe_waitlist_nurture: {
        Args: { p_token: string }
        Returns: boolean
      }
      verify_and_consume_backup_code: {
        Args: { p_plain_code: string; p_user_id: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "user"
      invoice_status:
        | "emessa"
        | "ricevuta"
        | "parzialmente_incassata"
        | "incassata"
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
      app_role: ["admin", "user"],
      invoice_status: [
        "emessa",
        "ricevuta",
        "parzialmente_incassata",
        "incassata",
      ],
    },
  },
} as const
