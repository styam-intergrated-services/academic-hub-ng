import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Semester result cycle (Registry / ICT / Super admin).
 *
 * Closes the loop for a new semester:
 *   1. open offerings for the semester's courses
 *   2. enrol the cohort into each offering (course_registrations = approved)
 *   3. lecturers enter scores  -> Draft
 *   4. Submitted -> HOD -> Dean -> Registry -> Published
 *   5. publishing fires the database triggers that recompute GPA/CGPA,
 *      write standing history and notify the student.
 *
 * This module only owns steps 1, 2 and the cycle monitor; the approval
 * transitions stay in results.functions.ts.
 */

const MANAGERS = ["registry", "super_admin", "ict_admin"] as const;

async function requireManager(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r: any) => r.role as string);
  if (!roles.some((r) => (MANAGERS as readonly string[]).includes(r))) {
    throw new Error("Forbidden: Registry or administrator role required");
  }
  return roles;
}

export type CycleOffering = {
  offering_id: string;
  course_id: string;
  code: string;
  title: string;
  credit_units: number;
  department_id: string;
  department_name: string;
  level_id: string;
  level_name: string;
  lecturers: { id: string; name: string; is_lead: boolean }[];
  enrolled: number;
  statusCounts: Record<string, number>;
  stage: string;
};

export const getCycleOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ semester_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireManager(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: offerings, error } = await supabaseAdmin
      .from("course_offerings")
      .select(`
        id, course_id,
        course:courses!inner(
          id, code, title, credit_units, department_id,
          level:levels(id, name, order_index),
          department:departments(id, name)
        )
      `)
      .eq("semester_id", data.semester_id);
    if (error) throw error;

    const offeringIds = (offerings ?? []).map((o: any) => o.id);
    if (offeringIds.length === 0) return { offerings: [] as CycleOffering[] };

    const [{ data: regs }, { data: results }, { data: allocs }] = await Promise.all([
      supabaseAdmin.from("course_registrations").select("offering_id, status").in("offering_id", offeringIds),
      supabaseAdmin.from("results").select("offering_id, status").in("offering_id", offeringIds),
      supabaseAdmin.from("course_lecturers").select("offering_id, lecturer_id, is_lead").in("offering_id", offeringIds),
    ]);

    const lecturerIds = Array.from(new Set((allocs ?? []).map((a: any) => a.lecturer_id)));
    const nameById = new Map<string, string>();
    if (lecturerIds.length) {
      const { data: profs } = await supabaseAdmin.from("profiles").select("id, full_name, email").in("id", lecturerIds);
      for (const p of profs ?? []) nameById.set(p.id, p.full_name || p.email);
    }

    const enrolled = new Map<string, number>();
    for (const r of regs ?? []) {
      if (r.status !== "approved") continue;
      enrolled.set(r.offering_id, (enrolled.get(r.offering_id) ?? 0) + 1);
    }
    const statusByOffering = new Map<string, Record<string, number>>();
    for (const r of results ?? []) {
      const m = statusByOffering.get(r.offering_id) ?? {};
      m[r.status] = (m[r.status] ?? 0) + 1;
      statusByOffering.set(r.offering_id, m);
    }

    const rows: CycleOffering[] = (offerings ?? []).map((o: any) => {
      const counts = statusByOffering.get(o.id) ?? {};
      return {
        offering_id: o.id,
        course_id: o.course_id,
        code: o.course?.code ?? "—",
        title: o.course?.title ?? "—",
        credit_units: o.course?.credit_units ?? 0,
        department_id: o.course?.department_id ?? "",
        department_name: o.course?.department?.name ?? "—",
        level_id: o.course?.level?.id ?? "",
        level_name: o.course?.level?.name ?? "—",
        lecturers: (allocs ?? [])
          .filter((a: any) => a.offering_id === o.id)
          .map((a: any) => ({ id: a.lecturer_id, name: nameById.get(a.lecturer_id) ?? "Staff", is_lead: a.is_lead })),
        enrolled: enrolled.get(o.id) ?? 0,
        statusCounts: counts,
        stage: deriveStage(counts, enrolled.get(o.id) ?? 0),
      };
    });

    rows.sort((a, b) => a.department_name.localeCompare(b.department_name) || a.code.localeCompare(b.code));
    return { offerings: rows };
  });

