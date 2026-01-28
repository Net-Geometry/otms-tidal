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
      profiles: {
        Row: {
          basic_salary: number
          ot_base: number | null
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
          ot_base?: number | null
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
          ot_base?: number | null
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
            foreignKeyName: "profiles_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }

      // Allow access to tables not yet included in this generated typing.
      // This keeps the Supabase client usable even when the schema has moved on.
      [key: string]: any
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
      app_role:
        | "employee"
        | "supervisor"
        | "hr"
        | "bod"
        | "admin"
        | "management"
      day_type: "weekday" | "saturday" | "sunday" | "public_holiday"
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

export const Constants = {
  public: {
    Enums: {
      app_role: ["employee", "supervisor", "hr", "bod", "admin", "management"],
      day_type: ["weekday", "saturday", "sunday", "public_holiday"],
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
