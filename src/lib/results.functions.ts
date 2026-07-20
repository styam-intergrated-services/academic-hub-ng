import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// -------- Lecturer teaching --------
export const getMyTeaching = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("course_lecturers")
      .select(`
        is_lead,
        offering:course_offerings!inner(
          id, max_students,
          course:courses!inner(id, code, title, credit_units, level:levels(code,name)),
          semester:semesters!inner(id, type, is_current, registration_open, session:academic_sessions(name,status))
        )
      `)
      .eq("lecturer_id", userId);
    if (error) throw error;
    return data ?? [];
  });

// -------- Roster for an offering --------
export const getOfferingRoster = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { offering_id: string }) => z.object({ offering_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("course_registrations")
      .select(`
        id, student_id,
        student:students!inner(matric_number, profile:profiles!inner(full_name)),
        result:results(id, ca_score, exam_score, total_score, grade, grade_point, status, rejection_reason)
      `)
      .eq("offering_id", data.offering_id)
      .eq("status", "approved");
    if (error) throw error;
    return rows ?? [];
  });

// -------- Upsert a single score (draft) --------
export const upsertResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    registration_id: z.string().uuid(),
    student_id: z.string().uuid(),
    offering_id: z.string().uuid(),
    ca_score: z.number().min(0).max(40).nullable(),
    exam_score: z.number().min(0).max(60).nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("results").upsert({
      registration_id: data.registration_id,
      student_id: data.student_id,
      offering_id: data.offering_id,
      ca_score: data.ca_score,
      exam_score: data.exam_score,
      status: "draft",
      submitted_by: userId,
    }, { onConflict: "registration_id" });
    if (error) throw error;
    return { ok: true };
  });

// -------- Bulk upsert (from CSV import) --------
export const upsertResultsBulk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    offering_id: z.string().uuid(),
    rows: z.array(z.object({
      registration_id: z.string().uuid(),
      student_id: z.string().uuid(),
      ca_score: z.number().min(0).max(40).nullable(),
      exam_score: z.number().min(0).max(60).nullable(),
    })).min(1).max(1000),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verify caller teaches this offering
    const { data: teach } = await supabase.from("course_lecturers")
      .select("lecturer_id").eq("offering_id", data.offering_id).eq("lecturer_id", userId).maybeSingle();
    if (!teach) throw new Error("Forbidden: not a lecturer for this offering");

    // Fetch existing results to skip locked rows (anything past draft/rejected)
    const { data: existing } = await supabase.from("results")
      .select("registration_id,status")
      .eq("offering_id", data.offering_id);
    const statusByReg = new Map<string, string>((existing ?? []).map((r: any) => [r.registration_id, r.status]));
    const editable = new Set(["draft","hod_rejected","dean_rejected","registry_rejected"]);

    const payload = data.rows
      .filter((r) => {
        const s = statusByReg.get(r.registration_id);
        return !s || editable.has(s);
      })
      .map((r) => ({
        registration_id: r.registration_id,
        student_id: r.student_id,
        offering_id: data.offering_id,
        ca_score: r.ca_score,
        exam_score: r.exam_score,
        status: "draft" as const,
        submitted_by: userId,
      }));

    if (payload.length === 0) return { written: 0, skipped: data.rows.length };
    const { error } = await supabase.from("results").upsert(payload, { onConflict: "registration_id" });
    if (error) throw error;
    return { written: payload.length, skipped: data.rows.length - payload.length };
  });

// -------- Toggle current-semester registration open/closed --------
export const setRegistrationOpen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ open: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const roles = (roleRows ?? []).map((r: any) => r.role as string);
    if (!roles.some((r) => ["registry","super_admin","ict_admin"].includes(r))) {
      throw new Error("Forbidden: registry role required");
    }
    const { data: sem } = await supabase.from("semesters").select("id,registration_open").eq("is_current", true).maybeSingle();
    if (!sem) throw new Error("No current semester set");
    const { error } = await supabase.from("semesters")
      .update({ registration_open: data.open })
      .eq("id", sem.id);
    if (error) throw error;
    await supabase.from("audit_logs").insert({
      actor_id: userId,
      action: "semester.registration_toggle",
      entity: "semesters",
      entity_id: sem.id,
      metadata: { before: sem.registration_open, after: data.open },
    });
    return { ok: true };
  });

