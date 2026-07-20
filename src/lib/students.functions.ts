import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const STANDINGS = ["excellent", "good", "probation", "withdrawn"] as const;

type AnySupabase = any;

async function getRoles(supabase: AnySupabase, userId: string): Promise<string[]> {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  return (data ?? []).map((r: any) => r.role as string);
}

/**
 * Returns null when the caller can see all students (registry / super_admin / ict_admin / bursary).
 * Returns an array of allowed department_ids when scope is limited (hod / dean).
 * Returns [] when scope is empty (no visibility).
 */
async function departmentScope(
  supabase: AnySupabase,
  userId: string,
  roles: string[],
): Promise<string[] | null> {
  if (roles.some((r) => ["super_admin", "ict_admin", "registry", "bursary"].includes(r))) {
    return null;
  }
  const ids = new Set<string>();
  if (roles.includes("hod")) {
    const { data } = await supabase.from("departments").select("id").eq("hod_id", userId);
    (data ?? []).forEach((d: any) => ids.add(d.id));
  }
  if (roles.includes("dean")) {
    const { data: fac } = await supabase.from("faculties").select("id").eq("dean_id", userId);
    const facIds = (fac ?? []).map((f: any) => f.id);
    if (facIds.length) {
      const { data: dep } = await supabase.from("departments").select("id").in("faculty_id", facIds);
      (dep ?? []).forEach((d: any) => ids.add(d.id));
    }
  }
  return Array.from(ids);
}

function assertStaff(roles: string[]) {
  if (!roles.some((r) =>
    ["super_admin", "ict_admin", "registry", "bursary", "dean", "hod", "lecturer"].includes(r),
  )) {
    throw new Error("Forbidden: staff role required");
  }
}

// =============== LIST ===============

const listSchema = z.object({
  search: z.string().max(120).optional().default(""),
  department_id: z.string().uuid().optional(),
  programme_id: z.string().uuid().optional(),
  level_id: z.string().uuid().optional(),
  session_id: z.string().uuid().optional(),
  standing: z.enum(STANDINGS).optional(),
  is_active: z.boolean().optional(),
  page: z.number().int().min(1).optional().default(1),
  pageSize: z.number().int().min(1).max(100).optional().default(25),
});

export const listStudents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => listSchema.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const roles = await getRoles(supabase, userId);
    assertStaff(roles);

    const scope = await departmentScope(supabase, userId, roles);
    let allowedDeptIds: string[] | null = scope;
    if (data.department_id) {
      if (allowedDeptIds && !allowedDeptIds.includes(data.department_id)) {
        return { rows: [], total: 0 };
      }
      allowedDeptIds = [data.department_id];
    }

    // Prefilter by name/email search via profiles when search present
    let matchIds: string[] | null = null;
    if (data.search.trim()) {
      const s = `%${data.search.trim()}%`;
      const [{ data: profs }, { data: matric }] = await Promise.all([
        supabase.from("profiles").select("id").or(`email.ilike.${s},full_name.ilike.${s}`).limit(500),
        supabase.from("students").select("id").ilike("matric_number", s).limit(500),
      ]);
      matchIds = Array.from(new Set([...(profs ?? []).map((p: any) => p.id), ...(matric ?? []).map((m: any) => m.id)]));
      if (matchIds.length === 0) return { rows: [], total: 0 };
    }

    let q = supabase
      .from("students")
      .select("id, matric_number, programme_id, department_id, current_level_id, entry_session_id, cgpa, standing, is_active", { count: "exact" })
      .order("matric_number", { ascending: true });

    if (allowedDeptIds !== null) {
      if (allowedDeptIds.length === 0) return { rows: [], total: 0 };
      q = q.in("department_id", allowedDeptIds);
    }
    if (data.programme_id) q = q.eq("programme_id", data.programme_id);
    if (data.level_id) q = q.eq("current_level_id", data.level_id);
    if (data.session_id) q = q.eq("entry_session_id", data.session_id);
    if (data.standing) q = q.eq("standing", data.standing);
    if (typeof data.is_active === "boolean") q = q.eq("is_active", data.is_active);
    if (matchIds) q = q.in("id", matchIds);

    const from = (data.page - 1) * data.pageSize;
    const to = from + data.pageSize - 1;
    const { data: rows, count, error } = await q.range(from, to);
    if (error) throw error;

    const ids = (rows ?? []).map((r: any) => r.id);
    const profiles = ids.length
      ? (await supabase.from("profiles").select("id, full_name, email, avatar_url").in("id", ids)).data ?? []
      : [];
    const pMap = new Map(profiles.map((p: any) => [p.id, p]));

    return {
      rows: (rows ?? []).map((r: any) => ({
        ...r,
        full_name: pMap.get(r.id)?.full_name ?? null,
        email: pMap.get(r.id)?.email ?? null,
        avatar_url: pMap.get(r.id)?.avatar_url ?? null,
      })),
      total: count ?? 0,
    };
  });

