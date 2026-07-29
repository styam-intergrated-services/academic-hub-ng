import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * GPA / CGPA trend analytics.
 *
 * Computed from published results (not the sparse historical gpa_records table)
 * so that imported historical sessions are included. Per student, per semester:
 *   GPA  = Σ(credit_units × grade_point) / Σ(credit_units)   for that semester
 *   CGPA = same ratio accumulated over all semesters up to that point
 * Group aggregates are the mean of the student values in the group.
 */

const VIEWER_ROLES = ["super_admin", "ict_admin", "registry", "provost", "dean", "hod"] as const;

export type TrendPoint = { semester_id: string; label: string; session_name: string };
export type TrendValue = {
  semester_id: string;
  gpa: number | null;
  cgpa: number | null;
  students: number;
  results: number;
  pass_rate: number;
};
export type TrendSeries = {
  id: string;
  name: string;
  values: TrendValue[];
  students: number;
  avg_gpa: number | null;
  latest_cgpa: number | null;
};
export type TrendsPayload = {
  groupBy: "department" | "programme";
  points: TrendPoint[];
  series: TrendSeries[];
  options: {
    sessions: { id: string; name: string }[];
    semesters: { id: string; label: string; session_id: string }[];
    levels: { id: string; name: string }[];
    departments: { id: string; name: string }[];
    programmes: { id: string; name: string; department_id: string | null }[];
  };
  totals: { students: number; results: number; avg_gpa: number | null; avg_cgpa: number | null };
};

const Input = z.object({
  groupBy: z.enum(["department", "programme"]).default("department"),
  session_id: z.string().uuid().optional(),
  semester_id: z.string().uuid().optional(),
  level_id: z.string().uuid().optional(),
  department_id: z.string().uuid().optional(),
  programme_id: z.string().uuid().optional(),
});

type Raw = {
  student_id: string;
  cu: number;
  gp: number;
  passed: boolean;
  semester_id: string;
  semester_label: string;
  session_id: string;
  session_name: string;
  session_start: string;
  order: number;
  level_id: string;
  level_name: string;
  course_department_id: string;
  student_department_id: string | null;
  department_name: string;
  programme_id: string | null;
  programme_name: string | null;
};

