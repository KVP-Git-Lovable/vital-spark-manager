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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      appointments: {
        Row: {
          created_at: string
          end_time: string
          id: string
          is_recurring: boolean | null
          patient_id: string | null
          patient_name: string | null
          problem_area_ids: string[] | null
          recurrence_end_date: string | null
          recurrence_pattern: string | null
          service: string
          source: string | null
          staff_id: string | null
          start_time: string
          status: string
          survey_template_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_time: string
          id?: string
          is_recurring?: boolean | null
          patient_id?: string | null
          patient_name?: string | null
          problem_area_ids?: string[] | null
          recurrence_end_date?: string | null
          recurrence_pattern?: string | null
          service: string
          source?: string | null
          staff_id?: string | null
          start_time: string
          status?: string
          survey_template_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_time?: string
          id?: string
          is_recurring?: boolean | null
          patient_id?: string | null
          patient_name?: string | null
          problem_area_ids?: string[] | null
          recurrence_end_date?: string | null
          recurrence_pattern?: string | null
          service?: string
          source?: string | null
          staff_id?: string | null
          start_time?: string
          status?: string
          survey_template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_survey_template_id_fkey"
            columns: ["survey_template_id"]
            isOneToOne: false
            referencedRelation: "survey_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_issues: {
        Row: {
          asset_id: string
          cost: number | null
          created_at: string
          description: string | null
          id: string
          priority: string
          reported_by: string | null
          reported_date: string
          resolution_notes: string | null
          resolved_date: string | null
          status: string
          title: string
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          asset_id: string
          cost?: number | null
          created_at?: string
          description?: string | null
          id?: string
          priority?: string
          reported_by?: string | null
          reported_date?: string
          resolution_notes?: string | null
          resolved_date?: string | null
          status?: string
          title: string
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          asset_id?: string
          cost?: number | null
          created_at?: string
          description?: string | null
          id?: string
          priority?: string
          reported_by?: string | null
          reported_date?: string
          resolution_notes?: string | null
          resolved_date?: string | null
          status?: string
          title?: string
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_issues_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_issues_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_service_links: {
        Row: {
          asset_id: string
          created_at: string
          id: string
          is_required: boolean | null
          notes: string | null
          service_id: string
          time_taken: number | null
          usage_guideline: string | null
        }
        Insert: {
          asset_id: string
          created_at?: string
          id?: string
          is_required?: boolean | null
          notes?: string | null
          service_id: string
          time_taken?: number | null
          usage_guideline?: string | null
        }
        Update: {
          asset_id?: string
          created_at?: string
          id?: string
          is_required?: boolean | null
          notes?: string | null
          service_id?: string
          time_taken?: number | null
          usage_guideline?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_service_links_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_service_links_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          amc_cost: number | null
          amc_end_date: string | null
          amc_start_date: string | null
          amc_terms: string | null
          amc_vendor_id: string | null
          asset_code: string | null
          category: string
          condition: string | null
          created_at: string
          description: string | null
          id: string
          invoice_number: string | null
          location: string | null
          manufacturer: string | null
          model_number: string | null
          name: string
          notes: string | null
          purchase_date: string | null
          purchase_price: number | null
          serial_number: string | null
          status: string
          updated_at: string
          vendor_id: string | null
          warranty_end_date: string | null
          warranty_start_date: string | null
          warranty_terms: string | null
        }
        Insert: {
          amc_cost?: number | null
          amc_end_date?: string | null
          amc_start_date?: string | null
          amc_terms?: string | null
          amc_vendor_id?: string | null
          asset_code?: string | null
          category?: string
          condition?: string | null
          created_at?: string
          description?: string | null
          id?: string
          invoice_number?: string | null
          location?: string | null
          manufacturer?: string | null
          model_number?: string | null
          name: string
          notes?: string | null
          purchase_date?: string | null
          purchase_price?: number | null
          serial_number?: string | null
          status?: string
          updated_at?: string
          vendor_id?: string | null
          warranty_end_date?: string | null
          warranty_start_date?: string | null
          warranty_terms?: string | null
        }
        Update: {
          amc_cost?: number | null
          amc_end_date?: string | null
          amc_start_date?: string | null
          amc_terms?: string | null
          amc_vendor_id?: string | null
          asset_code?: string | null
          category?: string
          condition?: string | null
          created_at?: string
          description?: string | null
          id?: string
          invoice_number?: string | null
          location?: string | null
          manufacturer?: string | null
          model_number?: string | null
          name?: string
          notes?: string | null
          purchase_date?: string | null
          purchase_price?: number | null
          serial_number?: string | null
          status?: string
          updated_at?: string
          vendor_id?: string | null
          warranty_end_date?: string | null
          warranty_start_date?: string | null
          warranty_terms?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_amc_vendor_id_fkey"
            columns: ["amc_vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_records: {
        Row: {
          check_in_photo: string | null
          check_in_time: string | null
          check_out_photo: string | null
          check_out_time: string | null
          created_at: string
          date: string
          id: string
          staff_id: string
          status: string
          updated_at: string
        }
        Insert: {
          check_in_photo?: string | null
          check_in_time?: string | null
          check_out_photo?: string | null
          check_out_time?: string | null
          created_at?: string
          date?: string
          id?: string
          staff_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          check_in_photo?: string | null
          check_in_time?: string | null
          check_out_photo?: string | null
          check_out_time?: string | null
          created_at?: string
          date?: string
          id?: string
          staff_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      cart_items: {
        Row: {
          created_at: string
          id: string
          patient_id: string
          product_id: string
          quantity: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          patient_id: string
          product_id: string
          quantity?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          patient_id?: string
          product_id?: string
          quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "pharma_products"
            referencedColumns: ["id"]
          },
        ]
      }
      category_master: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      clinic_settings: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          email: string | null
          gst_number: string | null
          id: string
          logo_url: string | null
          name: string
          phone: string | null
          pincode: string | null
          state: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          gst_number?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          phone?: string | null
          pincode?: string | null
          state?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          gst_number?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          phone?: string | null
          pincode?: string | null
          state?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      doctors: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          specialization: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          specialization?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          specialization?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      expense_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          attachment_name: string | null
          attachment_url: string | null
          category_id: string | null
          created_at: string
          description: string | null
          expense_date: string
          id: string
          notes: string | null
          payment_mode: string | null
          reference_number: string | null
          title: string
          updated_at: string
          vendor_name: string | null
        }
        Insert: {
          amount?: number
          attachment_name?: string | null
          attachment_url?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          expense_date?: string
          id?: string
          notes?: string | null
          payment_mode?: string | null
          reference_number?: string | null
          title: string
          updated_at?: string
          vendor_name?: string | null
        }
        Update: {
          amount?: number
          attachment_name?: string | null
          attachment_url?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          expense_date?: string
          id?: string
          notes?: string | null
          payment_mode?: string | null
          reference_number?: string | null
          title?: string
          updated_at?: string
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          appointment_id: string | null
          created_at: string
          id: string
          invoice_number: string
          notes: string | null
          paid_amount: number
          patient_id: string | null
          patient_name: string | null
          payment_mode: string | null
          payment_type: string
          services: string[]
          status: string
          tax_amount: number | null
          tax_id: string | null
          tax_rate: number | null
          total_amount: number
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          created_at?: string
          id?: string
          invoice_number: string
          notes?: string | null
          paid_amount?: number
          patient_id?: string | null
          patient_name?: string | null
          payment_mode?: string | null
          payment_type?: string
          services?: string[]
          status?: string
          tax_amount?: number | null
          tax_id?: string | null
          tax_rate?: number | null
          total_amount?: number
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          created_at?: string
          id?: string
          invoice_number?: string
          notes?: string | null
          paid_amount?: number
          patient_id?: string | null
          patient_name?: string | null
          payment_mode?: string | null
          payment_type?: string
          services?: string[]
          status?: string
          tax_amount?: number | null
          tax_id?: string | null
          tax_rate?: number | null
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_tax_id_fkey"
            columns: ["tax_id"]
            isOneToOne: false
            referencedRelation: "tax_master"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_applications: {
        Row: {
          approved_by: string | null
          created_at: string
          days: number
          end_date: string
          id: string
          leave_type_id: string
          reason: string | null
          staff_id: string
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          days?: number
          end_date: string
          id?: string
          leave_type_id: string
          reason?: string | null
          staff_id: string
          start_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          days?: number
          end_date?: string
          id?: string
          leave_type_id?: string
          reason?: string | null
          staff_id?: string
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_applications_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_applications_leave_type_id_fkey"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_applications_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_types: {
        Row: {
          created_at: string
          default_days_per_year: number
          description: string | null
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          created_at?: string
          default_days_per_year?: number
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          created_at?: string
          default_days_per_year?: number
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      patient_family_members: {
        Row: {
          created_at: string
          id: string
          is_primary_contact: boolean | null
          name: string | null
          notes: string | null
          patient_id: string
          phone: string | null
          related_patient_id: string | null
          relationship: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_primary_contact?: boolean | null
          name?: string | null
          notes?: string | null
          patient_id: string
          phone?: string | null
          related_patient_id?: string | null
          relationship: string
        }
        Update: {
          created_at?: string
          id?: string
          is_primary_contact?: boolean | null
          name?: string | null
          notes?: string | null
          patient_id?: string
          phone?: string | null
          related_patient_id?: string | null
          relationship?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_family_members_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_family_members_related_patient_id_fkey"
            columns: ["related_patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_feedback: {
        Row: {
          appointment_id: string
          created_at: string
          id: string
          nps_score: number
          patient_id: string
          patient_name: string | null
          service_rating: number
        }
        Insert: {
          appointment_id: string
          created_at?: string
          id?: string
          nps_score: number
          patient_id: string
          patient_name?: string | null
          service_rating: number
        }
        Update: {
          appointment_id?: string
          created_at?: string
          id?: string
          nps_score?: number
          patient_id?: string
          patient_name?: string | null
          service_rating?: number
        }
        Relationships: [
          {
            foreignKeyName: "patient_feedback_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: true
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_pharma_requests: {
        Row: {
          created_at: string | null
          id: string
          notes: string | null
          patient_id: string
          product_id: string | null
          product_name: string
          quantity: number | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          notes?: string | null
          patient_id: string
          product_id?: string | null
          product_name: string
          quantity?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          notes?: string | null
          patient_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_pharma_requests_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_pharma_requests_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "pharma_products"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_photos: {
        Row: {
          appointment_id: string | null
          created_at: string
          id: string
          notes: string | null
          patient_id: string
          photo_type: string
          photo_url: string
          procedure_id: string | null
          taken_at: string
        }
        Insert: {
          appointment_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          patient_id: string
          photo_type?: string
          photo_url: string
          procedure_id?: string | null
          taken_at?: string
        }
        Update: {
          appointment_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          patient_id?: string
          photo_type?: string
          photo_url?: string
          procedure_id?: string | null
          taken_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_photos_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_photos_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_photos_procedure_id_fkey"
            columns: ["procedure_id"]
            isOneToOne: false
            referencedRelation: "procedures"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_portal_tokens: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          is_used: boolean | null
          otp_code: string
          patient_id: string
          phone: string | null
          session_token: string | null
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          is_used?: boolean | null
          otp_code: string
          patient_id: string
          phone?: string | null
          session_token?: string | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          is_used?: boolean | null
          otp_code?: string
          patient_id?: string
          phone?: string | null
          session_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_portal_tokens_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          address: string | null
          allergies: string | null
          auth_user_id: string | null
          blood_group: string | null
          city: string | null
          created_at: string
          current_medications: string | null
          date_of_birth: string | null
          doctor_id: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          facebook_url: string | null
          first_name: string
          follows_facebook: boolean | null
          follows_instagram: boolean | null
          gender: string | null
          id: string
          instagram_url: string | null
          last_name: string
          medical_history: string | null
          notes: string | null
          phone: string | null
          pincode: string | null
          previous_treatments: string | null
          skin_concerns: string | null
          skin_type: string | null
          source: string | null
          source_ad_details: string | null
          source_referral_doctor: string | null
          state: string | null
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          allergies?: string | null
          auth_user_id?: string | null
          blood_group?: string | null
          city?: string | null
          created_at?: string
          current_medications?: string | null
          date_of_birth?: string | null
          doctor_id?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          facebook_url?: string | null
          first_name: string
          follows_facebook?: boolean | null
          follows_instagram?: boolean | null
          gender?: string | null
          id?: string
          instagram_url?: string | null
          last_name: string
          medical_history?: string | null
          notes?: string | null
          phone?: string | null
          pincode?: string | null
          previous_treatments?: string | null
          skin_concerns?: string | null
          skin_type?: string | null
          source?: string | null
          source_ad_details?: string | null
          source_referral_doctor?: string | null
          state?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          allergies?: string | null
          auth_user_id?: string | null
          blood_group?: string | null
          city?: string | null
          created_at?: string
          current_medications?: string | null
          date_of_birth?: string | null
          doctor_id?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          facebook_url?: string | null
          first_name?: string
          follows_facebook?: boolean | null
          follows_instagram?: boolean | null
          gender?: string | null
          id?: string
          instagram_url?: string | null
          last_name?: string
          medical_history?: string | null
          notes?: string | null
          phone?: string | null
          pincode?: string | null
          previous_treatments?: string | null
          skin_concerns?: string | null
          skin_type?: string | null
          source?: string | null
          source_ad_details?: string | null
          source_referral_doctor?: string | null
          state?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patients_doctor_id_fkey"
            columns: ["doctor_id"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
        ]
      }
      pharma_bill_items: {
        Row: {
          batch_number: string | null
          bill_id: string
          created_at: string
          id: string
          inventory_id: string | null
          product_id: string | null
          product_name: string
          quantity: number
          total_price: number
          unit_price: number
        }
        Insert: {
          batch_number?: string | null
          bill_id: string
          created_at?: string
          id?: string
          inventory_id?: string | null
          product_id?: string | null
          product_name: string
          quantity?: number
          total_price?: number
          unit_price?: number
        }
        Update: {
          batch_number?: string | null
          bill_id?: string
          created_at?: string
          id?: string
          inventory_id?: string | null
          product_id?: string | null
          product_name?: string
          quantity?: number
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "pharma_bill_items_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "pharma_bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pharma_bill_items_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "pharma_inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pharma_bill_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "pharma_products"
            referencedColumns: ["id"]
          },
        ]
      }
      pharma_bills: {
        Row: {
          bill_number: string
          created_at: string
          discount: number
          id: string
          net_amount: number
          patient_id: string | null
          patient_name: string | null
          payment_mode: string
          status: string
          tax_amount: number | null
          tax_id: string | null
          tax_rate: number | null
          total_amount: number
        }
        Insert: {
          bill_number: string
          created_at?: string
          discount?: number
          id?: string
          net_amount?: number
          patient_id?: string | null
          patient_name?: string | null
          payment_mode?: string
          status?: string
          tax_amount?: number | null
          tax_id?: string | null
          tax_rate?: number | null
          total_amount?: number
        }
        Update: {
          bill_number?: string
          created_at?: string
          discount?: number
          id?: string
          net_amount?: number
          patient_id?: string | null
          patient_name?: string | null
          payment_mode?: string
          status?: string
          tax_amount?: number | null
          tax_id?: string | null
          tax_rate?: number | null
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "pharma_bills_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pharma_bills_tax_id_fkey"
            columns: ["tax_id"]
            isOneToOne: false
            referencedRelation: "tax_master"
            referencedColumns: ["id"]
          },
        ]
      }
      pharma_inventory: {
        Row: {
          batch_number: string
          created_at: string
          expiry_date: string
          id: string
          invoice_number: string | null
          product_id: string
          purchase_price: number
          quantity: number
          received_date: string
          supplier: string | null
        }
        Insert: {
          batch_number: string
          created_at?: string
          expiry_date: string
          id?: string
          invoice_number?: string | null
          product_id: string
          purchase_price?: number
          quantity?: number
          received_date?: string
          supplier?: string | null
        }
        Update: {
          batch_number?: string
          created_at?: string
          expiry_date?: string
          id?: string
          invoice_number?: string | null
          product_id?: string
          purchase_price?: number
          quantity?: number
          received_date?: string
          supplier?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pharma_inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "pharma_products"
            referencedColumns: ["id"]
          },
        ]
      }
      pharma_products: {
        Row: {
          category: string
          created_at: string
          expiry_date: string | null
          generic_name: string | null
          gst_percent: number
          hsn_code: string | null
          id: string
          image_url: string | null
          manufacturer: string | null
          mrp: number
          name: string
          qty_per_unit: number | null
          reorder_level: number
          selling_price: number
          unit: string
          updated_at: string
          vendor_id: string | null
        }
        Insert: {
          category?: string
          created_at?: string
          expiry_date?: string | null
          generic_name?: string | null
          gst_percent?: number
          hsn_code?: string | null
          id?: string
          image_url?: string | null
          manufacturer?: string | null
          mrp?: number
          name: string
          qty_per_unit?: number | null
          reorder_level?: number
          selling_price?: number
          unit?: string
          updated_at?: string
          vendor_id?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          expiry_date?: string | null
          generic_name?: string | null
          gst_percent?: number
          hsn_code?: string | null
          id?: string
          image_url?: string | null
          manufacturer?: string | null
          mrp?: number
          name?: string
          qty_per_unit?: number | null
          reorder_level?: number
          selling_price?: number
          unit?: string
          updated_at?: string
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pharma_products_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          product_id: string | null
          product_name: string
          quantity: number
          total_price: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          product_id?: string | null
          product_name: string
          quantity?: number
          total_price?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "portal_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "portal_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "pharma_products"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_orders: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          delivery_method: string
          id: string
          notes: string | null
          patient_id: string
          patient_name: string | null
          payment_mode: string | null
          payment_status: string
          phone: string | null
          pincode: string | null
          state: string | null
          status: string
          total_amount: number
          tracking_number: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          delivery_method?: string
          id?: string
          notes?: string | null
          patient_id: string
          patient_name?: string | null
          payment_mode?: string | null
          payment_status?: string
          phone?: string | null
          pincode?: string | null
          state?: string | null
          status?: string
          total_amount?: number
          tracking_number?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          delivery_method?: string
          id?: string
          notes?: string | null
          patient_id?: string
          patient_name?: string | null
          payment_mode?: string | null
          payment_status?: string
          phone?: string | null
          pincode?: string | null
          state?: string | null
          status?: string
          total_amount?: number
          tracking_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_orders_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_settings: {
        Row: {
          created_at: string
          expiring_threshold_days: number
          hide_expiring_products: boolean
          id: string
          low_stock_threshold: number | null
          out_of_stock_behavior: string
          shop_enabled: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          expiring_threshold_days?: number
          hide_expiring_products?: boolean
          id?: string
          low_stock_threshold?: number | null
          out_of_stock_behavior?: string
          shop_enabled?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          expiring_threshold_days?: number
          hide_expiring_products?: boolean
          id?: string
          low_stock_threshold?: number | null
          out_of_stock_behavior?: string
          shop_enabled?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      prescriptions: {
        Row: {
          created_at: string
          dosage: string | null
          duration: string | null
          frequency: string | null
          id: string
          instructions: string | null
          medicine_name: string
          procedure_id: string
          product_id: string | null
          quantity: number
        }
        Insert: {
          created_at?: string
          dosage?: string | null
          duration?: string | null
          frequency?: string | null
          id?: string
          instructions?: string | null
          medicine_name: string
          procedure_id: string
          product_id?: string | null
          quantity?: number
        }
        Update: {
          created_at?: string
          dosage?: string | null
          duration?: string | null
          frequency?: string | null
          id?: string
          instructions?: string | null
          medicine_name?: string
          procedure_id?: string
          product_id?: string | null
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "prescriptions_procedure_id_fkey"
            columns: ["procedure_id"]
            isOneToOne: false
            referencedRelation: "procedures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "pharma_products"
            referencedColumns: ["id"]
          },
        ]
      }
      problem_areas: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      procedure_attachments: {
        Row: {
          appointment_id: string | null
          created_at: string
          file_name: string
          file_url: string
          id: string
          notes: string | null
          patient_id: string
          procedure_id: string
        }
        Insert: {
          appointment_id?: string | null
          created_at?: string
          file_name: string
          file_url: string
          id?: string
          notes?: string | null
          patient_id: string
          procedure_id: string
        }
        Update: {
          appointment_id?: string | null
          created_at?: string
          file_name?: string
          file_url?: string
          id?: string
          notes?: string | null
          patient_id?: string
          procedure_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "procedure_attachments_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procedure_attachments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procedure_attachments_procedure_id_fkey"
            columns: ["procedure_id"]
            isOneToOne: false
            referencedRelation: "procedures"
            referencedColumns: ["id"]
          },
        ]
      }
      procedures: {
        Row: {
          appointment_id: string | null
          assisted_by: string | null
          consultation_notes: string | null
          created_at: string
          diagnosis: string | null
          id: string
          patient_id: string
          procedure_date: string
          procedure_notes: string | null
          recommendations: string | null
          service_name: string
          staff_id: string | null
          status: string
          symptoms: string | null
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          assisted_by?: string | null
          consultation_notes?: string | null
          created_at?: string
          diagnosis?: string | null
          id?: string
          patient_id: string
          procedure_date?: string
          procedure_notes?: string | null
          recommendations?: string | null
          service_name: string
          staff_id?: string | null
          status?: string
          symptoms?: string | null
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          assisted_by?: string | null
          consultation_notes?: string | null
          created_at?: string
          diagnosis?: string | null
          id?: string
          patient_id?: string
          procedure_date?: string
          procedure_notes?: string | null
          recommendations?: string | null
          service_name?: string
          staff_id?: string | null
          status?: string
          symptoms?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "procedures_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procedures_assisted_by_fkey"
            columns: ["assisted_by"]
            isOneToOne: false
            referencedRelation: "doctors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procedures_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "procedures_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      product_prices: {
        Row: {
          created_at: string
          effective_from: string
          effective_to: string | null
          gst_percent: number
          id: string
          is_active: boolean
          mrp: number
          notes: string | null
          product_id: string
          purchase_price: number
          selling_price: number
        }
        Insert: {
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          gst_percent?: number
          id?: string
          is_active?: boolean
          mrp?: number
          notes?: string | null
          product_id: string
          purchase_price?: number
          selling_price?: number
        }
        Update: {
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          gst_percent?: number
          id?: string
          is_active?: boolean
          mrp?: number
          notes?: string | null
          product_id?: string
          purchase_price?: number
          selling_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "pharma_products"
            referencedColumns: ["id"]
          },
        ]
      }
      report_folders: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      saved_reports: {
        Row: {
          chart_type: string
          columns: Json
          created_at: string
          description: string | null
          display_options: Json | null
          filters: Json
          folder_id: string | null
          group_columns: Json
          group_rows: Json
          id: string
          name: string
          primary_object: string
          related_object: string | null
          updated_at: string
        }
        Insert: {
          chart_type?: string
          columns?: Json
          created_at?: string
          description?: string | null
          display_options?: Json | null
          filters?: Json
          folder_id?: string | null
          group_columns?: Json
          group_rows?: Json
          id?: string
          name: string
          primary_object: string
          related_object?: string | null
          updated_at?: string
        }
        Update: {
          chart_type?: string
          columns?: Json
          created_at?: string
          description?: string | null
          display_options?: Json | null
          filters?: Json
          folder_id?: string | null
          group_columns?: Json
          group_rows?: Json
          id?: string
          name?: string
          primary_object?: string
          related_object?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_reports_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "report_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      service_medicines: {
        Row: {
          created_at: string
          duration: string | null
          frequency: string | null
          id: string
          instructions: string | null
          product_id: string
          service_id: string
        }
        Insert: {
          created_at?: string
          duration?: string | null
          frequency?: string | null
          id?: string
          instructions?: string | null
          product_id: string
          service_id: string
        }
        Update: {
          created_at?: string
          duration?: string | null
          frequency?: string | null
          id?: string
          instructions?: string | null
          product_id?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_medicines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "pharma_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_medicines_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          category: string
          created_at: string
          diagnosis: string | null
          duration: number
          id: string
          name: string
          price: number
          procedure_notes: string | null
          recommendations: string[] | null
          symptoms: string | null
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          diagnosis?: string | null
          duration?: number
          id?: string
          name: string
          price?: number
          procedure_notes?: string | null
          recommendations?: string[] | null
          symptoms?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          diagnosis?: string | null
          duration?: number
          id?: string
          name?: string
          price?: number
          procedure_notes?: string | null
          recommendations?: string[] | null
          symptoms?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      staff: {
        Row: {
          created_at: string
          email: string | null
          first_name: string
          id: string
          is_active: boolean | null
          last_name: string
          phone: string | null
          photo_url: string | null
          role: string
          specialization: string | null
          updated_at: string
          work_end_time: string | null
          work_start_time: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          first_name: string
          id?: string
          is_active?: boolean | null
          last_name: string
          phone?: string | null
          photo_url?: string | null
          role: string
          specialization?: string | null
          updated_at?: string
          work_end_time?: string | null
          work_start_time?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          first_name?: string
          id?: string
          is_active?: boolean | null
          last_name?: string
          phone?: string | null
          photo_url?: string | null
          role?: string
          specialization?: string | null
          updated_at?: string
          work_end_time?: string | null
          work_start_time?: string | null
        }
        Relationships: []
      }
      staff_aspirations: {
        Row: {
          created_at: string
          description: string | null
          id: string
          staff_id: string
          status: string
          target_date: string | null
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          staff_id: string
          status?: string
          target_date?: string | null
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          staff_id?: string
          status?: string
          target_date?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_aspirations_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_education: {
        Row: {
          created_at: string
          degree: string
          end_year: number | null
          field_of_study: string | null
          id: string
          institution: string
          notes: string | null
          staff_id: string
          start_year: number | null
        }
        Insert: {
          created_at?: string
          degree: string
          end_year?: number | null
          field_of_study?: string | null
          id?: string
          institution: string
          notes?: string | null
          staff_id: string
          start_year?: number | null
        }
        Update: {
          created_at?: string
          degree?: string
          end_year?: number | null
          field_of_study?: string | null
          id?: string
          institution?: string
          notes?: string | null
          staff_id?: string
          start_year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_education_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_experience: {
        Row: {
          company: string
          created_at: string
          end_date: string | null
          id: string
          notes: string | null
          staff_id: string
          start_date: string | null
          title: string
        }
        Insert: {
          company: string
          created_at?: string
          end_date?: string | null
          id?: string
          notes?: string | null
          staff_id: string
          start_date?: string | null
          title: string
        }
        Update: {
          company?: string
          created_at?: string
          end_date?: string | null
          id?: string
          notes?: string | null
          staff_id?: string
          start_date?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_experience_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_leave_balances: {
        Row: {
          created_at: string
          id: string
          leave_type_id: string
          opening_balance: number
          staff_id: string
          updated_at: string
          used: number
          year: number
        }
        Insert: {
          created_at?: string
          id?: string
          leave_type_id: string
          opening_balance?: number
          staff_id: string
          updated_at?: string
          used?: number
          year?: number
        }
        Update: {
          created_at?: string
          id?: string
          leave_type_id?: string
          opening_balance?: number
          staff_id?: string
          updated_at?: string
          used?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "staff_leave_balances_leave_type_id_fkey"
            columns: ["leave_type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_leave_balances_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_requests: {
        Row: {
          created_at: string
          description: string | null
          id: string
          priority: string
          resolved_at: string | null
          staff_id: string
          status: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          priority?: string
          resolved_at?: string | null
          staff_id: string
          status?: string
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          priority?: string
          resolved_at?: string | null
          staff_id?: string
          status?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_requests_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          permissions: string[] | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          permissions?: string[] | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          permissions?: string[] | null
        }
        Relationships: []
      }
      survey_questions: {
        Row: {
          created_at: string
          id: string
          ideal_answer: Json | null
          options: Json | null
          question_text: string
          question_type: string
          sort_order: number
          template_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          ideal_answer?: Json | null
          options?: Json | null
          question_text: string
          question_type?: string
          sort_order?: number
          template_id: string
        }
        Update: {
          created_at?: string
          id?: string
          ideal_answer?: Json | null
          options?: Json | null
          question_text?: string
          question_type?: string
          sort_order?: number
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_questions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "survey_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_responses: {
        Row: {
          ai_products: Json | null
          ai_recommendation: Json | null
          ai_services: Json | null
          answers: Json | null
          appointment_id: string | null
          created_at: string
          dr_notes: string | null
          dr_status: string
          id: string
          patient_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          template_id: string
        }
        Insert: {
          ai_products?: Json | null
          ai_recommendation?: Json | null
          ai_services?: Json | null
          answers?: Json | null
          appointment_id?: string | null
          created_at?: string
          dr_notes?: string | null
          dr_status?: string
          id?: string
          patient_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          template_id: string
        }
        Update: {
          ai_products?: Json | null
          ai_recommendation?: Json | null
          ai_services?: Json | null
          answers?: Json | null
          appointment_id?: string | null
          created_at?: string
          dr_notes?: string | null
          dr_status?: string
          id?: string
          patient_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_responses_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_responses_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_responses_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_responses_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "survey_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_template_products: {
        Row: {
          advice_text: string | null
          created_at: string
          id: string
          product_id: string
          template_id: string
        }
        Insert: {
          advice_text?: string | null
          created_at?: string
          id?: string
          product_id: string
          template_id: string
        }
        Update: {
          advice_text?: string | null
          created_at?: string
          id?: string
          product_id?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_template_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "pharma_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_template_products_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "survey_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_template_services: {
        Row: {
          advice_text: string | null
          created_at: string
          id: string
          service_id: string
          template_id: string
        }
        Insert: {
          advice_text?: string | null
          created_at?: string
          id?: string
          service_id: string
          template_id: string
        }
        Update: {
          advice_text?: string | null
          created_at?: string
          id?: string
          service_id?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_template_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_template_services_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "survey_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_templates: {
        Row: {
          age_range_max: number | null
          age_range_min: number | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          problem_area_id: string | null
          service_id: string | null
          updated_at: string
        }
        Insert: {
          age_range_max?: number | null
          age_range_min?: number | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          problem_area_id?: string | null
          service_id?: string | null
          updated_at?: string
        }
        Update: {
          age_range_max?: number | null
          age_range_min?: number | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          problem_area_id?: string | null
          service_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_templates_problem_area_id_fkey"
            columns: ["problem_area_id"]
            isOneToOne: false
            referencedRelation: "problem_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_templates_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_master: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          rate: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          rate?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          rate?: number
        }
        Relationships: []
      }
      unit_master: {
        Row: {
          conversion_qty: number | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          sub_unit_name: string | null
        }
        Insert: {
          conversion_qty?: number | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          sub_unit_name?: string | null
        }
        Update: {
          conversion_qty?: number | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sub_unit_name?: string | null
        }
        Relationships: []
      }
      vendor_contacts: {
        Row: {
          contact_name: string
          created_at: string
          email: string | null
          id: string
          phone: string | null
          vendor_id: string
        }
        Insert: {
          contact_name: string
          created_at?: string
          email?: string | null
          id?: string
          phone?: string | null
          vendor_id: string
        }
        Update: {
          contact_name?: string
          created_at?: string
          email?: string | null
          id?: string
          phone?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_contacts_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          address: string | null
          category: string | null
          city: string | null
          contact_person: string | null
          created_at: string
          email: string | null
          gst_number: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          phone: string | null
          state: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          category?: string | null
          city?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          gst_number?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          category?: string | null
          city?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          gst_number?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          state?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      working_hours: {
        Row: {
          break_end: string | null
          break_start: string | null
          close_time: string
          created_at: string
          day_of_week: number
          id: string
          is_open: boolean
          open_time: string
        }
        Insert: {
          break_end?: string | null
          break_start?: string | null
          close_time?: string
          created_at?: string
          day_of_week: number
          id?: string
          is_open?: boolean
          open_time?: string
        }
        Update: {
          break_end?: string | null
          break_start?: string | null
          close_time?: string
          created_at?: string
          day_of_week?: number
          id?: string
          is_open?: boolean
          open_time?: string
        }
        Relationships: []
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
