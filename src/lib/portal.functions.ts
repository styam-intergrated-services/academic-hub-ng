import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AppRole =
  | "super_admin" | "ict_admin" | "provost" | "registry" | "bursary"
  | "dean" | "hod" | "lecturer" | "examination_officer" | "student" | "applicant";


export interface PortalUser {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  roles: AppRole[];
  primary_role: AppRole;
  student?: {
    matric_number: string;
    programme_id: string;
    department_id: string;
    current_level_id: string;
    cgpa: number;
    standing: string;
    total_credit_units: number;
    total_grade_points: number;
  } | null;
}

const ROLE_PRIORITY: AppRole[] = [
  "super_admin","ict_admin","provost","registry","bursary","dean","hod","lecturer","student","applicant",
];


export const getPortalUser = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PortalUser> => {
    const { supabase, userId } = context;

    const [{ data: profile }, { data: rolesData }, { data: student }] = await Promise.all([
      supabase.from("profiles").select("id,email,full_name,avatar_url").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("students").select("matric_number,programme_id,department_id,current_level_id,cgpa,standing,total_credit_units,total_grade_points")
        .eq("id", userId).maybeSingle(),
    ]);

    const roles = (rolesData ?? []).map((r) => r.role as AppRole);
    if (roles.length === 0) roles.push("applicant");
    const primary_role = ROLE_PRIORITY.find((r) => roles.includes(r)) ?? "applicant";

    return {
      id: userId,
      email: profile?.email ?? "",
      full_name: profile?.full_name ?? null,
      avatar_url: profile?.avatar_url ?? null,
      roles,
      primary_role,
      student: student ?? null,
    };
  });

// Lightweight counts for student dashboard cards.
export const getStudentDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // Current semester id (if any)
    const { data: sem } = await supabase
      .from("semesters")
      .select("id")
      .eq("is_current", true)
      .maybeSingle();

    const publishedP = supabase
      .from("results")
      .select("id", { count: "exact", head: true })
      .eq("student_id", userId)
      .eq("status", "published");

    let registeredCount = 0;
    if (sem?.id) {
      // Filter registrations by current semester via offering.semester_id
      const { data: offerings } = await supabase
        .from("course_offerings")
        .select("id")
        .eq("semester_id", sem.id);
      const offeringIds = (offerings ?? []).map((o: { id: string }) => o.id);
      if (offeringIds.length > 0) {
        const { count } = await supabase
          .from("course_registrations")
          .select("id", { count: "exact", head: true })
          .eq("student_id", userId)
          .in("offering_id", offeringIds)
          .in("status", ["pending", "approved"]);
        registeredCount = count ?? 0;
      }
    }

    const { count: publishedCount } = await publishedP;

    return {
      registered_courses: registeredCount,
      published_results: publishedCount ?? 0,
    };
  });

// Count of course offerings the lecturer is assigned to in the current semester.
export const getLecturerTeachingCount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: sem } = await supabase
      .from("semesters")
      .select("id")
      .eq("is_current", true)
      .maybeSingle();
    if (!sem?.id) return { count: 0 };

    const { data: offerings } = await supabase
      .from("course_offerings")
      .select("id")
      .eq("semester_id", sem.id);
    const offeringIds = (offerings ?? []).map((o: { id: string }) => o.id);
    if (offeringIds.length === 0) return { count: 0 };

    const { count } = await supabase
      .from("course_lecturers")
      .select("offering_id", { count: "exact", head: true })
      .eq("lecturer_id", userId)
      .in("offering_id", offeringIds);
    return { count: count ?? 0 };
  });
