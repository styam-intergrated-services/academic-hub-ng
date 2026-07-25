import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const ALLOC_ROLES = ["registry", "hod", "dean", "super_admin", "ict_admin"] as const;
const EO_MANAGE_ROLES = ["registry", "provost", "super_admin", "ict_admin"] as const;
const SCHEDULE_STAFF_ROLES = ["registry", "dean", "super_admin", "ict_admin"] as const;

async function getRoles(supabase: any, userId: string): Promise<string[]> {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  return (data ?? []).map((r: any) => r.role as string);
}

async function assertAny(supabase: any, userId: string, allowed: readonly string[]) {
  const roles = await getRoles(supabase, userId);
  if (!roles.some((r) => allowed.includes(r))) {
    throw new Error(`Forbidden: requires one of ${allowed.join(", ")}`);
  }
}

// ==================== Part A: Course-lecturer allocation ====================

export const listOfferingsForAllocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ semester_id: z.string().uuid().optional() }).parse(d ?? {})
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("course_offerings")
      .select(`
        id, semester_id,
        course:courses!inner(id, code, title, credit_units, department_id),
        semester:semesters!inner(id, type, session:academic_sessions(name)),
        lecturers:course_lecturers(
          is_lead, lecturer_id,
          profile:profiles!course_lecturers_lecturer_id_fkey(id, full_name, email)
        )
      `)
      .order("id");
    if (data.semester_id) q = q.eq("semester_id", data.semester_id);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

export const searchStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      search: z.string().max(120).optional().default(""),
      roles: z.array(z.string()).optional().default(["lecturer", "hod", "dean", "registry", "examination_officer"]),
      limit: z.number().int().min(1).max(100).optional().default(30),
    }).parse(d ?? {})
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("user_id")
      .in("role", data.roles as any);
    const ids = Array.from(new Set((roleRows ?? []).map((r: any) => r.user_id)));
    if (ids.length === 0) return [];

    let q = supabase
      .from("profiles")
      .select("id, email, full_name")
      .in("id", ids)
      .order("full_name")
      .limit(data.limit);

    if (data.search.trim()) {
      const s = `%${data.search.trim()}%`;
      q = q.or(`email.ilike.${s},full_name.ilike.${s}`);
    }
    const { data: profiles, error } = await q;
    if (error) throw error;
    return profiles ?? [];
  });

export const allocateLecturer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      offering_id: z.string().uuid(),
      lecturer_id: z.string().uuid(),
      is_lead: z.boolean().optional().default(false),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAny(supabase, userId, ALLOC_ROLES);

    if (data.is_lead) {
      // clear existing lead flag on this offering
      await supabase
        .from("course_lecturers")
        .update({ is_lead: false })
        .eq("offering_id", data.offering_id);
    }
    const { error } = await supabase
      .from("course_lecturers")
      .upsert(
        { offering_id: data.offering_id, lecturer_id: data.lecturer_id, is_lead: data.is_lead },
        { onConflict: "offering_id,lecturer_id" }
      );
    if (error) throw error;
    return { ok: true };
  });

export const removeLecturerAllocation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      offering_id: z.string().uuid(),
      lecturer_id: z.string().uuid(),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAny(supabase, userId, ALLOC_ROLES);
    const { error } = await supabase
      .from("course_lecturers")
      .delete()
      .eq("offering_id", data.offering_id)
      .eq("lecturer_id", data.lecturer_id);
    if (error) throw error;
    return { ok: true };
  });

// ==================== Part B: Examination officers ====================

const SCOPE = z.enum(["programme", "department", "faculty"]);

export const listExaminationOfficers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("examination_officers")
      .select(`
        id, user_id, scope_type, scope_id, created_at,
        profile:profiles!examination_officers_user_id_fkey(id, full_name, email)
      `)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

