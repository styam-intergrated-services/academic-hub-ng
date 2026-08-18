import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Generic bulk score-sheet importer.
 *
 * Registry / Super Admin / ICT Admin paste or upload a CSV of scores for ANY
 * department. The heavy lifting happens inside the `admin_bulk_import_results`
 * database routine so the whole import runs in one transaction and can bypass
 * the live registration window guard safely.
 */

const ALLOWED = ["super_admin", "ict_admin", "registry"] as const;

export type ImportRow = {
  matric_number: string;
  course_code: string;
  course_title?: string | null;
  credit_units?: number | null;
  category?: string | null;
  contact_no?: number | null;
  score?: number | null;
  ca?: number | null;
  exam?: number | null;
  status_code?: string | null;
};

export type ImportReport = {
  dry_run: boolean;
  session_name: string;
  rows_read: number;
  semesters_created: number;
  courses_created: number;
  offerings_created: number;
  registrations_created: number;
  results_created: number;
  results_updated: number;
  errors: { row: number; matric_number?: string; reason: string }[];
};

async function assertAllowed(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r: any) => r.role as string);
  if (!roles.some((r: string) => (ALLOWED as readonly string[]).includes(r))) {
    throw new Error("Forbidden: only Registry, ICT Admin or Super Admin can import results");
  }
}

export const runBulkResultImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    session_name: string;
    publish?: boolean;
    dry_run: boolean;
    rows: ImportRow[];
  }) => {
    const name = (input.session_name ?? "").trim();
    if (!name) throw new Error("Academic session name is required");
    if (!Array.isArray(input.rows) || input.rows.length === 0) {
      throw new Error("No rows to import");
    }
    if (input.rows.length > 5000) {
      throw new Error("Please split the sheet — a maximum of 5,000 rows can be imported at once");
    }
    return { ...input, session_name: name };
  })
  .handler(async ({ data, context }): Promise<ImportReport> => {
    await assertAllowed(context.supabase, context.userId);

    // Drop null/blank keys: the importer distinguishes "ca/exam supplied"
    // from "single score supplied" by key presence.
    const rows = data.rows.map((r) => {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(r)) {
        if (v === null || v === undefined || v === "") continue;
        out[k] = v;
      }
      return out;
    });

    const { data: report, error } = await context.supabase.rpc("admin_bulk_import_results", {
      _payload: {
        session_name: data.session_name,
        publish: data.publish ?? true,
        rows,
      } as any,
      _dry_run: data.dry_run,
    });
    if (error) throw new Error(error.message);
    return report as unknown as ImportReport;
  });

/** Sessions + a matric-number sample, to help the operator fill the form. */
export const getImportContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAllowed(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: sessions }, { data: depts }] = await Promise.all([
      supabaseAdmin.from("academic_sessions").select("id, name").order("name"),
      supabaseAdmin.from("departments").select("id, name").order("name"),
    ]);

    const { count } = await supabaseAdmin
      .from("students")
      .select("id", { count: "exact", head: true });

    return {
      sessions: (sessions ?? []).map((s: any) => s.name as string),
      departments: (depts ?? []).map((d: any) => ({ id: d.id, name: d.name })),
      studentCount: count ?? 0,
    };
  });

/* ------------------------------------------------------------------ *
 * Import validation report
 * ------------------------------------------------------------------ */

export type ValidationReport = {
  total_rows: number;
  matched_rows: number;
  unmatched_rows: number;
  unknown_matrics: string[];
  duplicate_rows: { matric_number: string; course_code: string; contact_no: number; count: number }[];
  missing_fields: { field: string; rows: number }[];
  by_department: { name: string; students: number; rows: number }[];
  by_programme: { name: string; students: number; rows: number }[];
  by_level: { name: string; students: number; rows: number }[];
  courses: { code: string; rows: number; known: boolean }[];
  students_matched: number;
};