// =============== DETAIL ===============

export const getStudentDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const roles = await getRoles(supabase, userId);
    const isSelf = data.id === userId;
    if (!isSelf) assertStaff(roles);

    const { data: student, error } = await supabase
      .from("students")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw error;
    if (!student) throw new Error("Student not found");

    // Scope check
    if (!isSelf) {
      const scope = await departmentScope(supabase, userId, roles);
      if (scope !== null && !scope.includes(student.department_id)) {
        throw new Error("Forbidden: student outside your scope");
      }
    }

    const [profile, gpa, regs, results] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", data.id).maybeSingle(),
      supabase.from("gpa_records").select("*, semesters:semester_id(id, type, session_id, academic_sessions:session_id(name))").eq("student_id", data.id).order("computed_at", { ascending: false }),
      supabase.from("course_registrations").select("id, status, registered_at, offering_id, course_offerings:offering_id(id, semester_id, courses:course_id(id, code, title, credit_units))").eq("student_id", data.id).order("registered_at", { ascending: false }).limit(200),
      supabase.from("results").select("id, status, ca_score, exam_score, total_score, grade, grade_point, offering_id, course_offerings:offering_id(semester_id, courses:course_id(code, title, credit_units))").eq("student_id", data.id).eq("status", "published").limit(500),
    ]);

    return {
      student,
      profile: profile.data ?? null,
      gpa_records: gpa.data ?? [],
      registrations: regs.data ?? [],
      results: results.data ?? [],
    };
  });

// =============== ADMIN UPDATE ===============

const patchSchema = z.object({
  id: z.string().uuid(),
  patch: z.object({
    current_level_id: z.string().uuid().optional(),
    programme_id: z.string().uuid().optional(),
    department_id: z.string().uuid().optional(),
    is_active: z.boolean().optional(),
  }),
});

export const updateStudentAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => patchSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const roles = await getRoles(supabase, userId);
    if (!roles.some((r) => ["super_admin", "ict_admin", "registry"].includes(r))) {
      throw new Error("Forbidden: registry role required");
    }
    if (Object.keys(data.patch).length === 0) return { ok: true };

    const { data: before } = await supabase.from("students").select("*").eq("id", data.id).maybeSingle();
    if (!before) throw new Error("Student not found");

    const { error } = await supabase.from("students").update(data.patch).eq("id", data.id);
    if (error) throw error;

    await supabase.from("audit_logs").insert({
      actor_id: userId,
      action: "student.update",
      entity: "students",
      entity_id: data.id,
      metadata: { before, patch: data.patch },
    });
    return { ok: true };
  });

// =============== MANAGEMENT STATS ===============

