import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

function classify(cgpa: number): string {
  if (cgpa >= 4.5) return "Distinction";
  if (cgpa >= 3.5) return "Upper Credit";
  if (cgpa >= 2.5) return "Lower Credit";
  if (cgpa >= 1.5) return "Merit";
  if (cgpa >= 1.0) return "Pass";
  return "Fail";
}

async function assertRegistry(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r: any) => r.role as string);
  if (!roles.some((r) => ["registry", "super_admin", "ict_admin", "provost"].includes(r))) {
    throw new Error("Forbidden: registry role required");
  }
}

export type EligibilityRow = {
  eligible: boolean;
  cgpa: number;
  total_credits_earned: number;
  education_credits: number;
  general_studies_credits: number;
  subject_major_credits: number;
  teaching_practice_completed: boolean;
  siwes_completed: boolean;
  standing: string;
  reasons: string[];
};

export const evaluateFinalYearEligibility = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ session_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertRegistry(supabase, userId);

    // final-year students = current_level NCE3, active
    const { data: nce3 } = await supabase.from("levels").select("id").eq("code", "NCE3").maybeSingle();
    if (!nce3) throw new Error("NCE3 level not seeded");

    const { data: students, error } = await supabase
      .from("students")
      .select(`
        id, matric_number, cgpa, standing,
        profile:profiles!inner(full_name),
        programme:programmes(name),
        department:departments(code, name)
      `)
      .eq("current_level_id", nce3.id)
      .eq("is_active", true);
    if (error) throw error;

    const results = await Promise.all(
      (students ?? []).map(async (s: any) => {
        const { data: row } = await supabase.rpc("check_graduation_eligibility", { _student_id: s.id });
        const r = (Array.isArray(row) ? row[0] : row) as EligibilityRow | null;
        return {
          student_id: s.id,
          matric_number: s.matric_number,
          full_name: s.profile?.full_name ?? "—",
          programme: s.programme?.name ?? "—",
          department: s.department?.name ?? "—",
          eligibility: r,
          classification: r ? classify(Number(r.cgpa ?? 0)) : "Fail",
        };
      }),
    );

    return { session_id: data.session_id, students: results };
  });

export const listGraduationLists = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("graduation_lists")
      .select("id, title, status, session_id, created_at, session:academic_sessions(name)")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

export const createGraduationList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    session_id: z.string().uuid(),
    title: z.string().min(3).max(200),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertRegistry(supabase, userId);
    const { data: row, error } = await supabase.from("graduation_lists")
      .insert({ session_id: data.session_id, title: data.title, prepared_by: userId })
      .select("id").single();
    if (error) throw error;
    return { id: row.id };
  });

export const addEligibleToList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    list_id: z.string().uuid(),
    session_id: z.string().uuid(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertRegistry(supabase, userId);
    const evalRes = await evaluateFinalYearEligibility({ data: { session_id: data.session_id } });
    const eligible = evalRes.students.filter((s: any) => s.eligibility?.eligible);
    if (eligible.length === 0) return { added: 0 };
    const rows = eligible.map((s: any) => ({
      list_id: data.list_id,
      student_id: s.student_id,
      cgpa: s.eligibility.cgpa,
      classification: s.classification,
    }));
    const { error } = await supabase.from("graduation_list_entries").upsert(rows, { onConflict: "list_id,student_id" });
    if (error) throw error;
    return { added: rows.length };
  });

export const listGraduationEntries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ list_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("graduation_list_entries")
      .select("id, cgpa, classification, student:students!inner(matric_number, profile:profiles!inner(full_name), programme:programmes(name))")
      .eq("list_id", data.list_id);
    if (error) throw error;
    return rows ?? [];
  });

export const listProbationStudents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: rd } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const roles = (rd ?? []).map((r: any) => r.role as string);
    if (!roles.some((r) => ["registry","super_admin","ict_admin","provost","dean","hod"].includes(r))) {
      throw new Error("Forbidden");
    }
    const { data, error } = await supabase
      .from("students")
      .select(`
        id, matric_number, cgpa, standing,
        profile:profiles!inner(full_name),
        programme:programmes(name),
        department:departments(code, name),
        level:levels(code)
      `)
      .in("standing", ["probation","withdrawn"])
      .order("standing", { ascending: true });
    if (error) throw error;
    return data ?? [];
  });

export const getStandingHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ student_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("standing_history")
      .select("id, cgpa_at_time, gpa_at_time, standing, reason, created_at, semester:semesters(type, session:academic_sessions(name))")
      .eq("student_id", data.student_id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return rows ?? [];
  });

export const listAcademicSessionsForGraduation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("academic_sessions").select("id, name, status").order("start_date", { ascending: false });
    return data ?? [];
  });