export const setExaminationOfficerScope = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      user_id: z.string().uuid(),
      scope_type: SCOPE,
      scope_id: z.string().uuid(),
    }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAny(supabase, userId, EO_MANAGE_ROLES);
    const { error } = await supabase
      .from("examination_officers")
      .upsert(data, { onConflict: "user_id,scope_type,scope_id" });
    if (error) throw error;
    return { ok: true };
  });

export const removeExaminationOfficerScope = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAny(supabase, userId, EO_MANAGE_ROLES);
    const { error } = await supabase.from("examination_officers").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ==================== Part C: Scoped results/broadsheet visibility ====================

// Resolve which offering IDs the current user's EO scope covers.
async function resolveScopedOfferingIds(supabase: any, userId: string, semesterId?: string): Promise<string[]> {
  const { data: scopes } = await supabase
    .from("examination_officers")
    .select("scope_type, scope_id")
    .eq("user_id", userId);
  if (!scopes || scopes.length === 0) return [];

  const deptIds = new Set<string>();

  // faculty scope -> departments in faculty
  const facultyIds = scopes.filter((s: any) => s.scope_type === "faculty").map((s: any) => s.scope_id);
  if (facultyIds.length) {
    const { data: depts } = await supabase.from("departments").select("id").in("faculty_id", facultyIds);
    for (const d of depts ?? []) deptIds.add(d.id);
  }
  // department scope
  for (const s of scopes) if (s.scope_type === "department") deptIds.add(s.scope_id);
  // programme scope -> its department
  const progIds = scopes.filter((s: any) => s.scope_type === "programme").map((s: any) => s.scope_id);
  if (progIds.length) {
    const { data: progs } = await supabase.from("programmes").select("department_id").in("id", progIds);
    for (const p of progs ?? []) deptIds.add(p.department_id);
  }

  if (deptIds.size === 0) return [];

  const { data: courses } = await supabase.from("courses").select("id").in("department_id", Array.from(deptIds));
  const courseIds = (courses ?? []).map((c: any) => c.id);
  if (courseIds.length === 0) return [];

  let q = supabase.from("course_offerings").select("id").in("course_id", courseIds);
  if (semesterId) q = q.eq("semester_id", semesterId);
  const { data: offerings } = await q;
  return (offerings ?? []).map((o: any) => o.id);
}

export const getMyExamScope = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("examination_officers")
      .select("id, scope_type, scope_id")
      .eq("user_id", userId);
    if (error) throw error;
    return data ?? [];
  });

export const getScopedOfferings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ semester_id: z.string().uuid().optional() }).parse(d ?? {})
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const offeringIds = await resolveScopedOfferingIds(supabase, userId, data.semester_id);
    if (offeringIds.length === 0) return [];
    const { data: rows, error } = await supabase
      .from("course_offerings")
      .select(`
        id, semester_id,
        course:courses!inner(id, code, title, credit_units, department_id, department:departments(name)),
        semester:semesters!inner(id, type, session:academic_sessions(name))
      `)
      .in("id", offeringIds);
    if (error) throw error;
    return rows ?? [];
  });

export const getScopedResults = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      semester_id: z.string().uuid().optional(),
      offering_id: z.string().uuid().optional(),
    }).parse(d ?? {})
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let offeringIds: string[];
    if (data.offering_id) {
      // Ensure the offering falls within scope
      const scoped = await resolveScopedOfferingIds(supabase, userId, data.semester_id);
      if (!scoped.includes(data.offering_id)) throw new Error("Forbidden: offering out of scope");
      offeringIds = [data.offering_id];
    } else {
      offeringIds = await resolveScopedOfferingIds(supabase, userId, data.semester_id);
    }
    if (offeringIds.length === 0) return [];

    const { data: rows, error } = await supabase
      .from("results")
      .select(`
        id, ca_score, exam_score, total_score, grade, grade_point, status, status_code,
        offering:course_offerings!inner(
          id, course:courses!inner(id, code, title, credit_units),
          semester:semesters!inner(id, type, session:academic_sessions(name))
        ),
        student:students!inner(matric_number, profile:profiles!inner(full_name))
      `)
      .in("offering_id", offeringIds);
    if (error) throw error;
    return rows ?? [];
  });