// -------- Submit results for an offering (lecturer -> HOD) --------
export const submitResults = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ offering_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("results")
      .update({ status: "submitted", submitted_by: userId, submitted_at: new Date().toISOString() })
      .eq("offering_id", data.offering_id)
      .in("status", ["draft","hod_rejected","dean_rejected","registry_rejected"]);
    if (error) throw error;
    return { ok: true };
  });

// -------- Approvals list (pending at my level) --------
export const getPendingApprovals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: rolesData } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const roles = (rolesData ?? []).map((r) => r.role as string);

    let statuses: string[] = [];
    if (roles.includes("hod")) statuses.push("submitted");
    if (roles.includes("dean")) statuses.push("hod_approved");
    if (roles.some((r) => ["registry","super_admin","ict_admin"].includes(r))) statuses.push("dean_approved");
    if (statuses.length === 0) return { statuses: [], groups: [] };

    const { data, error } = await supabase
      .from("results")
      .select(`
        id, ca_score, exam_score, total_score, grade, grade_point, status,
        rejection_reason,
        hod_approved_by, hod_approved_at,
        dean_approved_by, dean_approved_at,
        registry_approved_by, registry_approved_at,
        offering:course_offerings!inner(
          id,
          course:courses!inner(id, code, title, credit_units, department_id),
          semester:semesters!inner(id, type, session:academic_sessions(name))
        ),
        student:students!inner(matric_number, profile:profiles!inner(full_name))
      `)
      .in("status", statuses as any);
    if (error) throw error;

    // group by offering
    const map = new Map<string, any>();
    for (const r of (data as any[]) ?? []) {
      const key = r.offering.id;
      if (!map.has(key)) map.set(key, { offering: r.offering, results: [] });
      map.get(key)!.results.push(r);
    }
    return { statuses, groups: Array.from(map.values()) };
  });

// -------- Approve / Reject at level --------
export const decideApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    offering_id: z.string().uuid(),
    action: z.enum(["approve","reject","publish"]),
    level: z.enum(["hod","dean","registry"]),
    reason: z.string().max(500).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const now = new Date().toISOString();

    const nextStatus: Record<string, string> = {
      "hod:approve": "hod_approved",
      "hod:reject": "hod_rejected",
      "dean:approve": "dean_approved",
      "dean:reject": "dean_rejected",
      "registry:approve": "registry_approved",
      "registry:reject": "registry_rejected",
      "registry:publish": "published",
    };
    const requiredCurrent: Record<string, string[]> = {
      "hod:approve": ["submitted"], "hod:reject": ["submitted"],
      "dean:approve": ["hod_approved"], "dean:reject": ["hod_approved"],
      "registry:approve": ["dean_approved"], "registry:reject": ["dean_approved"],
      "registry:publish": ["registry_approved"],
    };
    const key = `${data.level}:${data.action}`;
    const target = nextStatus[key];
    if (!target) throw new Error("Invalid action");

    type ResultUpdate = {
      status: string; rejection_reason?: string;
      hod_approved_by?: string; hod_approved_at?: string;
      dean_approved_by?: string; dean_approved_at?: string;
      registry_approved_by?: string; registry_approved_at?: string;
    };
    const update: ResultUpdate = { status: target };
    if (data.reason) update.rejection_reason = data.reason;
    if (data.level === "hod" && data.action === "approve") { update.hod_approved_by = userId; update.hod_approved_at = now; }
    if (data.level === "dean" && data.action === "approve") { update.dean_approved_by = userId; update.dean_approved_at = now; }
    if (data.level === "registry" && data.action === "approve") { update.registry_approved_by = userId; update.registry_approved_at = now; }

    const { error } = await supabase.from("results")
      .update(update as never)
      .eq("offering_id", data.offering_id)
      .in("status", requiredCurrent[key] as never);

    if (error) throw error;
    return { ok: true, target };
  });

