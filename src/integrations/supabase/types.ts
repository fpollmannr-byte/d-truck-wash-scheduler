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
      bays: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      bookings: {
        Row: {
          approval_status: string
          bay_id: string
          client: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          created_by: string | null
          end_at: string
          id: string
          is_public_request: boolean
          observations: string | null
          operators_needed: number
          plate: string
          start_at: string
          status: Database["public"]["Enums"]["wash_status"]
          supervisor_approved: boolean
          updated_at: string
          wash_type: Database["public"]["Enums"]["wash_type"]
        }
        Insert: {
          approval_status?: string
          bay_id: string
          client?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          end_at: string
          id?: string
          is_public_request?: boolean
          observations?: string | null
          operators_needed?: number
          plate: string
          start_at: string
          status?: Database["public"]["Enums"]["wash_status"]
          supervisor_approved?: boolean
          updated_at?: string
          wash_type: Database["public"]["Enums"]["wash_type"]
        }
        Update: {
          approval_status?: string
          bay_id?: string
          client?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          end_at?: string
          id?: string
          is_public_request?: boolean
          observations?: string | null
          operators_needed?: number
          plate?: string
          start_at?: string
          status?: Database["public"]["Enums"]["wash_status"]
          supervisor_approved?: boolean
          updated_at?: string
          wash_type?: Database["public"]["Enums"]["wash_type"]
        }
        Relationships: [
          {
            foreignKeyName: "bookings_bay_id_fkey"
            columns: ["bay_id"]
            isOneToOne: false
            referencedRelation: "bays"
            referencedColumns: ["id"]
          },
        ]
      }
      lanes: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      operators: {
        Row: {
          active: boolean
          created_at: string
          id: string
          is_supervisor: boolean
          name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          is_supervisor?: boolean
          name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          is_supervisor?: boolean
          name?: string
        }
        Relationships: []
      }
      shifts: {
        Row: {
          active: boolean
          break_end: string | null
          break_start: string | null
          created_at: string
          end_time: string
          headcount: number
          id: string
          name: string
          start_time: string
        }
        Insert: {
          active?: boolean
          break_end?: string | null
          break_start?: string | null
          created_at?: string
          end_time: string
          headcount?: number
          id?: string
          name: string
          start_time: string
        }
        Update: {
          active?: boolean
          break_end?: string | null
          break_start?: string | null
          created_at?: string
          end_time?: string
          headcount?: number
          id?: string
          name?: string
          start_time?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_public_booking: {
        Args: {
          p_bay_id: string
          p_contact_name: string
          p_contact_phone: string
          p_end_at: string
          p_observations?: string
          p_plate: string
          p_start_at: string
          p_wash_type: Database["public"]["Enums"]["wash_type"]
        }
        Returns: string
      }
      get_public_schedule: {
        Args: { date_from: string; date_to: string }
        Returns: {
          bay_id: string
          bay_name: string
          end_at: string
          id: string
          start_at: string
          status: Database["public"]["Enums"]["wash_status"]
        }[]
      }
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "operador" | "jefe" | "lider"
      wash_status:
        | "programado"
        | "en_proceso"
        | "completado"
        | "cancelado"
        | "en_espera"
        | "en_lavado_interior"
        | "en_lavado_exterior"
        | "control_calidad"
        | "finalizado"
        | "entregado"
      wash_type:
        | "exterior"
        | "interior_3"
        | "interior_4"
        | "interior_5"
        | "interior_6"
        | "hermeticidad"
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
      app_role: ["admin", "operador", "jefe", "lider"],
      wash_status: [
        "programado",
        "en_proceso",
        "completado",
        "cancelado",
        "en_espera",
        "en_lavado_interior",
        "en_lavado_exterior",
        "control_calidad",
        "finalizado",
        "entregado",
      ],
      wash_type: [
        "exterior",
        "interior_3",
        "interior_4",
        "interior_5",
        "interior_6",
        "hermeticidad",
      ],
    },
  },
} as const
