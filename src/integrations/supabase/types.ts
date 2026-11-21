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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      ai_insights: {
        Row: {
          created_at: string
          form: number | null
          id: string
          kind: Database["public"]["Enums"]["insight_kind"]
          language: string
          payload: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          form?: number | null
          id?: string
          kind: Database["public"]["Enums"]["insight_kind"]
          language: string
          payload: Json
          user_id: string
        }
        Update: {
          created_at?: string
          form?: number | null
          id?: string
          kind?: Database["public"]["Enums"]["insight_kind"]
          language?: string
          payload?: Json
          user_id?: string
        }
        Relationships: []
      }
      ai_usage: {
        Row: {
          ai_calls: number
          day: string
          ocr_calls: number
          user_id: string
        }
        Insert: {
          ai_calls?: number
          day?: string
          ocr_calls?: number
          user_id: string
        }
        Update: {
          ai_calls?: number
          day?: string
          ocr_calls?: number
          user_id?: string
        }
        Relationships: []
      }
      exam_sessions: {
        Row: {
          academic_year: number | null
          created_at: string
          exam: Database["public"]["Enums"]["exam_type"]
          form: number
          id: string
          notes: string | null
          rank_position: number | null
          rank_total: number | null
          user_id: string
        }
        Insert: {
          academic_year?: number | null
          created_at?: string
          exam: Database["public"]["Enums"]["exam_type"]
          form: number
          id?: string
          notes?: string | null
          rank_position?: number | null
          rank_total?: number | null
          user_id: string
        }
        Update: {
          academic_year?: number | null
          created_at?: string
          exam?: Database["public"]["Enums"]["exam_type"]
          form?: number
          id?: string
          notes?: string | null
          rank_position?: number | null
          rank_total?: number | null
          user_id?: string
        }
        Relationships: []
      }
      goals: {
        Row: {
          created_at: string
          exam: Database["public"]["Enums"]["exam_type"] | null
          form: number
          id: string
          scope: Database["public"]["Enums"]["goal_scope"]
          target_average: number | null
          target_cgpa: number | null
          target_grade: string | null
          user_id: string
          user_subject_id: string | null
        }
        Insert: {
          created_at?: string
          exam?: Database["public"]["Enums"]["exam_type"] | null
          form: number
          id?: string
          scope: Database["public"]["Enums"]["goal_scope"]
          target_average?: number | null
          target_cgpa?: number | null
          target_grade?: string | null
          user_id: string
          user_subject_id?: string | null
        }
        Update: {
          created_at?: string
          exam?: Database["public"]["Enums"]["exam_type"] | null
          form?: number
          id?: string
          scope?: Database["public"]["Enums"]["goal_scope"]
          target_average?: number | null
          target_cgpa?: number | null
          target_grade?: string | null
          user_id?: string
          user_subject_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "goals_user_subject_id_fkey"
            columns: ["user_subject_id"]
            isOneToOne: false
            referencedRelation: "user_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      marks: {
        Row: {
          id: string
          mark: number | null
          session_id: string
          source: Database["public"]["Enums"]["mark_source"]
          source_file_id: string | null
          status: Database["public"]["Enums"]["mark_status"]
          updated_at: string
          user_id: string
          user_subject_id: string
        }
        Insert: {
          id?: string
          mark?: number | null
          session_id: string
          source?: Database["public"]["Enums"]["mark_source"]
          source_file_id?: string | null
          status?: Database["public"]["Enums"]["mark_status"]
          updated_at?: string
          user_id: string
          user_subject_id: string
        }
        Update: {
          id?: string
          mark?: number | null
          session_id?: string
          source?: Database["public"]["Enums"]["mark_source"]
          source_file_id?: string | null
          status?: Database["public"]["Enums"]["mark_status"]
          updated_at?: string
          user_id?: string
          user_subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marks_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "exam_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marks_source_file_id_fkey"
            columns: ["source_file_id"]
            isOneToOne: false
            referencedRelation: "source_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marks_user_subject_id_fkey"
            columns: ["user_subject_id"]
            isOneToOne: false
            referencedRelation: "user_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          class_name: string | null
          created_at: string
          current_form: number | null
          display_name: string | null
          id: string
          language: string
          onboarded_at: string | null
          school: string | null
          theme: string
        }
        Insert: {
          class_name?: string | null
          created_at?: string
          current_form?: number | null
          display_name?: string | null
          id: string
          language?: string
          onboarded_at?: string | null
          school?: string | null
          theme?: string
        }
        Update: {
          class_name?: string | null
          created_at?: string
          current_form?: number | null
          display_name?: string | null
          id?: string
          language?: string
          onboarded_at?: string | null
          school?: string | null
          theme?: string
        }
        Relationships: []
      }
      source_files: {
        Row: {
          created_at: string
          id: string
          mime_type: string | null
          session_id: string
          storage_path: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mime_type?: string | null
          session_id: string
          storage_path: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mime_type?: string | null
          session_id?: string
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_files_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "exam_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      subject_catalog: {
        Row: {
          forms: number[]
          id: number
          is_core: boolean
          name_en: string
          name_ms: string
          sort_order: number
        }
        Insert: {
          forms: number[]
          id?: number
          is_core?: boolean
          name_en: string
          name_ms: string
          sort_order?: number
        }
        Update: {
          forms?: number[]
          id?: number
          is_core?: boolean
          name_en?: string
          name_ms?: string
          sort_order?: number
        }
        Relationships: []
      }
      user_subjects: {
        Row: {
          catalog_id: number | null
          created_at: string
          custom_name: string | null
          form: number
          id: string
          is_active: boolean
          sort_order: number
          user_id: string
        }
        Insert: {
          catalog_id?: number | null
          created_at?: string
          custom_name?: string | null
          form: number
          id?: string
          is_active?: boolean
          sort_order?: number
          user_id: string
        }
        Update: {
          catalog_id?: number | null
          created_at?: string
          custom_name?: string | null
          form?: number
          id?: string
          is_active?: boolean
          sort_order?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_subjects_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "subject_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      consume_ai_call: {
        Args: { _cap: number; _kind: string }
        Returns: boolean
      }
    }
    Enums: {
      exam_type: "sumatif_1" | "sumatif_2" | "uasa"
      goal_scope: "subject" | "exam"
      insight_kind: "analysis" | "study_plan"
      mark_source: "manual" | "import" | "ocr"
      mark_status: "completed" | "pending" | "exempted" | "absent"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      exam_type: ["sumatif_1", "sumatif_2", "uasa"],
      goal_scope: ["subject", "exam"],
      insight_kind: ["analysis", "study_plan"],
      mark_source: ["manual", "import", "ocr"],
      mark_status: ["completed", "pending", "exempted", "absent"],
    },
  },
} as const