// -------- Student published results + GPA --------
export const getMyResults = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: results, error }, { data: gpa }] = await Promise.all([
      supabase.from("results")
        .select(`
          id, ca_score, exam_score, total_score, grade, grade_point, status, published_at,
          offering:course_offerings!inner(
            course:courses!inner(code, title, credit_units),
            semester:semesters!inner(type, session:academic_sessions(name))
          )
        `)
        .eq("student_id", userId).eq("status", "published"),
      supabase.from("gpa_records")
        .select(`gpa, cgpa, credit_units, grade_points, standing, semester:semesters(type, session:academic_sessions(name))`)
        .eq("student_id", userId)
        .order("computed_at", { ascending: false }),
    ]);
    if (error) throw error;
    return { results: results ?? [], gpa: gpa ?? [] };
  });

// ============ EXPORTS + BROADSHEETS + AUDIT ============

// Flat rows for CSV / Excel / PDF export. Approved-or-published only.
export const getExportRows = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    semester_id: z.string().uuid().nullable().optional(),
    department_id: z.string().uuid().nullable().optional(),
    programme_id: z.string().uuid().nullable().optional(),
    offering_id: z.string().uuid().nullable().optional(),
    include_approved: z.boolean().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const statuses = data.include_approved
      ? ["registry_approved", "published"]
      : ["published"];

    let q = supabase.from("results").select(`
      id, ca_score, exam_score, total_score, grade, grade_point, status, published_at,
      student:students!inner(matric_number, programme_id, current_level_id, department_id, profile:profiles!inner(full_name)),
      offering:course_offerings!inner(
        id, semester_id,
        course:courses!inner(code, title, credit_units, department_id),
        semester:semesters!inner(type, session:academic_sessions(name))
      )
    `).in("status", statuses as never);
    if (data.semester_id) q = q.eq("offering.semester_id", data.semester_id);
    if (data.offering_id) q = q.eq("offering_id", data.offering_id);
    if (data.department_id) q = q.eq("offering.course.department_id", data.department_id);
    if (data.programme_id) q = q.eq("student.programme_id", data.programme_id);

    const { data: rows, error } = await q;
    if (error) throw error;

    const [{ data: prog }, { data: dept }, { data: lev }] = await Promise.all([
      supabase.from("programmes").select("id,name,code"),
      supabase.from("departments").select("id,name,code"),
      supabase.from("levels").select("id,code,name"),
    ]);
    const pm = new Map((prog ?? []).map((p: any) => [p.id, p]));
    const dm = new Map((dept ?? []).map((d: any) => [d.id, d]));
    const lm = new Map((lev ?? []).map((l: any) => [l.id, l]));

    return (rows ?? []).map((r: any) => ({
      matric_number: r.student.matric_number,
      full_name: r.student.profile?.full_name ?? "",
      programme: pm.get(r.student.programme_id)?.name ?? "",
      programme_code: pm.get(r.student.programme_id)?.code ?? "",
      department: dm.get(r.student.department_id)?.name ?? dm.get(r.offering.course.department_id)?.name ?? "",
      level: lm.get(r.student.current_level_id)?.code ?? "",
      session: r.offering.semester.session?.name ?? "",
      semester: r.offering.semester.type,
      course_code: r.offering.course.code,
      course_title: r.offering.course.title,
      credit_units: r.offering.course.credit_units,
      ca_score: r.ca_score,
      exam_score: r.exam_score,
      total_score: r.total_score,
      grade: r.grade,
      grade_point: r.grade_point,
      status: r.status,
      published_at: r.published_at,
    }));
  });

// Approved/published offerings the caller can broadsheet or export from.
export const listApprovedOfferings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    semester_id: z.string().uuid().nullable().optional(),
    department_id: z.string().uuid().nullable().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase.from("results").select(`
      offering_id, status,
      offering:course_offerings!inner(
        id, semester_id,
        course:courses!inner(code, title, credit_units, department_id),
        semester:semesters!inner(type, session:academic_sessions(name))
      )
    `).in("status", ["registry_approved","published"] as never);
    if (data.semester_id) q = q.eq("offering.semester_id", data.semester_id);
    if (data.department_id) q = q.eq("offering.course.department_id", data.department_id);
    const { data: rows, error } = await q;
    if (error) throw error;
    const map = new Map<string, any>();
    for (const r of (rows ?? []) as any[]) {
      const key = r.offering_id;
      const e = map.get(key) ?? { offering: r.offering, published: 0, approved: 0 };
      if (r.status === "published") e.published++; else e.approved++;
      map.set(key, e);
    }
    return Array.from(map.values());
  });