function deriveStage(counts: Record<string, number>, enrolled: number): string {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (enrolled === 0) return "no_enrolment";
  if (total === 0) return "awaiting_scores";
  const order = ["draft", "submitted", "hod_approved", "dean_approved", "registry_approved", "published"];
  if ((counts["published"] ?? 0) === total) return "published";
  const rejected = ["hod_rejected", "dean_rejected", "registry_rejected"].some((s) => counts[s]);
  if (rejected) return "returned";
  // lowest stage present drives the label
  for (const s of order) if (counts[s]) return s;
  return "in_progress";
}

/** Open offerings for a set of courses in a semester (idempotent). */
export const createOfferings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    semester_id: z.string().uuid(),
    course_ids: z.array(z.string().uuid()).min(1).max(300),
    max_students: z.number().int().min(1).max(2000).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await requireManager(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin
      .from("course_offerings").select("course_id")
      .eq("semester_id", data.semester_id).in("course_id", data.course_ids);
    const have = new Set((existing ?? []).map((o: any) => o.course_id));
    const payload = data.course_ids.filter((id) => !have.has(id)).map((course_id) => ({
      course_id, semester_id: data.semester_id, max_students: data.max_students ?? 300,
    }));
    if (payload.length === 0) return { created: 0, skipped: data.course_ids.length };

    const { error } = await supabaseAdmin.from("course_offerings").insert(payload);
    if (error) throw error;

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId, action: "cycle.offerings_created", entity: "course_offerings",
      metadata: { semester_id: data.semester_id, count: payload.length },
    });
    return { created: payload.length, skipped: data.course_ids.length - payload.length };
  });

/** Enrol a cohort into an offering as approved registrations. */
export const enrolCohort = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    offering_id: z.string().uuid(),
    programme_id: z.string().uuid().optional(),
    department_id: z.string().uuid().optional(),
    level_id: z.string().uuid().optional(),
  }).refine((v) => v.programme_id || v.department_id || v.level_id, {
    message: "Choose at least one cohort filter",
  }).parse(d))
  .handler(async ({ data, context }) => {
    await requireManager(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let q = supabaseAdmin.from("students").select("id").eq("is_active", true);
    if (data.programme_id) q = q.eq("programme_id", data.programme_id);
    if (data.department_id) q = q.eq("department_id", data.department_id);
    if (data.level_id) q = q.eq("current_level_id", data.level_id);
    const { data: students, error } = await q;
    if (error) throw error;
    const ids = (students ?? []).map((s: any) => s.id);
    if (ids.length === 0) return { enrolled: 0, skipped: 0, matched: 0 };

    const { data: existing } = await supabaseAdmin
      .from("course_registrations").select("student_id").eq("offering_id", data.offering_id);
    const have = new Set((existing ?? []).map((r: any) => r.student_id));
    const payload = ids.filter((id) => !have.has(id)).map((student_id) => ({
      student_id, offering_id: data.offering_id, status: "approved" as const,
    }));
    if (payload.length === 0) return { enrolled: 0, skipped: ids.length, matched: ids.length };

    const { error: insErr } = await supabaseAdmin.from("course_registrations").insert(payload);
    if (insErr) throw insErr;

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId, action: "cycle.cohort_enrolled", entity: "course_registrations",
      entity_id: data.offering_id, metadata: { enrolled: payload.length, filters: data },
    });
    return { enrolled: payload.length, skipped: ids.length - payload.length, matched: ids.length };
  });

/** Remove an offering that has no results yet (clean-up while setting a cycle up). */
export const removeOffering = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ offering_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireManager(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { count } = await supabaseAdmin
      .from("results").select("id", { count: "exact", head: true }).eq("offering_id", data.offering_id);
    if ((count ?? 0) > 0) throw new Error("This offering already has result records and cannot be removed");

    await supabaseAdmin.from("course_registrations").delete().eq("offering_id", data.offering_id);
    await supabaseAdmin.from("course_lecturers").delete().eq("offering_id", data.offering_id);
    const { error } = await supabaseAdmin.from("course_offerings").delete().eq("id", data.offering_id);
    if (error) throw error;
    return { ok: true };
  });