export const getManagementStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const roles = await getRoles(supabase, userId);
    assertStaff(roles);

    const scope = await departmentScope(supabase, userId, roles);

    const base = () => {
      let q = supabase.from("students").select("id, cgpa, standing, is_active, current_level_id", { count: "exact" });
      if (scope !== null) {
        if (scope.length === 0) return { q, empty: true as const };
        q = q.in("department_id", scope);
      }
      return { q, empty: false as const };
    };

    const b = base();
    const students = b.empty ? { data: [] as any[], count: 0 } : await b.q.limit(10_000);

    const rows = (students.data ?? []) as Array<{ cgpa: number; standing: string; is_active: boolean; current_level_id: string }>;
    const total = students.count ?? rows.length;
    const active = rows.filter((r) => r.is_active).length;
    const probation = rows.filter((r) => r.standing === "probation").length;
    const withdrawn = rows.filter((r) => r.standing === "withdrawn").length;
    const avgCgpa = rows.length ? Number((rows.reduce((a, r) => a + Number(r.cgpa || 0), 0) / rows.length).toFixed(2)) : 0;

    const standingCounts = { excellent: 0, good: 0, probation: 0, withdrawn: 0 } as Record<string, number>;
    for (const r of rows) standingCounts[r.standing] = (standingCounts[r.standing] ?? 0) + 1;

    // Students per level
    const levelCounts = new Map<string, number>();
    for (const r of rows) levelCounts.set(r.current_level_id, (levelCounts.get(r.current_level_id) ?? 0) + 1);
    const { data: levels } = await supabase.from("levels").select("id, name, order_index").order("order_index");
    const perLevel = (levels ?? []).map((l: any) => ({ level: l.name, count: levelCounts.get(l.id) ?? 0 }));

    // Results pipeline (current semester if any) — scoped by department when applicable
    const { data: currentSemRow } = await supabase.from("semesters")
      .select("id, type, registration_open, session:academic_sessions(name)")
      .eq("is_current", true)
      .maybeSingle();
    let pipeline = { draft: 0, submitted: 0, hod_approved: 0, dean_approved: 0, registry_approved: 0, published: 0, rejected: 0 } as Record<string, number>;
    let pendingApprovals = 0;
    let pendingForMe: Array<{ offering_id: string; course_code: string; course_title: string; semester: string; count: number; status: string }> = [];
    let scopedOfferingIds: string[] = [];

    if (currentSemRow?.id) {
      let offQ = supabase.from("course_offerings").select("id, course:courses!inner(id, code, title, department_id)").eq("semester_id", currentSemRow.id);
      if (scope !== null) {
        if (scope.length === 0) offQ = offQ.eq("id", "00000000-0000-0000-0000-000000000000");
        else offQ = offQ.in("courses.department_id", scope);
      }
      const { data: offs } = await offQ;
      const offList = (offs ?? []) as any[];
      scopedOfferingIds = offList.map((o) => o.id);
      const offMeta = new Map(offList.map((o) => [o.id, o]));

      if (scopedOfferingIds.length) {
        const { data: res } = await supabase.from("results").select("status, offering_id").in("offering_id", scopedOfferingIds);
        for (const r of res ?? []) pipeline[r.status as string] = (pipeline[r.status as string] ?? 0) + 1;
        pendingApprovals = (pipeline.submitted ?? 0) + (pipeline.hod_approved ?? 0) + (pipeline.dean_approved ?? 0);

        // Determine caller's approval level and build "pending for me" bundle
        const myStatuses: string[] = [];
        if (roles.includes("hod")) myStatuses.push("submitted");
        if (roles.includes("dean")) myStatuses.push("hod_approved");
        if (roles.some((r) => ["registry","super_admin","ict_admin"].includes(r))) { myStatuses.push("dean_approved"); myStatuses.push("registry_approved"); }
        if (myStatuses.length) {
          const groups = new Map<string, { count: number; status: string }>();
          for (const r of (res ?? []) as any[]) {
            if (!myStatuses.includes(r.status)) continue;
            const g = groups.get(r.offering_id) ?? { count: 0, status: r.status };
            g.count++;
            groups.set(r.offering_id, g);
          }
          pendingForMe = Array.from(groups.entries())
            .map(([offering_id, v]) => {
              const meta: any = offMeta.get(offering_id);
              return {
                offering_id,
                course_code: meta?.course?.code ?? "",
                course_title: meta?.course?.title ?? "",
                semester: `${currentSemRow.type} · ${(currentSemRow as any).session?.name ?? ""}`,
                count: v.count,
                status: v.status,
              };
            })
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
        }
      }
    }

    // Simple aggregates
    const { count: lecturerCount } = await supabase.from("user_roles").select("*", { count: "exact", head: true }).eq("role", "lecturer");
    const { count: departmentCount } = await supabase.from("departments").select("*", { count: "exact", head: true });

    return {
      scope: scope === null ? "all" : scope.length === 0 ? "none" : "partial",
      totals: { students: total, active, probation, withdrawn, avgCgpa, lecturers: lecturerCount ?? 0, departments: departmentCount ?? 0, pendingApprovals },
      standingCounts,
      perLevel,
      pipeline,
      pendingForMe,
      currentSemester: currentSemRow ? {
        id: currentSemRow.id,
        type: currentSemRow.type,
        registration_open: currentSemRow.registration_open,
        session_name: (currentSemRow as any).session?.name ?? "",
      } : null,
      currentSemesterId: currentSemRow?.id ?? null,
    };
  });
