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
          recurrence_end_date: string | null
          recurrence_pattern: string | null
          service: string
          staff_id: string | null
          start_time: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_time: string
          id?: string
          is_recurring?: boolean | null
          patient_id?: string | null
          patient_name?: string | null
          recurrence_end_date?: string | null
          recurrence_pattern?: string | null
          service: string
          staff_id?: string | null
          start_time: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_time?: string
          id?: string
          is_recurring?: boolean | null
          patient_id?: string | null
          patient_name?: string | null
          recurrence_end_date?: string | null
          recurrence_pattern?: string | null
          service?: string
          staff_id?: string | null
          start_time?: string
          status?: string
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
            referencedRelation: "staff"
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
      invoices: {
        Row: {
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
          total_amount: number
          updated_at: string
        }
        Insert: {
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
          total_amount?: number
          updated_at?: string
        }
        Update: {
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
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
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
      patients: {
        Row: {
          address: string | null
          allergies: string | null
          blood_group: string | null
          city: string | null
          created_at: string
          current_medications: string | null
          date_of_birth: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          first_name: string
          gender: string | null
          id: string
          last_name: string
          medical_history: string | null
          notes: string | null
          phone: string | null
          pincode: string | null
          previous_treatments: string | null
          skin_concerns: string | null
          skin_type: string | null
          state: string | null
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          allergies?: string | null
          blood_group?: string | null
          city?: string | null
          created_at?: string
          current_medications?: string | null
          date_of_birth?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          first_name: string
          gender?: string | null
          id?: string
          last_name: string
          medical_history?: string | null
          notes?: string | null
          phone?: string | null
          pincode?: string | null
          previous_treatments?: string | null
          skin_concerns?: string | null
          skin_type?: string | null
          state?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          allergies?: string | null
          blood_group?: string | null
          city?: string | null
          created_at?: string
          current_medications?: string | null
          date_of_birth?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          first_name?: string
          gender?: string | null
          id?: string
          last_name?: string
          medical_history?: string | null
          notes?: string | null
          phone?: string | null
          pincode?: string | null
          previous_treatments?: string | null
          skin_concerns?: string | null
          skin_type?: string | null
          state?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
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
          generic_name: string | null
          gst_percent: number
          hsn_code: string | null
          id: string
          manufacturer: string | null
          mrp: number
          name: string
          reorder_level: number
          selling_price: number
          unit: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          generic_name?: string | null
          gst_percent?: number
          hsn_code?: string | null
          id?: string
          manufacturer?: string | null
          mrp?: number
          name: string
          reorder_level?: number
          selling_price?: number
          unit?: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          generic_name?: string | null
          gst_percent?: number
          hsn_code?: string | null
          id?: string
          manufacturer?: string | null
          mrp?: number
          name?: string
          reorder_level?: number
          selling_price?: number
          unit?: string
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
      procedures: {
        Row: {
          appointment_id: string | null
          consultation_notes: string | null
          created_at: string
          diagnosis: string | null
          id: string
          patient_id: string
          procedure_date: string
          procedure_notes: string | null
          service_name: string
          staff_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          appointment_id?: string | null
          consultation_notes?: string | null
          created_at?: string
          diagnosis?: string | null
          id?: string
          patient_id: string
          procedure_date?: string
          procedure_notes?: string | null
          service_name: string
          staff_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          appointment_id?: string | null
          consultation_notes?: string | null
          created_at?: string
          diagnosis?: string | null
          id?: string
          patient_id?: string
          procedure_date?: string
          procedure_notes?: string | null
          service_name?: string
          staff_id?: string | null
          status?: string
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
      staff: {
        Row: {
          created_at: string
          email: string | null
          first_name: string
          id: string
          last_name: string
          phone: string | null
          role: string
          specialization: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          first_name: string
          id?: string
          last_name: string
          phone?: string | null
          role: string
          specialization?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          first_name?: string
          id?: string
          last_name?: string
          phone?: string | null
          role?: string
          specialization?: string | null
          updated_at?: string
        }
        Relationships: []
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
