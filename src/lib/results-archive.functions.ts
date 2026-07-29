import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * College-wide results archive.
 *
 * Super Admin / ICT Admin / Registry see every result record.
 * Examination Officers see the same page but restricted to the offerings that
 * fall inside their assigned programme / department / faculty scope.
 *
 * Read-only: no writes are exposed from this module.
 */

const FULL_ACCESS = ["super_admin", "ict_admin", "registry"] as const;

export type ArchiveRow = {
  id: string;
  ca_score: number | null;
  exam_score: number | null;
  total_score: number | null;
  grade: string | null;
  grade_point: number | null;
  status: string;
  status_code: string;
  session_name: string;
  semester_label: string;
  semester_id: string;
  session_id: string;
  department_id: string;
  department_name: string;
  level_id: string;
  level_code: string;
  level_name: string;
  level_order: number;
  course_id: string;
  course_code: string;
  course_title: string;
  credit_units: number;
  category: string;
  offering_id: string;
  student_id: string;
  matric_number: string;
  student_name: string;
  programme_id: string | null;
  programme_name: string | null;
};

export type ArchivePayload = {
  scope: "college" | "scoped";
  rows: ArchiveRow[];
  truncated: boolean;
};

async function getRoles(supabase: any, userId: string): Promise<string[]> {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  return (data ?? []).map((r: any) => r.role as string);
}

/** Offering IDs covered by the caller's examination-officer scope. */
async function resolveScopedOfferingIds(admin: any, userId: string): Promise<string[]> {
  const { data: scopes } = await admin
    .from("examination_officers")
    .select("scope_type, scope_id")
    .eq("user_id", userId);
  if (!scopes || scopes.length === 0) return [];

  const deptIds = new Set<string>();

  const facultyIds = scopes.filter((s: any) => s.scope_type === "faculty").map((s: any) => s.scope_id);
  if (facultyIds.length) {
    const { data: depts } = await admin.from("departments").select("id").in("faculty_id", facultyIds);
    for (const d of depts ?? []) deptIds.add(d.id);
  }
  for (const s of scopes) if (s.scope_type === "department") deptIds.add(s.scope_id);
  const progIds = scopes.filter((s: any) => s.scope_type === "programme").map((s: any) => s.scope_id);
  if (progIds.length) {
    const { data: progs } = await admin.from("programmes").select("department_id").in("id", progIds);
    for (const p of progs ?? []) deptIds.add(p.department_id);
  }
  if (deptIds.size === 0) return [];

  const { data: courses } = await admin.from("courses").select("id").in("department_id", Array.from(deptIds));
  const courseIds = (courses ?? []).map((c: any) => c.id);
  if (courseIds.length === 0) return [];

  const { data: offerings } = await admin.from("course_offerings").select("id").in("course_id", courseIds);
  return (offerings ?? []).map((o: any) => o.id);
}

const SELECT = `
  id, ca_score, exam_score, total_score, grade, grade_point, status, status_code,
  student_id, offering_id,
  offering:course_offerings!inner(
    id,
    semester:semesters!inner(id, type, label, contact_number, session:academic_sessions(id, name)),
    course:courses!inner(
      id, code, title, credit_units, category,
      level:levels(id, code, name, order_index),
      department:departments(id, name)
    )
  ),
  student:students!inner(
    id, matric_number, full_name, auth_user_id,
    programme:programmes(id, name)
  )
`;

const PAGE = 1000;
const MAX_ROWS = 20000;

export const getResultsArchive = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ArchivePayload> => {
    const { supabase, userId } = context;
    const roles = await getRoles(supabase, userId);
    const full = roles.some((r) => (FULL_ACCESS as readonly string[]).includes(r));
    const isEo = roles.includes("examination_officer");
    if (!full && !isEo) throw new Error("Forbidden: results archive is restricted");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let scopedOfferingIds: string[] | null = null;
    if (!full) {
      scopedOfferingIds = await resolveScopedOfferingIds(supabaseAdmin, userId);
      if (scopedOfferingIds.length === 0) {
        return { scope: "scoped", rows: [], truncated: false };
      }
    }

    const raw: any[] = [];
    let from = 0;
    let truncated = false;
    // PostgREST caps a single response at 1000 rows; page through.
    for (;;) {
      let q = supabaseAdmin
        .from("results")
        .select(SELECT)
        .order("id")
        .range(from, from + PAGE - 1);
      if (scopedOfferingIds) q = q.in("offering_id", scopedOfferingIds);
      const { data, error } = await q;
      if (error) throw error;
      const batch = (data ?? []) as any[];
      raw.push(...batch);
      if (batch.length < PAGE) break;
      from += PAGE;
      if (raw.length >= MAX_ROWS) { truncated = true; break; }
    }

    // Student display names: prefer the students row, fall back to the profile.
    const authIds = Array.from(
      new Set(raw.map((r) => r.student?.auth_user_id).filter(Boolean))
    ) as string[];
    const nameByAuthId = new Map<string, string>();
    for (let i = 0; i < authIds.length; i += 500) {
      const slice = authIds.slice(i, i + 500);
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name")
        .in("id", slice);
      for (const p of profs ?? []) if (p.full_name) nameByAuthId.set(p.id, p.full_name);
    }

    const rows: ArchiveRow[] = raw.map((r) => {
      const course = r.offering?.course ?? {};
      const sem = r.offering?.semester ?? {};
      const level = course.level ?? {};
      const dept = course.department ?? {};
      const stu = r.student ?? {};
      const semLabel =
        sem.label ??
        (sem.contact_number ? `Contact ${sem.contact_number}` : sem.type === "second" ? "Second semester" : "First semester");
      return {
        id: r.id,
        ca_score: r.ca_score,
        exam_score: r.exam_score,
        total_score: r.total_score,
        grade: r.grade,
        grade_point: r.grade_point,
        status: r.status,
        status_code: r.status_code,
        session_id: sem.session?.id ?? "",
        session_name: sem.session?.name ?? "—",
        semester_id: sem.id ?? "",
        semester_label: semLabel,
        department_id: dept.id ?? "",
        department_name: dept.name ?? "Unassigned department",
        level_id: level.id ?? "",
        level_code: level.code ?? "—",
        level_name: level.name ?? "Unassigned level",
        level_order: level.order_index ?? 999,
        course_id: course.id ?? "",
        course_code: course.code ?? "—",
        course_title: course.title ?? "—",
        credit_units: course.credit_units ?? 0,
        category: course.category ?? "—",
        offering_id: r.offering_id,
        student_id: r.student_id,
        matric_number: stu.matric_number ?? "—",
        student_name: stu.full_name || nameByAuthId.get(stu.auth_user_id) || "—",
        programme_id: stu.programme?.id ?? null,
        programme_name: stu.programme?.name ?? null,
      };
    });

    return { scope: full ? "college" : "scoped", rows, truncated };
  });
