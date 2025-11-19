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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      activation_tokens: {
        Row: {
          created_at: string
          email_result: Json | null
          email_sent_at: string | null
          employee_id: string
          expires_at: string
          id: string
          status: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email_result?: Json | null
          email_sent_at?: string | null
          employee_id: string
          expires_at?: string
          id?: string
          status?: string
          token?: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email_result?: Json | null
          email_sent_at?: string | null
          employee_id?: string
          expires_at?: string
          id?: string
          status?: string
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activation_tokens_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          code: string
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          phone: string | null
          registration_no: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          code: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          phone?: string | null
          registration_no?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          code?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          phone?: string | null
          registration_no?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      company_config: {
        Row: {
          company_id: string
          created_at: string
          id: string
          selected_state: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          selected_state: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          selected_state?: string
          updated_at?: string
        }
        Relationships: []
      }
      company_profile: {
        Row: {
          address: string
          created_at: string | null
          id: string
          logo_url: string | null
          name: string
          phone: string
          registration_no: string
          updated_at: string | null
        }
        Insert: {
          address: string
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name: string
          phone: string
          registration_no: string
          updated_at?: string | null
        }
        Update: {
          address?: string
          created_at?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          phone?: string
          registration_no?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      departments: {
        Row: {
          code: string
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          code: string
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          code?: string
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      holiday_calendar_items: {
        Row: {
          calendar_id: string
          created_at: string
          description: string
          holiday_date: string
          id: string
          state_code: string | null
        }
        Insert: {
          calendar_id: string
          created_at?: string
          description: string
          holiday_date: string
          id?: string
          state_code?: string | null
        }
        Update: {
          calendar_id?: string
          created_at?: string
          description?: string
          holiday_date?: string
          id?: string
          state_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "holiday_calendar_items_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "holiday_calendars"
            referencedColumns: ["id"]
          },
        ]
      }
      holiday_calendars: {
        Row: {
          created_at: string
          created_by: string | null
          date_from: string
          date_to: string
          id: string
          name: string
          state_code: string | null
          total_holidays: number | null
          year: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date_from: string
          date_to: string
          id?: string
          name: string
          state_code?: string | null
          total_holidays?: number | null
          year: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date_from?: string
          date_to?: string
          id?: string
          name?: string
          state_code?: string | null
          total_holidays?: number | null
          year?: number
        }
        Relationships: []
      }
      holiday_overrides: {
        Row: {
          company_id: string
          created_at: string | null
          created_by: string
          date: string
          description: string | null
          id: string
          name: string
          type: string
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          created_by: string
          date: string
          description?: string | null
          id?: string
          name: string
          type?: string
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          created_by?: string
          date?: string
          description?: string | null
          id?: string
          name?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      inventory_access_tokens: {
        Row: {
          created_at: string | null
          expires_at: string
          generated_at: string
          id: string
          is_active: boolean | null
          token: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          generated_at?: string
          id?: string
          is_active?: boolean | null
          token: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          generated_at?: string
          id?: string
          is_active?: boolean | null
          token?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      malaysian_holidays: {
        Row: {
          created_at: string | null
          date: string
          id: string
          name: string
          scraped_at: string | null
          source: string
          state: string
          type: string
          updated_at: string | null
          year: number
        }
        Insert: {
          created_at?: string | null
          date: string
          id?: string
          name: string
          scraped_at?: string | null
          source: string
          state: string
          type: string
          updated_at?: string | null
          year: number
        }
        Update: {
          created_at?: string | null
          date?: string
          id?: string
          name?: string
          scraped_at?: string | null
          source?: string
          state?: string
          type?: string
          updated_at?: string | null
          year?: number
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          link: string | null
          message: string
          notification_type: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message: string
          notification_type?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message?: string
          notification_type?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      ot_approval_thresholds: {
        Row: {
          alert_recipients: string[] | null
          applies_to_department_ids: string[] | null
          applies_to_role_ids: string[] | null
          auto_block_enabled: boolean | null
          created_at: string | null
          created_by: string | null
          daily_limit_hours: number | null
          id: string
          is_active: boolean | null
          max_claimable_amount: number | null
          monthly_limit_hours: number | null
          threshold_name: string
          updated_at: string | null
          weekly_limit_hours: number | null
        }
        Insert: {
          alert_recipients?: string[] | null
          applies_to_department_ids?: string[] | null
          applies_to_role_ids?: string[] | null
          auto_block_enabled?: boolean | null
          created_at?: string | null
          created_by?: string | null
          daily_limit_hours?: number | null
          id?: string
          is_active?: boolean | null
          max_claimable_amount?: number | null
          monthly_limit_hours?: number | null
          threshold_name: string
          updated_at?: string | null
          weekly_limit_hours?: number | null
        }
        Update: {
          alert_recipients?: string[] | null
          applies_to_department_ids?: string[] | null
          applies_to_role_ids?: string[] | null
          auto_block_enabled?: boolean | null
          created_at?: string | null
          created_by?: string | null
          daily_limit_hours?: number | null
          id?: string
          is_active?: boolean | null
          max_claimable_amount?: number | null
          monthly_limit_hours?: number | null
          threshold_name?: string
          updated_at?: string | null
          weekly_limit_hours?: number | null
        }
        Relationships: []
      }
      ot_eligibility_rules: {
        Row: {
          created_at: string | null
          created_by: string | null
          department_ids: string[] | null
          employment_types: string[] | null
          id: string
          is_active: boolean | null
          max_salary: number | null
          min_salary: number | null
          role_ids: string[] | null
          rule_name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          department_ids?: string[] | null
          employment_types?: string[] | null
          id?: string
          is_active?: boolean | null
          max_salary?: number | null
          min_salary?: number | null
          role_ids?: string[] | null
          rule_name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          department_ids?: string[] | null
          employment_types?: string[] | null
          id?: string
          is_active?: boolean | null
          max_salary?: number | null
          min_salary?: number | null
          role_ids?: string[] | null
          rule_name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      ot_rate_formulas: {
        Row: {
          base_formula: string
          conditional_logic: Json | null
          created_at: string | null
          created_by: string | null
          day_type: Database["public"]["Enums"]["day_type"]
          effective_from: string
          effective_to: string | null
          employee_category: string
          formula_name: string
          hrp_definition: string | null
          id: string
          is_active: boolean | null
          multiplier: number
          orp_definition: string | null
          updated_at: string | null
        }
        Insert: {
          base_formula: string
          conditional_logic?: Json | null
          created_at?: string | null
          created_by?: string | null
          day_type: Database["public"]["Enums"]["day_type"]
          effective_from: string
          effective_to?: string | null
          employee_category?: string
          formula_name: string
          hrp_definition?: string | null
          id?: string
          is_active?: boolean | null
          multiplier: number
          orp_definition?: string | null
          updated_at?: string | null
        }
        Update: {
          base_formula?: string
          conditional_logic?: Json | null
          created_at?: string | null
          created_by?: string | null
          day_type?: Database["public"]["Enums"]["day_type"]
          effective_from?: string
          effective_to?: string | null
          employee_category?: string
          formula_name?: string
          hrp_definition?: string | null
          id?: string
          is_active?: boolean | null
          multiplier?: number
          orp_definition?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      ot_requests: {
        Row: {
          attachment_urls: string[]
          created_at: string | null
          day_type: Database["public"]["Enums"]["day_type"]
          eligibility_rule_id: string | null
          employee_id: string
          end_time: string
          formula_id: string | null
          hr_approved_at: string | null
          hr_id: string | null
          hr_remarks: string | null
          hrp: number | null
          id: string
          is_resubmission: boolean | null
          management_remarks: string | null
          management_reviewed_at: string | null
          orp: number | null
          ot_amount: number | null
          ot_date: string
          parent_request_id: string | null
          reason: string
          rejection_stage: string | null
          respective_supervisor_confirmed_at: string | null
          respective_supervisor_denial_remarks: string | null
          respective_supervisor_denied_at: string | null
          respective_supervisor_id: string | null
          respective_supervisor_remarks: string | null
          resubmission_count: number | null
          start_time: string
          status: Database["public"]["Enums"]["ot_status"] | null
          supervisor_confirmation_at: string | null
          supervisor_confirmation_remarks: string | null
          supervisor_id: string | null
          supervisor_remarks: string | null
          supervisor_verified_at: string | null
          threshold_violations: Json | null
          ticket_number: string
          total_hours: number
          updated_at: string | null
        }
        Insert: {
          attachment_urls?: string[]
          created_at?: string | null
          day_type: Database["public"]["Enums"]["day_type"]
          eligibility_rule_id?: string | null
          employee_id: string
          end_time: string
          formula_id?: string | null
          hr_approved_at?: string | null
          hr_id?: string | null
          hr_remarks?: string | null
          hrp?: number | null
          id?: string
          is_resubmission?: boolean | null
          management_remarks?: string | null
          management_reviewed_at?: string | null
          orp?: number | null
          ot_amount?: number | null
          ot_date: string
          parent_request_id?: string | null
          reason: string
          rejection_stage?: string | null
          respective_supervisor_confirmed_at?: string | null
          respective_supervisor_denial_remarks?: string | null
          respective_supervisor_denied_at?: string | null
          respective_supervisor_id?: string | null
          respective_supervisor_remarks?: string | null
          resubmission_count?: number | null
          start_time: string
          status?: Database["public"]["Enums"]["ot_status"] | null
          supervisor_confirmation_at?: string | null
          supervisor_confirmation_remarks?: string | null
          supervisor_id?: string | null
          supervisor_remarks?: string | null
          supervisor_verified_at?: string | null
          threshold_violations?: Json | null
          ticket_number: string
          total_hours: number
          updated_at?: string | null
        }
        Update: {
          attachment_urls?: string[]
          created_at?: string | null
          day_type?: Database["public"]["Enums"]["day_type"]
          eligibility_rule_id?: string | null
          employee_id?: string
          end_time?: string
          formula_id?: string | null
          hr_approved_at?: string | null
          hr_id?: string | null
          hr_remarks?: string | null
          hrp?: number | null
          id?: string
          is_resubmission?: boolean | null
          management_remarks?: string | null
          management_reviewed_at?: string | null
          orp?: number | null
          ot_amount?: number | null
          ot_date?: string
          parent_request_id?: string | null
          reason?: string
          rejection_stage?: string | null
          respective_supervisor_confirmed_at?: string | null
          respective_supervisor_denial_remarks?: string | null
          respective_supervisor_denied_at?: string | null
          respective_supervisor_id?: string | null
          respective_supervisor_remarks?: string | null
          resubmission_count?: number | null
          start_time?: string
          status?: Database["public"]["Enums"]["ot_status"] | null
          supervisor_confirmation_at?: string | null
          supervisor_confirmation_remarks?: string | null
          supervisor_id?: string | null
          supervisor_remarks?: string | null
          supervisor_verified_at?: string | null
          threshold_violations?: Json | null
          ticket_number?: string
          total_hours?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ot_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ot_requests_hr_id_fkey"
            columns: ["hr_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ot_requests_parent_request_id_fkey"
            columns: ["parent_request_id"]
            isOneToOne: false
            referencedRelation: "ot_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ot_requests_parent_request_id_fkey"
            columns: ["parent_request_id"]
            isOneToOne: false
            referencedRelation: "pending_confirmations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ot_requests_parent_request_id_fkey"
            columns: ["parent_request_id"]
            isOneToOne: false
            referencedRelation: "pending_respective_supervisor_confirmations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ot_requests_parent_request_id_fkey"
            columns: ["parent_request_id"]
            isOneToOne: false
            referencedRelation: "pending_supervisor_review"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ot_requests_respective_supervisor_id_fkey"
            columns: ["respective_supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ot_requests_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ot_resubmission_history: {
        Row: {
          created_at: string | null
          id: string
          original_request_id: string
          rejected_by_role: Database["public"]["Enums"]["app_role"]
          rejection_reason: string
          resubmitted_at: string | null
          resubmitted_request_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          original_request_id: string
          rejected_by_role: Database["public"]["Enums"]["app_role"]
          rejection_reason: string
          resubmitted_at?: string | null
          resubmitted_request_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          original_request_id?: string
          rejected_by_role?: Database["public"]["Enums"]["app_role"]
          rejection_reason?: string
          resubmitted_at?: string | null
          resubmitted_request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ot_resubmission_history_original_request_id_fkey"
            columns: ["original_request_id"]
            isOneToOne: false
            referencedRelation: "ot_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ot_resubmission_history_original_request_id_fkey"
            columns: ["original_request_id"]
            isOneToOne: false
            referencedRelation: "pending_confirmations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ot_resubmission_history_original_request_id_fkey"
            columns: ["original_request_id"]
            isOneToOne: false
            referencedRelation: "pending_respective_supervisor_confirmations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ot_resubmission_history_original_request_id_fkey"
            columns: ["original_request_id"]
            isOneToOne: false
            referencedRelation: "pending_supervisor_review"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ot_resubmission_history_resubmitted_request_id_fkey"
            columns: ["resubmitted_request_id"]
            isOneToOne: false
            referencedRelation: "ot_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ot_resubmission_history_resubmitted_request_id_fkey"
            columns: ["resubmitted_request_id"]
            isOneToOne: false
            referencedRelation: "pending_confirmations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ot_resubmission_history_resubmitted_request_id_fkey"
            columns: ["resubmitted_request_id"]
            isOneToOne: false
            referencedRelation: "pending_respective_supervisor_confirmations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ot_resubmission_history_resubmitted_request_id_fkey"
            columns: ["resubmitted_request_id"]
            isOneToOne: false
            referencedRelation: "pending_supervisor_review"
            referencedColumns: ["id"]
          },
        ]
      }
      ot_settings: {
        Row: {
          active_calendar_id: string | null
          id: string
          max_daily_hours: number | null
          rounding_rule: string | null
          salary_threshold: number | null
          submission_limit_days: number | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          active_calendar_id?: string | null
          id?: string
          max_daily_hours?: number | null
          rounding_rule?: string | null
          salary_threshold?: number | null
          submission_limit_days?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          active_calendar_id?: string | null
          id?: string
          max_daily_hours?: number | null
          rounding_rule?: string | null
          salary_threshold?: number | null
          submission_limit_days?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ot_settings_active_calendar_id_fkey"
            columns: ["active_calendar_id"]
            isOneToOne: false
            referencedRelation: "holiday_calendars"
            referencedColumns: ["id"]
          },
        ]
      }
      positions: {
        Row: {
          created_at: string | null
          created_by: string | null
          department_id: string
          description: string | null
          id: string
          is_active: boolean | null
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          department_id: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          department_id?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "positions_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          basic_salary: number
          company_id: string | null
          created_at: string | null
          department_id: string | null
          designation: string | null
          email: string
          employee_id: string
          employment_type: string | null
          epf_no: string | null
          full_name: string
          ic_no: string | null
          id: string
          income_tax_no: string | null
          is_ot_eligible: boolean
          joining_date: string | null
          notification_preferences: Json | null
          phone_no: string | null
          position: string | null
          position_id: string | null
          require_ot_attachment: boolean
          socso_no: string | null
          state: string | null
          status: string | null
          supervisor_id: string | null
          updated_at: string | null
          work_location: string | null
        }
        Insert: {
          basic_salary: number
          company_id?: string | null
          created_at?: string | null
          department_id?: string | null
          designation?: string | null
          email: string
          employee_id: string
          employment_type?: string | null
          epf_no?: string | null
          full_name: string
          ic_no?: string | null
          id: string
          income_tax_no?: string | null
          is_ot_eligible?: boolean
          joining_date?: string | null
          notification_preferences?: Json | null
          phone_no?: string | null
          position?: string | null
          position_id?: string | null
          require_ot_attachment?: boolean
          socso_no?: string | null
          state?: string | null
          status?: string | null
          supervisor_id?: string | null
          updated_at?: string | null
          work_location?: string | null
        }
        Update: {
          basic_salary?: number
          company_id?: string | null
          created_at?: string | null
          department_id?: string | null
          designation?: string | null
          email?: string
          employee_id?: string
          employment_type?: string | null
          epf_no?: string | null
          full_name?: string
          ic_no?: string | null
          id?: string
          income_tax_no?: string | null
          is_ot_eligible?: boolean
          joining_date?: string | null
          notification_preferences?: Json | null
          phone_no?: string | null
          position?: string | null
          position_id?: string | null
          require_ot_attachment?: boolean
          socso_no?: string | null
          state?: string | null
          status?: string | null
          supervisor_id?: string | null
          updated_at?: string | null
          work_location?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      public_holidays: {
        Row: {
          created_at: string | null
          holiday_date: string
          holiday_name: string
          id: string
        }
        Insert: {
          created_at?: string | null
          holiday_date: string
          holiday_name: string
          id?: string
        }
        Update: {
          created_at?: string | null
          holiday_date?: string
          holiday_name?: string
          id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth_key: string
          created_at: string | null
          endpoint: string
          id: string
          is_active: boolean
          p256dh_key: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          auth_key: string
          created_at?: string | null
          endpoint: string
          id?: string
          is_active?: boolean
          p256dh_key: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          auth_key?: string
          created_at?: string | null
          endpoint?: string
          id?: string
          is_active?: boolean
          p256dh_key?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      role_change_audit: {
        Row: {
          changed_at: string | null
          changed_by: string | null
          id: string
          ip_address: string | null
          new_role: Database["public"]["Enums"]["app_role"] | null
          old_role: Database["public"]["Enums"]["app_role"] | null
          reason: string | null
          user_id: string
        }
        Insert: {
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          ip_address?: string | null
          new_role?: Database["public"]["Enums"]["app_role"] | null
          old_role?: Database["public"]["Enums"]["app_role"] | null
          reason?: string | null
          user_id: string
        }
        Update: {
          changed_at?: string | null
          changed_by?: string | null
          id?: string
          ip_address?: string | null
          new_role?: Database["public"]["Enums"]["app_role"] | null
          old_role?: Database["public"]["Enums"]["app_role"] | null
          reason?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      pending_confirmations: {
        Row: {
          created_at: string | null
          department_id: string | null
          department_name: string | null
          employee_code: string | null
          employee_id: string | null
          employee_name: string | null
          id: string | null
          ot_date: string | null
          reason: string | null
          supervisor_email: string | null
          supervisor_id: string | null
          supervisor_name: string | null
          supervisor_remarks: string | null
          supervisor_verified_at: string | null
          ticket_number: string | null
          total_hours: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ot_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ot_requests_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_respective_supervisor_confirmations: {
        Row: {
          created_at: string | null
          employee_id: string | null
          employee_name: string | null
          id: string | null
          ot_date: string | null
          respective_supervisor_confirmed_at: string | null
          respective_supervisor_denial_remarks: string | null
          respective_supervisor_denied_at: string | null
          respective_supervisor_id: string | null
          respective_supervisor_name: string | null
          respective_supervisor_remarks: string | null
          status: Database["public"]["Enums"]["ot_status"] | null
          supervisor_confirmation_at: string | null
          supervisor_id: string | null
          supervisor_name: string | null
          supervisor_verified_at: string | null
          total_hours: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ot_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ot_requests_respective_supervisor_id_fkey"
            columns: ["respective_supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ot_requests_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_supervisor_review: {
        Row: {
          created_at: string | null
          employee_id: string | null
          employee_name: string | null
          id: string | null
          ot_date: string | null
          respective_supervisor_denial_remarks: string | null
          respective_supervisor_denied_at: string | null
          respective_supervisor_id: string | null
          respective_supervisor_name: string | null
          status: Database["public"]["Enums"]["ot_status"] | null
          supervisor_id: string | null
          supervisor_verified_at: string | null
          total_hours: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ot_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ot_requests_respective_supervisor_id_fkey"
            columns: ["respective_supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ot_requests_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      calculate_daily_ot_distribution: {
        Args: {
          p_day_type: Database["public"]["Enums"]["day_type"]
          p_employee_id: string
          p_ot_date: string
        }
        Returns: {
          daily_ot_amount: number
          request_id: string
          session_hours: number
          session_hrp: number
          session_orp: number
          session_ot_amount: number
          total_daily_hours: number
        }[]
      }
      calculate_ot_amount: {
        Args: {
          basic_salary: number
          day_type: Database["public"]["Enums"]["day_type"]
          total_hours: number
        }
        Returns: {
          hrp: number
          orp: number
          ot_amount: number
        }[]
      }
      check_ot_eligibility: {
        Args: { _employee_id: string; _ot_date: string }
        Returns: {
          is_eligible: boolean
          reason: string
          rule_id: string
          rule_name: string
        }[]
      }
      check_threshold_violations: {
        Args: {
          _employee_id: string
          _requested_date: string
          _requested_hours: number
        }
        Returns: Json
      }
      count_pending_confirmations: {
        Args: { supervisor_user_id: string }
        Returns: number
      }
      determine_day_type: {
        Args: { ot_date: string }
        Returns: Database["public"]["Enums"]["day_type"]
      }
      evaluate_ot_formula: {
        Args: {
          formula_text: string
          p_basic: number
          p_hours: number
          p_hrp: number
          p_orp: number
        }
        Returns: number
      }
      generate_state_holidays: {
        Args: { in_state_code?: string; in_year: number }
        Returns: {
          description: string
          holiday_date: string
          state_code: string
        }[]
      }
      get_active_formula: {
        Args: {
          _day_type: Database["public"]["Enums"]["day_type"]
          _employee_category: string
          _ot_date: string
        }
        Returns: {
          base_formula: string
          conditional_logic: Json
          formula_id: string
          formula_name: string
          multiplier: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_legacy_ot_request: { Args: { request_id: string }; Returns: boolean }
      lookup_email_by_employee_id: {
        Args: { p_employee_id: string }
        Returns: string
      }
      mark_expired_tokens: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role:
        | "employee"
        | "supervisor"
        | "hr"
        | "bod"
        | "admin"
        | "management"
      day_type: "weekday" | "saturday" | "sunday" | "public_holiday"
      notification_type:
        | "ot_respective_supervisor_denied"
        | "ot_request_respective_supervisor_confirmation"
      ot_status:
        | "pending_verification"
        | "verified"
        | "approved"
        | "reviewed"
        | "rejected"
        | "supervisor_verified"
        | "hr_certified"
        | "bod_approved"
        | "pending_hr_recertification"
        | "management_approved"
        | "pending_supervisor_confirmation"
        | "supervisor_confirmed"
        | "pending_respective_supervisor_confirmation"
        | "respective_supervisor_confirmed"
        | "pending_supervisor_review"
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
      app_role: ["employee", "supervisor", "hr", "bod", "admin", "management"],
      day_type: ["weekday", "saturday", "sunday", "public_holiday"],
      notification_type: [
        "ot_respective_supervisor_denied",
        "ot_request_respective_supervisor_confirmation",
      ],
      ot_status: [
        "pending_verification",
        "verified",
        "approved",
        "reviewed",
        "rejected",
        "supervisor_verified",
        "hr_certified",
        "bod_approved",
        "pending_hr_recertification",
        "management_approved",
        "pending_supervisor_confirmation",
        "supervisor_confirmed",
        "pending_respective_supervisor_confirmation",
        "respective_supervisor_confirmed",
        "pending_supervisor_review",
      ],
    },
  },
} as const