// ==================== Part D: Exam scheduling + invigilation ====================

const scheduleSchema = z.object({
  id: z.string().uuid().optional(),
  offering_id: z.string().uuid(),
  exam_date: z.string(),
  start_time: z.string(),
  end_time: z.string(),
  venue: z.string().min(1).max(200),
});

async function canScheduleForOffering(supabase: any, userId: string, offeringId: string): Promise<boolean> {
  const roles = await getRoles(supabase, userId);
  if (roles.some((r) => SCHEDULE_STAFF_ROLES.includes(r as any))) return true;
  if (roles.includes("examination_officer")) {
    const scoped = await resolveScopedOfferingIds(supabase, userId);
    return scoped.includes(offeringId);
  }
  return false;
}

export const upsertExamSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => scheduleSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!(await canScheduleForOffering(supabase, userId, data.offering_id))) {
      throw new Error("Forbidden: cannot schedule for this offering");
    }
    if (data.id) {
      const { error } = await supabase.from("exam_schedules").update(data).eq("id", data.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("exam_schedules")
        .insert({ ...data, created_by: userId });
      if (error) throw error;
    }
    return { ok: true };
  });

export const deleteExamSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: sched } = await supabase
      .from("exam_schedules")
      .select("offering_id")
      .eq("id", data.id)
      .maybeSingle();
    if (!sched) throw new Error("Schedule not found");
    if (!(await canScheduleForOffering(supabase, userId, sched.offering_id))) {
      throw new Error("Forbidden");
    }
    const { error } = await supabase.from("exam_schedules").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const listExamSchedules = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      semester_id: z.string().uuid().optional(),
      offering_ids: z.array(z.string().uuid()).optional(),
    }).parse(d ?? {})
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("exam_schedules")
      .select(`
        id, offering_id, exam_date, start_time, end_time, venue, created_at,
        offering:course_offerings!inner(
          id, semester_id,
          course:courses!inner(id, code, title),
          semester:semesters!inner(id, type, session:academic_sessions(name))
        ),
        invigilators:exam_invigilators(
          id, staff_id,
          profile:profiles!exam_invigilators_staff_id_fkey(id, full_name, email)
        )
      `)
      .order("exam_date");
    if (data.offering_ids?.length) q = q.in("offering_id", data.offering_ids);
    const { data: rows, error } = await q;
    if (error) throw error;
    let filtered = rows ?? [];
    if (data.semester_id) {
      filtered = filtered.filter((r: any) => r.offering?.semester_id === data.semester_id);
    }
    return filtered;
  });

export const assignInvigilator = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ schedule_id: z.string().uuid(), staff_id: z.string().uuid() }).parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: sched } = await supabase
      .from("exam_schedules")
      .select("offering_id")
      .eq("id", data.schedule_id)
      .maybeSingle();
    if (!sched) throw new Error("Schedule not found");
    if (!(await canScheduleForOffering(supabase, userId, sched.offering_id))) {
      throw new Error("Forbidden");
    }
    const { error } = await supabase
      .from("exam_invigilators")
      .upsert(data, { onConflict: "schedule_id,staff_id" });
    if (error) throw error;
    return { ok: true };
  });

export const removeInvigilator = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row } = await supabase
      .from("exam_invigilators")
      .select("schedule_id, exam_schedules:schedule_id(offering_id)")
      .eq("id", data.id)
      .maybeSingle();
    if (!row) throw new Error("Not found");
    const offeringId = (row as any).exam_schedules?.offering_id;
    if (offeringId && !(await canScheduleForOffering(supabase, userId, offeringId))) {
      throw new Error("Forbidden");
    }
    const { error } = await supabase.from("exam_invigilators").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