export const getGpaTrends = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d ?? {}))
  .handler(async ({ data, context }): Promise<TrendsPayload> => {
    const { supabase, userId } = context;
    const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const roles = (roleRows ?? []).map((r) => r.role as string);
    if (!roles.some((r) => (VIEWER_ROLES as readonly string[]).includes(r))) {
      throw new Error("Forbidden: analytics are restricted to management roles");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Scope: HOD -> own department(s); Dean -> departments in own faculty.
    let scopeDeptIds: string[] | null = null;
    const unrestricted = roles.some((r) => ["super_admin", "ict_admin", "registry", "provost"].includes(r));
    if (!unrestricted) {
      const ids = new Set<string>();
      const { data: hodDepts } = await supabaseAdmin.from("departments").select("id").eq("hod_id", userId);
      for (const d of hodDepts ?? []) ids.add(d.id);
      const { data: facs } = await supabaseAdmin.from("faculties").select("id").eq("dean_id", userId);
      const facIds = (facs ?? []).map((f: any) => f.id);
      if (facIds.length) {
        const { data: depts } = await supabaseAdmin.from("departments").select("id").in("faculty_id", facIds);
        for (const d of depts ?? []) ids.add(d.id);
      }
      scopeDeptIds = Array.from(ids);
      if (scopeDeptIds.length === 0) {
        return emptyPayload(data.groupBy);
      }
    }

    const select = `
      grade_point, student_id,
      offering:course_offerings!inner(
        semester:semesters!inner(id, type, label, contact_number, session:academic_sessions!inner(id, name, start_date)),
        course:courses!inner(id, credit_units, department_id, level:levels!inner(id, name, order_index), department:departments!inner(id, name))
      ),
      student:students!inner(id, department_id, programme:programmes(id, name, department_id))
    `;

    const raw: Raw[] = [];
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      let q = supabaseAdmin
        .from("results")
        .select(select)
        .eq("status", "published")
        .eq("status_code", "OK")
        .order("id")
        .range(from, from + PAGE - 1);
      if (scopeDeptIds) q = q.in("offering.course.department_id", scopeDeptIds);
      const { data: batch, error } = await q;
      if (error) throw error;
      const list = (batch ?? []) as any[];
      for (const r of list) {
        const course = r.offering?.course ?? {};
        const sem = r.offering?.semester ?? {};
        const session = sem.session ?? {};
        raw.push({
          student_id: r.student_id,
          cu: course.credit_units ?? 0,
          gp: Number(r.grade_point ?? 0),
          passed: Number(r.grade_point ?? 0) > 0,
          semester_id: sem.id,
          semester_label:
            sem.label ??
            (sem.contact_number ? `Contact ${sem.contact_number}` : sem.type === "second" ? "Second semester" : "First semester"),
          session_id: session.id,
          session_name: session.name ?? "—",
          session_start: session.start_date ?? "",
          order: sem.contact_number ?? (sem.type === "second" ? 2 : 1),
          level_id: course.level?.id ?? "",
          level_name: course.level?.name ?? "—",
          course_department_id: course.department_id ?? "",
          student_department_id: r.student?.department_id ?? null,
          department_name: course.department?.name ?? "Unassigned",
          programme_id: r.student?.programme?.id ?? null,
          programme_name: r.student?.programme?.name ?? "Unassigned programme",
        });
      }
      if (list.length < PAGE) break;
    }

    // Filter option lists come from the full (scoped) dataset, before filters apply.
    const options = {
      sessions: uniq(raw.map((r) => [r.session_id, r.session_name] as const)).map(([id, name]) => ({ id, name })),
      semesters: dedupe(
        raw.map((r) => ({ id: r.semester_id, label: `${r.session_name} · ${r.semester_label}`, session_id: r.session_id })),
        (s) => s.id,
      ).sort((a, b) => a.label.localeCompare(b.label)),
      levels: uniq(raw.map((r) => [r.level_id, r.level_name] as const)).map(([id, name]) => ({ id, name })),
      departments: uniq(raw.map((r) => [r.course_department_id, r.department_name] as const)).map(([id, name]) => ({ id, name })),
      programmes: dedupe(
        raw
          .filter((r) => r.programme_id)
          .map((r) => ({ id: r.programme_id as string, name: r.programme_name ?? "—", department_id: r.student_department_id })),
        (p) => p.id,
      ).sort((a, b) => a.name.localeCompare(b.name)),
    };

    const filtered = raw.filter((r) => {
      if (data.session_id && r.session_id !== data.session_id) return false;
      if (data.semester_id && r.semester_id !== data.semester_id) return false;
      if (data.level_id && r.level_id !== data.level_id) return false;
      if (data.department_id && r.course_department_id !== data.department_id) return false;
      if (data.programme_id && r.programme_id !== data.programme_id) return false;
      return true;
    });

    // Timeline points, chronological.
    const pointMap = new Map<string, TrendPoint & { sortKey: string }>();
    for (const r of filtered) {
      if (!pointMap.has(r.semester_id)) {
        pointMap.set(r.semester_id, {
          semester_id: r.semester_id,
          label: `${shortSession(r.session_name)} · ${r.semester_label}`,
          session_name: r.session_name,
          sortKey: `${r.session_start}|${String(r.order).padStart(2, "0")}`,
        });
      }
    }
    const points = Array.from(pointMap.values())
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .map(({ sortKey, ...p }) => p);
    const pointIndex = new Map(points.map((p, i) => [p.semester_id, i]));

    // Per student per semester tallies.
    type Cell = { units: number; points: number; results: number; passes: number; group: string; groupName: string };
    const byStudent = new Map<string, Map<string, Cell>>();
    for (const r of filtered) {
      const group = data.groupBy === "programme" ? r.programme_id ?? "none" : r.course_department_id || "none";
      const groupName = data.groupBy === "programme" ? r.programme_name ?? "Unassigned programme" : r.department_name;
      let sems = byStudent.get(r.student_id);
      if (!sems) { sems = new Map(); byStudent.set(r.student_id, sems); }
      let cell = sems.get(r.semester_id);
      if (!cell) { cell = { units: 0, points: 0, results: 0, passes: 0, group, groupName }; sems.set(r.semester_id, cell); }
      cell.units += r.cu;
      cell.points += r.cu * r.gp;
      cell.results += 1;
      if (r.passed) cell.passes += 1;
    }

    // Aggregate into group series with running CGPA per student.
    type Acc = { gpaSum: number; gpaN: number; cgpaSum: number; cgpaN: number; students: Set<string>; results: number; passes: number };
    const series = new Map<string, { name: string; cells: Map<string, Acc>; students: Set<string> }>();
    let allGpaSum = 0, allGpaN = 0, allCgpaSum = 0, allCgpaN = 0, allResults = 0;
    const allStudents = new Set<string>();

    for (const [studentId, sems] of byStudent) {
      const ordered = Array.from(sems.entries()).sort(
        (a, b) => (pointIndex.get(a[0]) ?? 0) - (pointIndex.get(b[0]) ?? 0),
      );
      let cumUnits = 0, cumPoints = 0;
      for (const [semesterId, cell] of ordered) {
        cumUnits += cell.units;
        cumPoints += cell.points;
        const gpa = cell.units ? cell.points / cell.units : null;
        const cgpa = cumUnits ? cumPoints / cumUnits : null;

        let s = series.get(cell.group);
        if (!s) { s = { name: cell.groupName, cells: new Map(), students: new Set() }; series.set(cell.group, s); }
        s.students.add(studentId);
        let acc = s.cells.get(semesterId);
        if (!acc) { acc = { gpaSum: 0, gpaN: 0, cgpaSum: 0, cgpaN: 0, students: new Set(), results: 0, passes: 0 }; s.cells.set(semesterId, acc); }
        if (gpa != null) { acc.gpaSum += gpa; acc.gpaN++; allGpaSum += gpa; allGpaN++; }
        if (cgpa != null) { acc.cgpaSum += cgpa; acc.cgpaN++; }
        acc.students.add(studentId);
        acc.results += cell.results;
        acc.passes += cell.passes;
        allResults += cell.results;
        allStudents.add(studentId);
        if (ordered[ordered.length - 1][0] === semesterId && cgpa != null) { allCgpaSum += cgpa; allCgpaN++; }
      }
    }

    const outSeries: TrendSeries[] = Array.from(series.entries()).map(([id, s]) => {
      const values: TrendValue[] = points.map((p) => {
        const acc = s.cells.get(p.semester_id);
        if (!acc) return { semester_id: p.semester_id, gpa: null, cgpa: null, students: 0, results: 0, pass_rate: 0 };
        return {
          semester_id: p.semester_id,
          gpa: acc.gpaN ? round2(acc.gpaSum / acc.gpaN) : null,
          cgpa: acc.cgpaN ? round2(acc.cgpaSum / acc.cgpaN) : null,
          students: acc.students.size,
          results: acc.results,
          pass_rate: acc.results ? round2((acc.passes / acc.results) * 100) : 0,
        };
      });
      const gpas = values.map((v) => v.gpa).filter((v): v is number => v != null);
      const cgpas = values.filter((v) => v.cgpa != null);
      return {
        id,
        name: s.name,
        values,
        students: s.students.size,
        avg_gpa: gpas.length ? round2(gpas.reduce((a, b) => a + b, 0) / gpas.length) : null,
        latest_cgpa: cgpas.length ? cgpas[cgpas.length - 1].cgpa : null,
      };
    }).sort((a, b) => b.students - a.students || a.name.localeCompare(b.name));

    return {
      groupBy: data.groupBy,
      points,
      series: outSeries,
      options,
      totals: {
        students: allStudents.size,
        results: allResults,
        avg_gpa: allGpaN ? round2(allGpaSum / allGpaN) : null,
        avg_cgpa: allCgpaN ? round2(allCgpaSum / allCgpaN) : null,
      },
    };
  });

function emptyPayload(groupBy: "department" | "programme"): TrendsPayload {
  return {
    groupBy,
    points: [],
    series: [],
    options: { sessions: [], semesters: [], levels: [], departments: [], programmes: [] },
    totals: { students: 0, results: 0, avg_gpa: null, avg_cgpa: null },
  };
}

function round2(n: number) { return Math.round(n * 100) / 100; }

function shortSession(name: string) {
  const m = name.match(/(\d{4}\/\d{4})/);
  return m ? m[1] : name;
}

function uniq(pairs: (readonly [string, string])[]) {
  const m = new Map<string, string>();
  for (const [id, name] of pairs) if (id) m.set(id, name);
  return Array.from(m.entries()).sort((a, b) => a[1].localeCompare(b[1]));
}

function dedupe<T>(list: T[], key: (t: T) => string) {
  const m = new Map<string, T>();
  for (const item of list) m.set(key(item), item);
  return Array.from(m.values());
}