// Full broadsheet dataset for a single offering.
export const getBroadsheetData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ offering_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: offering, error: e1 } = await supabase.from("course_offerings")
      .select(`
        id,
        course:courses!inner(code, title, credit_units,
          department:departments!inner(id, name, code,
            faculty:faculties(id, name, code))),
        semester:semesters!inner(type, session:academic_sessions(name)),
        lecturers:course_lecturers(lecturer_id, is_lead)
      `).eq("id", data.offering_id).maybeSingle();
    if (e1) throw e1;
    if (!offering) throw new Error("Offering not found");

    const lecturerIds = ((offering as any).lecturers ?? []).map((l: any) => l.lecturer_id);
    const [{ data: lecProfiles }, { data: results, error: e2 }, { data: progs }] = await Promise.all([
      lecturerIds.length ? supabase.from("profiles").select("id, full_name").in("id", lecturerIds) : Promise.resolve({ data: [] as any[] }),
      supabase.from("results")
        .select(`
          id, ca_score, exam_score, total_score, grade, grade_point, status,
          student:students!inner(matric_number, programme_id, current_level_id,
            profile:profiles!inner(full_name))
        `).eq("offering_id", data.offering_id)
        .in("status", ["registry_approved","published"] as never),
      supabase.from("programmes").select("id,name,code"),
    ]);
    if (e2) throw e2;

    const pmap = new Map((lecProfiles ?? []).map((p: any) => [p.id, p]));
    const pm = new Map((progs ?? []).map((p: any) => [p.id, p]));
    const lecturers = ((offering as any).lecturers ?? []).map((l: any) => ({
      is_lead: l.is_lead,
      full_name: pmap.get(l.lecturer_id)?.full_name ?? "—",
    }));

    return {
      offering,
      lecturers,
      results: (results ?? []).map((r: any) => ({
        matric_number: r.student.matric_number,
        full_name: r.student.profile?.full_name ?? "",
        programme: pm.get(r.student.programme_id)?.code ?? "",
        ca_score: r.ca_score,
        exam_score: r.exam_score,
        total_score: r.total_score,
        grade: r.grade,
        grade_point: r.grade_point,
        status: r.status,
      })).sort((a, b) => (a.matric_number ?? "").localeCompare(b.matric_number ?? "")),
    };
  });

// Audit timeline (result_history) rolled up by offering.
export const getOfferingAuditTrail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ offering_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: results, error: e1 } = await supabase.from("results")
      .select(`id, student:students!inner(matric_number, profile:profiles!inner(full_name))`)
      .eq("offering_id", data.offering_id);
    if (e1) throw e1;
    const resIds = (results ?? []).map((r: any) => r.id);
    if (resIds.length === 0) return [];

    const { data: hist, error: e2 } = await supabase.from("result_history")
      .select("id, result_id, changed_by, action, from_status, to_status, ca_score, exam_score, note, changed_at")
      .in("result_id", resIds)
      .order("changed_at", { ascending: false })
      .limit(500);
    if (e2) throw e2;

    const actorIds = Array.from(new Set((hist ?? []).map((h: any) => h.changed_by)));
    const { data: actors } = actorIds.length
      ? await supabase.from("profiles").select("id, full_name").in("id", actorIds)
      : { data: [] as any[] };
    const amap = new Map((actors ?? []).map((a: any) => [a.id, a]));
    const rmap = new Map((results ?? []).map((r: any) => [r.id, r]));

    return (hist ?? []).map((h: any) => {
      const r = rmap.get(h.result_id);
      return {
        id: h.id,
        matric_number: r?.student?.matric_number ?? "—",
        student_name: r?.student?.profile?.full_name ?? "—",
        actor_name: amap.get(h.changed_by)?.full_name ?? "System",
        action: h.action,
        from_status: h.from_status,
        to_status: h.to_status,
        ca_score: h.ca_score,
        exam_score: h.exam_score,
        note: h.note,
        changed_at: h.changed_at,
      };
    });
  });
