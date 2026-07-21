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
      academic_calendar_events: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string | null
          event_date: string
          id: string
          is_public: boolean
          session_id: string
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          event_date: string
          id?: string
          is_public?: boolean
          session_id: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          event_date?: string
          id?: string
          is_public?: boolean
          session_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "academic_calendar_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "academic_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      academic_sessions: {
        Row: {
          calendar_approved_at: string | null
          calendar_approved_by: string | null
          calendar_status: Database["public"]["Enums"]["senate_status"]
          created_at: string
          end_date: string
          id: string
          name: string
          start_date: string
          status: Database["public"]["Enums"]["session_status"]
        }
        Insert: {
          calendar_approved_at?: string | null
          calendar_approved_by?: string | null
          calendar_status?: Database["public"]["Enums"]["senate_status"]
          created_at?: string
          end_date: string
          id?: string
          name: string
          start_date: string
          status?: Database["public"]["Enums"]["session_status"]
        }
        Update: {
          calendar_approved_at?: string | null
          calendar_approved_by?: string | null
          calendar_status?: Database["public"]["Enums"]["senate_status"]
          created_at?: string
          end_date?: string
          id?: string
          name?: string
          start_date?: string
          status?: Database["public"]["Enums"]["session_status"]
        }
        Relationships: []
      }
      announcements: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          author_id: string
          body: string
          category: string
          created_at: string
          id: string
          is_public: boolean
          publish_at: string | null
          status: Database["public"]["Enums"]["senate_status"]
          title: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          author_id: string
          body: string
          category?: string
          created_at?: string
          id?: string
          is_public?: boolean
          publish_at?: string | null
          status?: Database["public"]["Enums"]["senate_status"]
          title: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          author_id?: string
          body?: string
          category?: string
          created_at?: string
          id?: string
          is_public?: boolean
          publish_at?: string | null
          status?: Database["public"]["Enums"]["senate_status"]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      applications: {
        Row: {
          address: string | null
          created_at: string
          date_of_birth: string | null
          email: string
          entry_session_id: string | null
          full_name: string
          gender: string | null
          id: string
          lga: string | null
          matric_number: string | null
          matriculated_at: string | null
          phone: string | null
          previous_school: string | null
          programme_id: string
          qualification: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewer_id: string | null
          state_of_origin: string | null
          status: Database["public"]["Enums"]["application_status"]
          subjects_grades: Json | null
          submitted_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          date_of_birth?: string | null
          email: string
          entry_session_id?: string | null
          full_name: string
          gender?: string | null
          id?: string
          lga?: string | null
          matric_number?: string | null
          matriculated_at?: string | null
          phone?: string | null
          previous_school?: string | null
          programme_id: string
          qualification?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          state_of_origin?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          subjects_grades?: Json | null
          submitted_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string
          entry_session_id?: string | null
          full_name?: string
          gender?: string | null
          id?: string
          lga?: string | null
          matric_number?: string | null
          matriculated_at?: string | null
          phone?: string | null
          previous_school?: string | null
          programme_id?: string
          qualification?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          state_of_origin?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          subjects_grades?: Json | null
          submitted_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_entry_session_id_fkey"
            columns: ["entry_session_id"]
            isOneToOne: false
            referencedRelation: "academic_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_programme_id_fkey"
            columns: ["programme_id"]
            isOneToOne: false
            referencedRelation: "programmes"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity: string
          entity_id: string | null
          id: string
          metadata: Json | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
          metadata?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          metadata?: Json | null
        }
        Relationships: []
      }
      course_lecturers: {
        Row: {
          is_lead: boolean
          lecturer_id: string
          offering_id: string
        }
        Insert: {
          is_lead?: boolean
          lecturer_id: string
          offering_id: string
        }
        Update: {
          is_lead?: boolean
          lecturer_id?: string
          offering_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_lecturers_offering_id_fkey"
            columns: ["offering_id"]
            isOneToOne: false
            referencedRelation: "course_offerings"
            referencedColumns: ["id"]
          },
        ]
      }
      course_offerings: {
        Row: {
          course_id: string
          created_at: string
          id: string
          max_students: number | null
          semester_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          max_students?: number | null
          semester_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          max_students?: number | null
          semester_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_offerings_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_offerings_semester_id_fkey"
            columns: ["semester_id"]
            isOneToOne: false
            referencedRelation: "semesters"
            referencedColumns: ["id"]
          },
        ]
      }
      course_prerequisites: {
        Row: {
          course_id: string
          prerequisite_id: string
        }
        Insert: {
          course_id: string
          prerequisite_id: string
        }
        Update: {
          course_id?: string
          prerequisite_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_prerequisites_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_prerequisites_prerequisite_id_fkey"
            columns: ["prerequisite_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_registrations: {
        Row: {
          id: string
          offering_id: string
          registered_at: string
          status: Database["public"]["Enums"]["registration_status"]
          student_id: string
        }
        Insert: {
          id?: string
          offering_id: string
          registered_at?: string
          status?: Database["public"]["Enums"]["registration_status"]
          student_id: string
        }
        Update: {
          id?: string
          offering_id?: string
          registered_at?: string
          status?: Database["public"]["Enums"]["registration_status"]
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_registrations_offering_id_fkey"
            columns: ["offering_id"]
            isOneToOne: false
            referencedRelation: "course_offerings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_registrations_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          category: string
          code: string
          created_at: string
          credit_units: number
          department_id: string
          description: string | null
          id: string
          is_active: boolean
          level_id: string
          semester_type: Database["public"]["Enums"]["semester_type"]
          title: string
        }
        Insert: {
          category?: string
          code: string
          created_at?: string
          credit_units: number
          department_id: string
          description?: string | null
          id?: string
          is_active?: boolean
          level_id: string
          semester_type: Database["public"]["Enums"]["semester_type"]
          title: string
        }
        Update: {
          category?: string
          code?: string
          created_at?: string
          credit_units?: number
          department_id?: string
          description?: string | null
          id?: string
          is_active?: boolean
          level_id?: string
          semester_type?: Database["public"]["Enums"]["semester_type"]
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          code: string
          created_at: string
          faculty_id: string
          hod_id: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          faculty_id: string
          hod_id?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          faculty_id?: string
          hod_id?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_faculty_id_fkey"
            columns: ["faculty_id"]
            isOneToOne: false
            referencedRelation: "faculties"
            referencedColumns: ["id"]
          },
        ]
      }
      faculties: {
        Row: {
          code: string
          created_at: string
          dean_id: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          dean_id?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          dean_id?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      fee_structures: {
        Row: {
          amount: number
          description: string
          id: string
          level_id: string
          programme_id: string | null
          session_id: string
        }
        Insert: {
          amount: number
          description: string
          id?: string
          level_id: string
          programme_id?: string | null
          session_id: string
        }
        Update: {
          amount?: number
          description?: string
          id?: string
          level_id?: string
          programme_id?: string | null
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_structures_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_structures_programme_id_fkey"
            columns: ["programme_id"]
            isOneToOne: false
            referencedRelation: "programmes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_structures_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "academic_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      gpa_records: {
        Row: {
          cgpa: number
          computed_at: string
          credit_units: number
          gpa: number
          grade_points: number
          id: string
          semester_id: string
          standing: Database["public"]["Enums"]["academic_standing"]
          student_id: string
        }
        Insert: {
          cgpa?: number
          computed_at?: string
          credit_units?: number
          gpa?: number
          grade_points?: number
          id?: string
          semester_id: string
          standing?: Database["public"]["Enums"]["academic_standing"]
          student_id: string
        }
        Update: {
          cgpa?: number
          computed_at?: string
          credit_units?: number
          gpa?: number
          grade_points?: number
          id?: string
          semester_id?: string
          standing?: Database["public"]["Enums"]["academic_standing"]
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gpa_records_semester_id_fkey"
            columns: ["semester_id"]
            isOneToOne: false
            referencedRelation: "semesters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gpa_records_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      graduation_list_entries: {
        Row: {
          cgpa: number | null
          classification: string | null
          created_at: string
          id: string
          list_id: string
          student_id: string
        }
        Insert: {
          cgpa?: number | null
          classification?: string | null
          created_at?: string
          id?: string
          list_id: string
          student_id: string
        }
        Update: {
          cgpa?: number | null
          classification?: string | null
          created_at?: string
          id?: string
          list_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "graduation_list_entries_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "graduation_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "graduation_list_entries_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      graduation_lists: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          id: string
          notes: string | null
          prepared_by: string
          session_id: string
          status: Database["public"]["Enums"]["graduation_status"]
          title: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          prepared_by: string
          session_id: string
          status?: Database["public"]["Enums"]["graduation_status"]
          title: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          prepared_by?: string
          session_id?: string
          status?: Database["public"]["Enums"]["graduation_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "graduation_lists_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "academic_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      levels: {
        Row: {
          code: string
          id: string
          name: string
          order_index: number
        }
        Insert: {
          code: string
          id?: string
          name: string
          order_index: number
        }
        Update: {
          code?: string
          id?: string
          name?: string
          order_index?: number
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          category: string | null
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          category?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          category?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          fee_structure_id: string | null
          id: string
          metadata: Json | null
          provider: string | null
          reference: string
          session_id: string
          status: Database["public"]["Enums"]["payment_status"]
          student_id: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          fee_structure_id?: string | null
          id?: string
          metadata?: Json | null
          provider?: string | null
          reference: string
          session_id: string
          status?: Database["public"]["Enums"]["payment_status"]
          student_id: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          fee_structure_id?: string | null
          id?: string
          metadata?: Json | null
          provider?: string | null
          reference?: string
          session_id?: string
          status?: Database["public"]["Enums"]["payment_status"]
          student_id?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_fee_structure_id_fkey"
            columns: ["fee_structure_id"]
            isOneToOne: false
            referencedRelation: "fee_structures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "academic_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_role_grants: {
        Row: {
          created_at: string
          created_by: string | null
          email: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      policy_documents: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          author_id: string
          body_md: string
          category: string
          created_at: string
          id: string
          status: Database["public"]["Enums"]["policy_status"]
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          author_id: string
          body_md: string
          category?: string
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["policy_status"]
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          author_id?: string
          body_md?: string
          category?: string
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["policy_status"]
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          created_at: string
          date_of_birth: string | null
          email: string
          full_name: string | null
          gender: string | null
          id: string
          lga: string | null
          phone: string | null
          state_of_origin: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          created_at?: string
          date_of_birth?: string | null
          email: string
          full_name?: string | null
          gender?: string | null
          id: string
          lga?: string | null
          phone?: string | null
          state_of_origin?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string
          full_name?: string | null
          gender?: string | null
          id?: string
          lga?: string | null
          phone?: string | null
          state_of_origin?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      programmes: {
        Row: {
          code: string
          created_at: string
          department_id: string
          duration_years: number
          id: string
          name: string
        }
        Insert: {
          code: string
          created_at?: string
          department_id: string
          duration_years?: number
          id?: string
          name: string
        }
        Update: {
          code?: string
          created_at?: string
          department_id?: string
          duration_years?: number
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "programmes_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      result_history: {
        Row: {
          action: string
          ca_score: number | null
          changed_at: string
          changed_by: string
          exam_score: number | null
          from_status: Database["public"]["Enums"]["result_status"] | null
          id: string
          note: string | null
          result_id: string
          to_status: Database["public"]["Enums"]["result_status"] | null
        }
        Insert: {
          action: string
          ca_score?: number | null
          changed_at?: string
          changed_by: string
          exam_score?: number | null
          from_status?: Database["public"]["Enums"]["result_status"] | null
          id?: string
          note?: string | null
          result_id: string
          to_status?: Database["public"]["Enums"]["result_status"] | null
        }
        Update: {
          action?: string
          ca_score?: number | null
          changed_at?: string
          changed_by?: string
          exam_score?: number | null
          from_status?: Database["public"]["Enums"]["result_status"] | null
          id?: string
          note?: string | null
          result_id?: string
          to_status?: Database["public"]["Enums"]["result_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "result_history_result_id_fkey"
            columns: ["result_id"]
            isOneToOne: false
            referencedRelation: "results"
            referencedColumns: ["id"]
          },
        ]
      }
      results: {
        Row: {
          ca_score: number | null
          correction_reason: string | null
          correction_requested: boolean
          created_at: string
          dean_approved_at: string | null
          dean_approved_by: string | null
          exam_score: number | null
          grade: string | null
          grade_point: number | null
          hod_approved_at: string | null
          hod_approved_by: string | null
          id: string
          offering_id: string
          published_at: string | null
          registration_id: string
          registry_approved_at: string | null
          registry_approved_by: string | null
          rejection_reason: string | null
          requires_senate: boolean
          status: Database["public"]["Enums"]["result_status"]
          status_code: Database["public"]["Enums"]["result_status_code"]
          student_id: string
          submitted_at: string | null
          submitted_by: string | null
          total_score: number | null
          updated_at: string
        }
        Insert: {
          ca_score?: number | null
          correction_reason?: string | null
          correction_requested?: boolean
          created_at?: string
          dean_approved_at?: string | null
          dean_approved_by?: string | null
          exam_score?: number | null
          grade?: string | null
          grade_point?: number | null
          hod_approved_at?: string | null
          hod_approved_by?: string | null
          id?: string
          offering_id: string
          published_at?: string | null
          registration_id: string
          registry_approved_at?: string | null
          registry_approved_by?: string | null
          rejection_reason?: string | null
          requires_senate?: boolean
          status?: Database["public"]["Enums"]["result_status"]
          status_code?: Database["public"]["Enums"]["result_status_code"]
          student_id: string
          submitted_at?: string | null
          submitted_by?: string | null
          total_score?: number | null
          updated_at?: string
        }
        Update: {
          ca_score?: number | null
          correction_reason?: string | null
          correction_requested?: boolean
          created_at?: string
          dean_approved_at?: string | null
          dean_approved_by?: string | null
          exam_score?: number | null
          grade?: string | null
          grade_point?: number | null
          hod_approved_at?: string | null
          hod_approved_by?: string | null
          id?: string
          offering_id?: string
          published_at?: string | null
          registration_id?: string
          registry_approved_at?: string | null
          registry_approved_by?: string | null
          rejection_reason?: string | null
          requires_senate?: boolean
          status?: Database["public"]["Enums"]["result_status"]
          status_code?: Database["public"]["Enums"]["result_status_code"]
          student_id?: string
          submitted_at?: string | null
          submitted_by?: string | null
          total_score?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "results_offering_id_fkey"
            columns: ["offering_id"]
            isOneToOne: false
            referencedRelation: "course_offerings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "results_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: true
            referencedRelation: "course_registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "results_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      semesters: {
        Row: {
          end_date: string
          id: string
          is_current: boolean
          registration_end: string | null
          registration_open: boolean
          registration_start: string | null
          session_id: string
          start_date: string
          type: Database["public"]["Enums"]["semester_type"]
        }
        Insert: {
          end_date: string
          id?: string
          is_current?: boolean
          registration_end?: string | null
          registration_open?: boolean
          registration_start?: string | null
          session_id: string
          start_date: string
          type: Database["public"]["Enums"]["semester_type"]
        }
        Update: {
          end_date?: string
          id?: string
          is_current?: boolean
          registration_end?: string | null
          registration_open?: boolean
          registration_start?: string | null
          session_id?: string
          start_date?: string
          type?: Database["public"]["Enums"]["semester_type"]
        }
        Relationships: [
          {
            foreignKeyName: "semesters_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "academic_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      standing_history: {
        Row: {
          cgpa_at_time: number | null
          created_at: string
          gpa_at_time: number | null
          id: string
          reason: string | null
          semester_id: string | null
          standing: Database["public"]["Enums"]["academic_standing"]
          student_id: string
        }
        Insert: {
          cgpa_at_time?: number | null
          created_at?: string
          gpa_at_time?: number | null
          id?: string
          reason?: string | null
          semester_id?: string | null
          standing: Database["public"]["Enums"]["academic_standing"]
          student_id: string
        }
        Update: {
          cgpa_at_time?: number | null
          created_at?: string
          gpa_at_time?: number | null
          id?: string
          reason?: string | null
          semester_id?: string | null
          standing?: Database["public"]["Enums"]["academic_standing"]
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "standing_history_semester_id_fkey"
            columns: ["semester_id"]
            isOneToOne: false
            referencedRelation: "semesters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standing_history_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          cgpa: number
          created_at: string
          current_level_id: string
          department_id: string
          entry_session_id: string | null
          entry_year: number | null
          id: string
          is_active: boolean
          matric_number: string
          programme_id: string
          standing: Database["public"]["Enums"]["academic_standing"]
          total_credit_units: number
          total_grade_points: number
          updated_at: string
        }
        Insert: {
          cgpa?: number
          created_at?: string
          current_level_id: string
          department_id: string
          entry_session_id?: string | null
          entry_year?: number | null
          id: string
          is_active?: boolean
          matric_number: string
          programme_id: string
          standing?: Database["public"]["Enums"]["academic_standing"]
          total_credit_units?: number
          total_grade_points?: number
          updated_at?: string
        }
        Update: {
          cgpa?: number
          created_at?: string
          current_level_id?: string
          department_id?: string
          entry_session_id?: string | null
          entry_year?: number | null
          id?: string
          is_active?: boolean
          matric_number?: string
          programme_id?: string
          standing?: Database["public"]["Enums"]["academic_standing"]
          total_credit_units?: number
          total_grade_points?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_current_level_id_fkey"
            columns: ["current_level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_entry_session_id_fkey"
            columns: ["entry_session_id"]
            isOneToOne: false
            referencedRelation: "academic_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_programme_id_fkey"
            columns: ["programme_id"]
            isOneToOne: false
            referencedRelation: "programmes"
            referencedColumns: ["id"]
          },
        ]
      }
      transcripts_issued: {
        Row: {
          id: string
          issued_at: string
          issued_by: string
          metadata: Json
          serial: string
          student_id: string
        }
        Insert: {
          id?: string
          issued_at?: string
          issued_by: string
          metadata?: Json
          serial: string
          student_id: string
        }
        Update: {
          id?: string
          issued_at?: string
          issued_by?: string
          metadata?: Json
          serial?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transcripts_issued_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
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
      check_graduation_eligibility: {
        Args: { _student_id: string }
        Returns: {
          cgpa: number
          education_credits: number
          eligible: boolean
          general_studies_credits: number
          reasons: string[]
          siwes_completed: boolean
          standing: Database["public"]["Enums"]["academic_standing"]
          subject_major_credits: number
          teaching_practice_completed: boolean
          total_credits_earned: number
        }[]
      }
      compute_grade: {
        Args: { _score: number }
        Returns: {
          grade: string
          grade_point: number
        }[]
      }
      current_user_roles: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"][]
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
      matriculate_application: {
        Args: { _application_id: string }
        Returns: string
      }
      next_transcript_serial: { Args: { _year: number }; Returns: string }
      recompute_semester_gpa: {
        Args: { _semester_id: string; _student_id: string }
        Returns: undefined
      }
      recompute_student_cgpa: {
        Args: { _student_id: string }
        Returns: undefined
      }
    }
    Enums: {
      academic_standing: "excellent" | "good" | "probation" | "withdrawn"
      app_role:
        | "super_admin"
        | "ict_admin"
        | "registry"
        | "bursary"
        | "dean"
        | "hod"
        | "lecturer"
        | "student"
        | "applicant"
        | "provost"
      application_status:
        | "pending"
        | "under_review"
        | "approved"
        | "rejected"
        | "matriculated"
      graduation_status: "draft" | "pending_senate" | "approved" | "rejected"
      payment_status: "pending" | "verified" | "failed" | "refunded"
      policy_status:
        | "draft"
        | "pending_senate"
        | "active"
        | "archived"
        | "rejected"
      registration_status: "pending" | "approved" | "rejected"
      result_status:
        | "draft"
        | "submitted"
        | "hod_approved"
        | "hod_rejected"
        | "dean_approved"
        | "dean_rejected"
        | "registry_approved"
        | "registry_rejected"
        | "published"
      result_status_code: "OK" | "ABS" | "INC" | "WH"
      semester_type: "first" | "second"
      senate_status:
        | "draft"
        | "pending_senate"
        | "published"
        | "archived"
        | "rejected"
      session_status: "upcoming" | "active" | "archived" | "closed"
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
      academic_standing: ["excellent", "good", "probation", "withdrawn"],
      app_role: [
        "super_admin",
        "ict_admin",
        "registry",
        "bursary",
        "dean",
        "hod",
        "lecturer",
        "student",
        "applicant",
        "provost",
      ],
      application_status: [
        "pending",
        "under_review",
        "approved",
        "rejected",
        "matriculated",
      ],
      graduation_status: ["draft", "pending_senate", "approved", "rejected"],
      payment_status: ["pending", "verified", "failed", "refunded"],
      policy_status: [
        "draft",
        "pending_senate",
        "active",
        "archived",
        "rejected",
      ],
      registration_status: ["pending", "approved", "rejected"],
      result_status: [
        "draft",
        "submitted",
        "hod_approved",
        "hod_rejected",
        "dean_approved",
        "dean_rejected",
        "registry_approved",
        "registry_rejected",
        "published",
      ],
      result_status_code: ["OK", "ABS", "INC", "WH"],
      semester_type: ["first", "second"],
      senate_status: [
        "draft",
        "pending_senate",
        "published",
        "archived",
        "rejected",
      ],
      session_status: ["upcoming", "active", "archived", "closed"],
    },
  },
} as const
