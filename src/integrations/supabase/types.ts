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
      card_sizes: {
        Row: {
          active: boolean
          category: string | null
          code: string
          created_at: string
          description: string | null
          height_mm: number
          id: string
          is_system_default: boolean
          name: string
          organization_id: string | null
          orientation: string
          updated_at: string
          width_mm: number
        }
        Insert: {
          active?: boolean
          category?: string | null
          code: string
          created_at?: string
          description?: string | null
          height_mm: number
          id?: string
          is_system_default?: boolean
          name: string
          organization_id?: string | null
          orientation?: string
          updated_at?: string
          width_mm: number
        }
        Update: {
          active?: boolean
          category?: string | null
          code?: string
          created_at?: string
          description?: string | null
          height_mm?: number
          id?: string
          is_system_default?: boolean
          name?: string
          organization_id?: string | null
          orientation?: string
          updated_at?: string
          width_mm?: number
        }
        Relationships: [
          {
            foreignKeyName: "card_sizes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      card_templates: {
        Row: {
          active: boolean
          back_design: Json
          background_url: string | null
          bleed_mm: number
          card_size_id: string | null
          created_at: string
          description: string | null
          front_design: Json
          id: string
          name: string
          organization_id: string
          orientation: string
          thumbnail_url: string | null
          updated_at: string
          version: number
        }
        Insert: {
          active?: boolean
          back_design?: Json
          background_url?: string | null
          bleed_mm?: number
          card_size_id?: string | null
          created_at?: string
          description?: string | null
          front_design?: Json
          id?: string
          name: string
          organization_id: string
          orientation?: string
          thumbnail_url?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          active?: boolean
          back_design?: Json
          background_url?: string | null
          bleed_mm?: number
          card_size_id?: string | null
          created_at?: string
          description?: string | null
          front_design?: Json
          id?: string
          name?: string
          organization_id?: string
          orientation?: string
          thumbnail_url?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "card_templates_card_size_id_fkey"
            columns: ["card_size_id"]
            isOneToOne: false
            referencedRelation: "card_sizes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "card_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      id_cards: {
        Row: {
          address: string | null
          birth_date: string | null
          birth_place: string | null
          card_number: string
          card_size_id: string | null
          created_at: string
          created_by: string | null
          custom_fields: Json
          department: string | null
          email: string | null
          expiry_date: string | null
          full_name: string
          gender: string | null
          id: string
          identification_number: string | null
          issue_date: string
          membership_number: string | null
          nik: string | null
          organization: string | null
          organization_id: string
          phone: string | null
          photo_url: string | null
          position: string | null
          qr_token: string
          snapshot: Json | null
          status: Database["public"]["Enums"]["card_status"]
          template_id: string | null
          template_version: number | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          birth_date?: string | null
          birth_place?: string | null
          card_number: string
          card_size_id?: string | null
          created_at?: string
          created_by?: string | null
          custom_fields?: Json
          department?: string | null
          email?: string | null
          expiry_date?: string | null
          full_name: string
          gender?: string | null
          id?: string
          identification_number?: string | null
          issue_date?: string
          membership_number?: string | null
          nik?: string | null
          organization?: string | null
          organization_id: string
          phone?: string | null
          photo_url?: string | null
          position?: string | null
          qr_token?: string
          snapshot?: Json | null
          status?: Database["public"]["Enums"]["card_status"]
          template_id?: string | null
          template_version?: number | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          birth_date?: string | null
          birth_place?: string | null
          card_number?: string
          card_size_id?: string | null
          created_at?: string
          created_by?: string | null
          custom_fields?: Json
          department?: string | null
          email?: string | null
          expiry_date?: string | null
          full_name?: string
          gender?: string | null
          id?: string
          identification_number?: string | null
          issue_date?: string
          membership_number?: string | null
          nik?: string | null
          organization?: string | null
          organization_id?: string
          phone?: string | null
          photo_url?: string | null
          position?: string | null
          qr_token?: string
          snapshot?: Json | null
          status?: Database["public"]["Enums"]["card_status"]
          template_id?: string | null
          template_version?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "id_cards_card_size_id_fkey"
            columns: ["card_size_id"]
            isOneToOne: false
            referencedRelation: "card_sizes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "id_cards_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "id_cards_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "card_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          address: string | null
          card_prefix: string
          contact: string | null
          created_at: string
          id: string
          logo_url: string | null
          name: string
          slug: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          card_prefix?: string
          contact?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          slug?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          card_prefix?: string
          contact?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          slug?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      print_history: {
        Row: {
          card_id: string | null
          card_size_code: string | null
          created_at: string
          id: string
          notes: string | null
          organization_id: string
          paper: string | null
          print_type: string
          template_version: number | null
          user_id: string | null
        }
        Insert: {
          card_id?: string | null
          card_size_code?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          organization_id: string
          paper?: string | null
          print_type?: string
          template_version?: number | null
          user_id?: string | null
        }
        Update: {
          card_id?: string | null
          card_size_code?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          organization_id?: string
          paper?: string | null
          print_type?: string
          template_version?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "print_history_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "id_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "print_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          organization_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          organization_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          organization_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      template_versions: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          snapshot: Json
          template_id: string
          version: number
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          snapshot: Json
          template_id: string
          version: number
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          snapshot?: Json
          template_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "template_versions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_versions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "card_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      current_org_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      next_card_number: { Args: { _org: string }; Returns: string }
      verify_card: {
        Args: { _token: string }
        Returns: {
          card_number: string
          card_state: string
          expiry: string
          full_name: string
          job_position: string
          org_name: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "designer" | "operator" | "viewer"
      card_status: "draft" | "active" | "expired" | "blocked" | "cancelled"
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
      app_role: ["admin", "designer", "operator", "viewer"],
      card_status: ["draft", "active", "expired", "blocked", "cancelled"],
    },
  },
} as const
