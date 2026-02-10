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
          {
            foreignKeyName: "activation_tokens_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_imports: {
        Row: {
          created_at: string | null
          date_range_end: string | null
          date_range_start: string | null
          error_count: number
          error_log: Json | null
          file_size_bytes: number | null
          filename: string
          id: string
          record_count: number
          status: Database["public"]["Enums"]["attendance_import_status"]
          success_count: number
          updated_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string | null
          date_range_end?: string | null
          date_range_start?: string | null
          error_count?: number
          error_log?: Json | null
          file_size_bytes?: number | null
          filename: string
          id?: string
          record_count?: number
          status?: Database["public"]["Enums"]["attendance_import_status"]
          success_count?: number
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string | null
          date_range_end?: string | null
          date_range_start?: string | null
          error_count?: number
          error_log?: Json | null
          file_size_bytes?: number | null
          filename?: string
          id?: string
          record_count?: number
          status?: Database["public"]["Enums"]["attendance_import_status"]
          success_count?: number
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_imports_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_imports_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_records: {
        Row: {
          clock_in: string | null
          clock_in_2: string | null
          clock_out: string | null
          clock_out_2: string | null
          created_at: string | null
          created_by: string | null
          date: string
          employee_id: string
          id: string
          import_id: string | null
          is_late: boolean
          late_minutes: number
          notes: string | null
          shift_id: string | null
          source: string
          status: Database["public"]["Enums"]["attendance_record_status"]
          updated_at: string | null
        }
        Insert: {
          clock_in?: string | null
          clock_in_2?: string | null
          clock_out?: string | null
          clock_out_2?: string | null
          created_at?: string | null
          created_by?: string | null
          date: string
          employee_id: string
          id?: string
          import_id?: string | null
          is_late?: boolean
          late_minutes?: number
          notes?: string | null
          shift_id?: string | null
          source?: string
          status?: Database["public"]["Enums"]["attendance_record_status"]
          updated_at?: string | null
        }
        Update: {
          clock_in?: string | null
          clock_in_2?: string | null
          clock_out?: string | null
          clock_out_2?: string | null
          created_at?: string | null
          created_by?: string | null
          date?: string
          employee_id?: string
          id?: string
          import_id?: string | null
          is_late?: boolean
          late_minutes?: number
          notes?: string | null
          shift_id?: string | null
          source?: string
          status?: Database["public"]["Enums"]["attendance_record_status"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "attendance_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_settings: {
        Row: {
          allow_early_clockin: boolean
          allow_multiple_clockin: boolean
          created_at: string | null
          id: number
          is_shift_mandatory: boolean
          late_threshold_minutes: number
          monthly_cutoff_date: number
          updated_at: string | null
        }
        Insert: {
          allow_early_clockin?: boolean
          allow_multiple_clockin?: boolean
          created_at?: string | null
          id?: number
          is_shift_mandatory?: boolean
          late_threshold_minutes?: number
          monthly_cutoff_date?: number
          updated_at?: string | null
        }
        Update: {
          allow_early_clockin?: boolean
          allow_multiple_clockin?: boolean
          created_at?: string | null
          id?: number
          is_shift_mandatory?: boolean
          late_threshold_minutes?: number
          monthly_cutoff_date?: number
          updated_at?: string | null
        }
        Relationships: []
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
      company_locations: {
        Row: {
          address: string | null
          company_id: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          location_name: string
          state_code: string
          state_name: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          location_name: string
          state_code: string
          state_name?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          location_name?: string
          state_code?: string
          state_name?: string | null
          updated_at?: string | null
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
      employee_calendar_assignments: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          calendar_id: string
          created_at: string | null
          employee_id: string
          id: string
          is_manual_override: boolean | null
          notes: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          calendar_id: string
          created_at?: string | null
          employee_id: string
          id?: string
          is_manual_override?: boolean | null
          notes?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          calendar_id?: string
          created_at?: string | null
          employee_id?: string
          id?: string
          is_manual_override?: boolean | null
          notes?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_calendar_assignments_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "holiday_calendars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_calendar_assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_calendar_assignments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_leave: {
        Row: {
          created_at: string
          created_by: string | null
          employee_id: string
          id: string
          leave_date: string
          leave_request_id: string | null
          leave_type: string
          notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          employee_id: string
          id?: string
          leave_date: string
          leave_request_id?: string | null
          leave_type: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          employee_id?: string
          id?: string
          leave_date?: string
          leave_request_id?: string | null
          leave_type?: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_leave_leave_request_id_fkey"
            columns: ["leave_request_id"]
            isOneToOne: false
            referencedRelation: "leave_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_shifts: {
        Row: {
          allow_multiple_clockin: boolean
          created_at: string | null
          effective_date: string
          employee_id: string
          end_date: string | null
          id: string
          is_current: boolean
          shift_id: string
          updated_at: string | null
        }
        Insert: {
          allow_multiple_clockin?: boolean
          created_at?: string | null
          effective_date: string
          employee_id: string
          end_date?: string | null
          id?: string
          is_current?: boolean
          shift_id: string
          updated_at?: string | null
        }
        Update: {
          allow_multiple_clockin?: boolean
          created_at?: string | null
          effective_date?: string
          employee_id?: string
          end_date?: string | null
          id?: string
          is_current?: boolean
          shift_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_shifts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_shifts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_shifts_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
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
          state_codes: string[] | null
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
          state_codes?: string[] | null
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
          state_codes?: string[] | null
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
      holiday_refresh_log: {
        Row: {
          completed_at: string | null
          created_at: string
          errors: Json
          holidays_scraped: number
          id: string
          job_type: string
          result: Json | null
          started_at: string
          status: string
          updated_at: string
          year: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          errors?: Json
          holidays_scraped?: number
          id?: string
          job_type: string
          result?: Json | null
          started_at?: string
          status: string
          updated_at?: string
          year: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          errors?: Json
          holidays_scraped?: number
          id?: string
          job_type?: string
          result?: Json | null
          started_at?: string
          status?: string
          updated_at?: string
          year?: number
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
      leave_balances: {
        Row: {
          adjustment: number
          carried_forward: number
          created_at: string | null
          employee_id: string
          entitled_days: number
          id: string
          leave_type_id: string
          updated_at: string | null
          used_days: number
          year: number
        }
        Insert: {
          adjustment?: number
          carried_forward?: number
          created_at?: string | null
          employee_id: string
          entitled_days?: number
          id?: string
          leave_type_id: string
          updated_at?: string | null
          used_days?: number
          year: number
        }
        Update: {
          adjustment?: number
          carried_forward?: number
          created_at?: string | null
          employee_id?: string
          entitled_days?: number
          id?: string
          leave_type_id?: string
          updated_at?: string | null
          used_days?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "leave_balances_leave_type_id_fkey"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          attachment_urls: string[] | null
          cancellation_reason: string | null
          cancelled_at: string | null
          created_at: string | null
          employee_id: string
          end_date: string
          half_day_period: string | null
          hr_approved_at: string | null
          hr_id: string | null
          hr_remarks: string | null
          id: string
          is_half_day: boolean | null
          leave_type_id: string
          management_approved_at: string | null
          management_id: string | null
          management_remarks: string | null
          reason: string | null
          rejected_at: string | null
          rejected_by: string | null
          rejection_remarks: string | null
          rejection_stage: string | null
          start_date: string
          status: Database["public"]["Enums"]["leave_request_status"]
          supervisor_approved_at: string | null
          supervisor_id: string | null
          supervisor_remarks: string | null
          ticket_number: string
          total_days: number
          updated_at: string | null
        }
        Insert: {
          attachment_urls?: string[] | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          created_at?: string | null
          employee_id: string
          end_date: string
          half_day_period?: string | null
          hr_approved_at?: string | null
          hr_id?: string | null
          hr_remarks?: string | null
          id?: string
          is_half_day?: boolean | null
          leave_type_id: string
          management_approved_at?: string | null
          management_id?: string | null
          management_remarks?: string | null
          reason?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_remarks?: string | null
          rejection_stage?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["leave_request_status"]
          supervisor_approved_at?: string | null
          supervisor_id?: string | null
          supervisor_remarks?: string | null
          ticket_number: string
          total_days: number
          updated_at?: string | null
        }
        Update: {
          attachment_urls?: string[] | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          created_at?: string | null
          employee_id?: string
          end_date?: string
          half_day_period?: string | null
          hr_approved_at?: string | null
          hr_id?: string | null
          hr_remarks?: string | null
          id?: string
          is_half_day?: boolean | null
          leave_type_id?: string
          management_approved_at?: string | null
          management_id?: string | null
          management_remarks?: string | null
          reason?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_remarks?: string | null
          rejection_stage?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["leave_request_status"]
          supervisor_approved_at?: string | null
          supervisor_id?: string | null
          supervisor_remarks?: string | null
          ticket_number?: string
          total_days?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_hr_id_fkey"
            columns: ["hr_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_hr_id_fkey"
            columns: ["hr_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_leave_type_id_fkey"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_management_id_fkey"
            columns: ["management_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_management_id_fkey"
            columns: ["management_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_types: {
        Row: {
          code: string
          created_at: string | null
          default_days: number
          id: string
          is_active: boolean | null
          is_carry_forward: boolean | null
          is_half_day_allowed: boolean | null
          is_paid: boolean | null
          max_carry_forward: number | null
          max_days: number | null
          name: string
          requires_attachment: boolean | null
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          default_days?: number
          id?: string
          is_active?: boolean | null
          is_carry_forward?: boolean | null
          is_half_day_allowed?: boolean | null
          is_paid?: boolean | null
          max_carry_forward?: number | null
          max_days?: number | null
          name: string
          requires_attachment?: boolean | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          default_days?: number
          id?: string
          is_active?: boolean | null
          is_carry_forward?: boolean | null
          is_half_day_allowed?: boolean | null
          is_paid?: boolean | null
          max_carry_forward?: number | null
          max_days?: number | null
          name?: string
          requires_attachment?: boolean | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      malaysian_holidays: {
        Row: {
          created_at: string | null
          date: string
          hr_date_override: string | null
          hr_is_deleted: boolean
          hr_modified_at: string | null
          hr_modified_by: string | null
          hr_name_override: string | null
          hr_override_at: string | null
          hr_override_by: string | null
          hr_override_reason: string | null
          hr_state_override: string | null
          hr_type_override: string | null
          id: string
          is_replacement: boolean
          name: string
          original_holiday_id: string | null
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
          hr_date_override?: string | null
          hr_is_deleted?: boolean
          hr_modified_at?: string | null
          hr_modified_by?: string | null
          hr_name_override?: string | null
          hr_override_at?: string | null
          hr_override_by?: string | null
          hr_override_reason?: string | null
          hr_state_override?: string | null
          hr_type_override?: string | null
          id?: string
          is_replacement?: boolean
          name: string
          original_holiday_id?: string | null
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
          hr_date_override?: string | null
          hr_is_deleted?: boolean
          hr_modified_at?: string | null
          hr_modified_by?: string | null
          hr_name_override?: string | null
          hr_override_at?: string | null
          hr_override_by?: string | null
          hr_override_reason?: string | null
          hr_state_override?: string | null
          hr_type_override?: string | null
          id?: string
          is_replacement?: boolean
          name?: string
          original_holiday_id?: string | null
          scraped_at?: string | null
          source?: string
          state?: string
          type?: string
          updated_at?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "malaysian_holidays_original_holiday_id_fkey"
            columns: ["original_holiday_id"]
            isOneToOne: false
            referencedRelation: "malaysian_holidays"
            referencedColumns: ["id"]
          },
        ]
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
          ot_location_state: string | null
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
          status: Database["public"]["Enums"]["ot_status"]
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
          ot_location_state?: string | null
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
          status: Database["public"]["Enums"]["ot_status"]
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
          ot_location_state?: string | null
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
          status?: Database["public"]["Enums"]["ot_status"]
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
            foreignKeyName: "ot_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
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
            foreignKeyName: "ot_requests_hr_id_fkey"
            columns: ["hr_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
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
            foreignKeyName: "ot_requests_respective_supervisor_id_fkey"
            columns: ["respective_supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ot_requests_respective_supervisor_id_fkey"
            columns: ["respective_supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
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
            foreignKeyName: "ot_requests_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
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
            foreignKeyName: "ot_resubmission_history_resubmitted_request_id_fkey"
            columns: ["resubmitted_request_id"]
            isOneToOne: false
            referencedRelation: "ot_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      ot_settings: {
        Row: {
          active_calendar_id: string | null
          grace_period_enabled: boolean | null
          id: string
          max_daily_hours: number | null
          ot_submission_cutoff_day: number | null
          rounding_rule: string | null
          salary_threshold: number | null
          submission_limit_days: number | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          active_calendar_id?: string | null
          grace_period_enabled?: boolean | null
          id?: string
          max_daily_hours?: number | null
          ot_submission_cutoff_day?: number | null
          rounding_rule?: string | null
          salary_threshold?: number | null
          submission_limit_days?: number | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          active_calendar_id?: string | null
          grace_period_enabled?: boolean | null
          id?: string
          max_daily_hours?: number | null
          ot_submission_cutoff_day?: number | null
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
      password_reset_audit: {
        Row: {
          action: string
          employee_id: string
          id: string
          ip_address: string | null
          notes: string | null
          reset_by_hr_id: string
          timestamp: string | null
        }
        Insert: {
          action: string
          employee_id: string
          id?: string
          ip_address?: string | null
          notes?: string | null
          reset_by_hr_id: string
          timestamp?: string | null
        }
        Update: {
          action?: string
          employee_id?: string
          id?: string
          ip_address?: string | null
          notes?: string | null
          reset_by_hr_id?: string
          timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "password_reset_audit_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "password_reset_audit_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      password_reset_tokens: {
        Row: {
          created_at: string | null
          created_by_role: string | null
          employee_id: string
          expires_at: string
          id: string
          reset_by_hr_id: string
          status: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by_role?: string | null
          employee_id: string
          expires_at: string
          id?: string
          reset_by_hr_id: string
          status?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by_role?: string | null
          employee_id?: string
          expires_at?: string
          id?: string
          reset_by_hr_id?: string
          status?: string
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "password_reset_tokens_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "password_reset_tokens_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
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
          deleted_at: string | null
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
          ot_base: number | null
          password_change_required: boolean | null
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
          deleted_at?: string | null
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
          ot_base?: number | null
          password_change_required?: boolean | null
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
          deleted_at?: string | null
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
          ot_base?: number | null
          password_change_required?: boolean | null
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
          {
            foreignKeyName: "profiles_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_work_location_fkey"
            columns: ["work_location"]
            isOneToOne: false
            referencedRelation: "company_locations"
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
          created_at: string | null
          device_name: string | null
          device_type: string | null
          fcm_token: string
          id: string
          is_active: boolean
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          device_name?: string | null
          device_type?: string | null
          fcm_token: string
          id?: string
          is_active?: boolean
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          device_name?: string | null
          device_type?: string | null
          fcm_token?: string
          id?: string
          is_active?: boolean
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
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
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
      shifts: {
        Row: {
          code: string
          created_at: string | null
          end_time: string
          grace_period_minutes: number
          id: string
          is_active: boolean
          is_overnight: boolean
          name: string
          sort_order: number
          start_time: string
          updated_at: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          end_time: string
          grace_period_minutes?: number
          id?: string
          is_active?: boolean
          is_overnight?: boolean
          name: string
          sort_order?: number
          start_time: string
          updated_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          end_time?: string
          grace_period_minutes?: number
          id?: string
          is_active?: boolean
          is_overnight?: boolean
          name?: string
          sort_order?: number
          start_time?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      state_weekend_config: {
        Row: {
          created_at: string
          effective_from: string
          state_code: string
          weekend_days: number[]
        }
        Insert: {
          created_at?: string
          effective_from: string
          state_code: string
          weekend_days: number[]
        }
        Update: {
          created_at?: string
          effective_from?: string
          state_code?: string
          weekend_days?: number[]
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
      employee_calendar_events: {
        Row: {
          calendar_id: string | null
          description: string | null
          event_source: string | null
          holiday_date: string | null
          holiday_type: string | null
          id: string | null
          is_hr_modified: boolean | null
          is_personal_leave: boolean | null
          is_replacement: boolean | null
          leave_status: string | null
          leave_type: string | null
          state_code: string | null
        }
        Relationships: []
      }
      profiles_safe: {
        Row: {
          basic_salary: number | null
          created_at: string | null
          department_id: string | null
          designation: string | null
          email: string | null
          employee_id: string | null
          employment_type: string | null
          full_name: string | null
          id: string | null
          joining_date: string | null
          position: string | null
          state: string | null
          status: string | null
          supervisor_id: string | null
          updated_at: string | null
          work_location: string | null
        }
        Insert: {
          basic_salary?: never
          created_at?: string | null
          department_id?: string | null
          designation?: string | null
          email?: string | null
          employee_id?: string | null
          employment_type?: string | null
          full_name?: string | null
          id?: string | null
          joining_date?: string | null
          position?: string | null
          state?: string | null
          status?: string | null
          supervisor_id?: string | null
          updated_at?: string | null
          work_location?: string | null
        }
        Update: {
          basic_salary?: never
          created_at?: string | null
          department_id?: string | null
          designation?: string | null
          email?: string | null
          employee_id?: string | null
          employment_type?: string | null
          full_name?: string | null
          id?: string | null
          joining_date?: string | null
          position?: string | null
          state?: string | null
          status?: string | null
          supervisor_id?: string | null
          updated_at?: string | null
          work_location?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_work_location_fkey"
            columns: ["work_location"]
            isOneToOne: false
            referencedRelation: "company_locations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      calculate_daily_ot_distribution: {
        Args: {
          p_day_type?: Database["public"]["Enums"]["day_type"]
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
      calculate_daily_ot_distribution_fixed: {
        Args: {
          p_day_type?: Database["public"]["Enums"]["day_type"]
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
      calculate_replacement_holidays: {
        Args: { p_year: number }
        Returns: {
          original_holiday_id: string
          replacement_date: string
          replacement_name: string
          replacement_source: string
          replacement_state: string
          replacement_type: string
          replacement_year: number
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
      check_profile_auth_email_consistency: {
        Args: never
        Returns: Record<string, unknown>[]
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
      determine_day_type_for_employee: {
        Args: { p_employee_id: string; p_ot_date: string }
        Returns: Database["public"]["Enums"]["day_type"]
      }
      determine_day_type_for_state: {
        Args: { location_state?: string; ot_date: string }
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
      get_accessible_profile: {
        Args: { profile_id: string }
        Returns: {
          basic_salary: number
          created_at: string
          department_id: string
          designation: string
          email: string
          employee_id: string
          employment_type: string
          full_name: string
          id: string
          joining_date: string
          position: string
          state: string
          status: string
          supervisor_id: string
          updated_at: string
          work_location: string
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
      get_employee_calendar: {
        Args: { _employee_id: string }
        Returns: {
          calendar_id: string
          calendar_name: string
          calendar_state_name: string
          is_override: boolean
          state_codes: string[]
        }[]
      }
      get_state_from_location: {
        Args: { _location_name: string }
        Returns: string
      }
      get_state_weekend_days: {
        Args: { p_date: string; p_state_code: string }
        Returns: number[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hr_delete_malaysian_holiday: {
        Args: { p_holiday_id: string }
        Returns: undefined
      }
      hr_modify_malaysian_holiday: {
        Args: {
          p_holiday_id: string
          p_new_date: string
          p_new_name: string
          p_new_state: string
          p_new_type: string
        }
        Returns: undefined
      }
      hr_modify_replacement_holiday: {
        Args: {
          p_holiday_id: string
          p_new_date: string
          p_new_name: string
          p_reason: string
        }
        Returns: undefined
      }
      hr_override_replacement_holiday: {
        Args: { p_action: string; p_holiday_id: string; p_reason: string }
        Returns: undefined
      }
      insert_replacement_holidays: { Args: { p_year: number }; Returns: number }
      is_legacy_ot_request: { Args: { request_id: string }; Returns: boolean }
      lookup_email_by_employee_id: {
        Args: { p_employee_id: string }
        Returns: string
      }
      mark_expired_tokens: { Args: never; Returns: undefined }
      run_daily_replacement_holiday_check: { Args: never; Returns: undefined }
      trigger_scheduled_holiday_refresh: {
        Args: { p_job_type: string; p_year: number }
        Returns: undefined
      }
      update_user_roles: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: {
          error_message: string
          success: boolean
        }[]
      }
      validate_role_combination: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: {
          error_message: string
          is_valid: boolean
        }[]
      }
    }
    Enums: {
      app_role:
        | "employee"
        | "supervisor"
        | "hr"
        | "bod"
        | "admin"
        | "management"
        | "finance"
      attendance_import_status:
        | "pending"
        | "processing"
        | "completed"
        | "failed"
        | "partial"
      attendance_record_status:
        | "present"
        | "late"
        | "absent"
        | "half_day"
        | "on_leave"
        | "holiday"
        | "rest_day"
      day_type: "weekday" | "saturday" | "sunday" | "public_holiday"
      leave_request_status:
        | "pending_supervisor"
        | "supervisor_approved"
        | "pending_hr"
        | "hr_approved"
        | "pending_management"
        | "management_approved"
        | "rejected"
        | "cancelled"
      notification_type:
        | "ot_respective_supervisor_denied"
        | "ot_request_respective_supervisor_confirmation"
      ot_status:
        | "pending_verification"
        | "supervisor_confirmed"
        | "pending_respective_supervisor_confirmation"
        | "respective_supervisor_confirmed"
        | "pending_supervisor_verification"
        | "supervisor_verified"
        | "hr_certified"
        | "management_approved"
        | "rejected"
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
      app_role: [
        "employee",
        "supervisor",
        "hr",
        "bod",
        "admin",
        "management",
        "finance",
      ],
      attendance_import_status: [
        "pending",
        "processing",
        "completed",
        "failed",
        "partial",
      ],
      attendance_record_status: [
        "present",
        "late",
        "absent",
        "half_day",
        "on_leave",
        "holiday",
        "rest_day",
      ],
      day_type: ["weekday", "saturday", "sunday", "public_holiday"],
      leave_request_status: [
        "pending_supervisor",
        "supervisor_approved",
        "pending_hr",
        "hr_approved",
        "pending_management",
        "management_approved",
        "rejected",
        "cancelled",
      ],
      notification_type: [
        "ot_respective_supervisor_denied",
        "ot_request_respective_supervisor_confirmation",
      ],
      ot_status: [
        "pending_verification",
        "supervisor_confirmed",
        "pending_respective_supervisor_confirmation",
        "respective_supervisor_confirmed",
        "pending_supervisor_verification",
        "supervisor_verified",
        "hr_certified",
        "management_approved",
        "rejected",
      ],
    },
  },
} as const