export const validateImportRows = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { rows: ImportRow[] }) => {
    if (!Array.isArray(input.rows) || input.rows.length === 0) throw new Error("No rows to validate");
    return input;
  })
  .handler(async ({ data, context }): Promise<ValidationReport> => {
    await assertAllowed(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const rows = data.rows;
    const matrics = Array.from(new Set(rows.map((r) => (r.matric_number ?? "").trim().toUpperCase()).filter(Boolean)));
    const codes = Array.from(new Set(rows.map((r) => (r.course_code ?? "").trim().toUpperCase()).filter(Boolean)));

    // Look up students in chunks (URL length safety).
    type Stu = { matric_number: string; department: string; programme: string; level: string };
    const students = new Map<string, Stu>();
    for (let i = 0; i < matrics.length; i += 200) {
      const slice = matrics.slice(i, i + 200);
      const { data: found, error } = await supabaseAdmin
        .from("students")
        .select("matric_number, departments(name), programmes(name), levels:current_level_id(name)")
        .in("matric_number", slice);
      if (error) throw new Error(error.message);
      for (const s of (found ?? []) as any[]) {
        students.set(String(s.matric_number).toUpperCase(), {
          matric_number: s.matric_number,
          department: s.departments?.name ?? "Unassigned department",
          programme: s.programmes?.name ?? "Unassigned programme",
          level: s.levels?.name ?? "Unassigned level",
        });
      }
    }

    const knownCourses = new Set<string>();
    for (let i = 0; i < codes.length; i += 200) {
      const { data: found } = await supabaseAdmin
        .from("courses")
        .select("code")
        .in("code", codes.slice(i, i + 200));
      for (const c of (found ?? []) as any[]) knownCourses.add(String(c.code).toUpperCase());
    }

    const missing = { course_title: 0, credit_units: 0, category: 0, contact_no: 0, scores: 0, status_code: 0 };
    const dupCounts = new Map<string, number>();
    const dept = new Map<string, { rows: number; students: Set<string> }>();
    const prog = new Map<string, { rows: number; students: Set<string> }>();
    const level = new Map<string, { rows: number; students: Set<string> }>();
    const courseRows = new Map<string, number>();
    const unknown = new Set<string>();
    let matched = 0;

    const bump = (
      m: Map<string, { rows: number; students: Set<string> }>,
      key: string,
      matric: string,
    ) => {
      const e = m.get(key) ?? { rows: 0, students: new Set<string>() };
      e.rows += 1;
      e.students.add(matric);
      m.set(key, e);
    };

    for (const r of rows) {
      const matric = (r.matric_number ?? "").trim().toUpperCase();
      const code = (r.course_code ?? "").trim().toUpperCase();
      const contact = Number(r.contact_no ?? 1) || 1;

      if (!r.course_title) missing.course_title++;
      if (r.credit_units === null || r.credit_units === undefined) missing.credit_units++;
      if (!r.category) missing.category++;
      if (r.contact_no === null || r.contact_no === undefined) missing.contact_no++;
      if (
        (r.score === null || r.score === undefined) &&
        (r.ca === null || r.ca === undefined) &&
        (r.exam === null || r.exam === undefined)
      ) missing.scores++;
      if (!r.status_code) missing.status_code++;

      const key = `${matric}|${code}|${contact}`;
      dupCounts.set(key, (dupCounts.get(key) ?? 0) + 1);
      courseRows.set(code, (courseRows.get(code) ?? 0) + 1);

      const s = students.get(matric);
      if (s) {
        matched++;
        bump(dept, s.department, matric);
        bump(prog, s.programme, matric);
        bump(level, s.level, matric);
      } else if (matric) {
        unknown.add(matric);
      }
    }

    const duplicates = Array.from(dupCounts.entries())
      .filter(([, n]) => n > 1)
      .slice(0, 200)
      .map(([k, n]) => {
        const [matric_number, course_code, contact_no] = k.split("|");
        return { matric_number, course_code, contact_no: Number(contact_no), count: n };
      })
      .sort((a, b) => b.count - a.count);

    const flat = (m: Map<string, { rows: number; students: Set<string> }>) =>
      Array.from(m.entries())
        .map(([name, v]) => ({ name, rows: v.rows, students: v.students.size }))
        .sort((a, b) => b.rows - a.rows);

    return {
      total_rows: rows.length,
      matched_rows: matched,
      unmatched_rows: rows.length - matched,
      unknown_matrics: Array.from(unknown).slice(0, 300),
      duplicate_rows: duplicates,
      missing_fields: Object.entries(missing)
        .filter(([, n]) => n > 0)
        .map(([field, rows]) => ({ field, rows })),
      by_department: flat(dept),
      by_programme: flat(prog),
      by_level: flat(level),
      courses: Array.from(courseRows.entries())
        .map(([code, rows]) => ({ code, rows, known: knownCourses.has(code) }))
        .sort((a, b) => b.rows - a.rows),
      students_matched: students.size,
    };
  });

/* ------------------------------------------------------------------ *
 * Chunked GPA / CGPA recalculation
 * ------------------------------------------------------------------ */

/** Resolve the student ids touched by a set of matric numbers. */
export const resolveStudentsForRecompute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { matric_numbers: string[] }) => input)
  .handler(async ({ data, context }): Promise<{ ids: string[] }> => {
    await assertAllowed(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const matrics = Array.from(
      new Set((data.matric_numbers ?? []).map((m) => (m ?? "").trim().toUpperCase()).filter(Boolean)),
    );
    const ids: string[] = [];
    for (let i = 0; i < matrics.length; i += 200) {
      const { data: found, error } = await supabaseAdmin
        .from("students")
        .select("id, matric_number")
        .in("matric_number", matrics.slice(i, i + 200));
      if (error) throw new Error(error.message);
      for (const s of (found ?? []) as any[]) ids.push(s.id as string);
    }
    return { ids };
  });

/** Recompute semester GPA (all semesters with published results) + CGPA for a batch of students. */
export const recomputeGpaBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { student_ids: string[] }) => {
    if (!Array.isArray(input.student_ids) || input.student_ids.length === 0) {
      throw new Error("No students to recompute");
    }
    if (input.student_ids.length > 40) throw new Error("Recompute batches are limited to 40 students");
    return input;
  })
  .handler(async ({ data, context }): Promise<{ students: number; semesters: number }> => {
    await assertAllowed(context.supabase, context.userId);
    const { supabase } = context;
    let semesters = 0;

    for (const id of data.student_ids) {
      const { data: rs } = await supabase
        .from("results")
        .select("course_offerings(semester_id)")
        .eq("student_id", id);
      const semIds = Array.from(
        new Set(((rs ?? []) as any[]).map((r) => r.course_offerings?.semester_id).filter(Boolean)),
      ) as string[];
      for (const sem of semIds) {
        await supabase.rpc("recompute_semester_gpa", { _student_id: id, _semester_id: sem });
        semesters++;
      }
      await supabase.rpc("recompute_student_cgpa", { _student_id: id });
    }

    return { students: data.student_ids.length, semesters };
  });
