import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// ---------- Broadsheet (per offering) ----------
export const getBroadsheet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ offering_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Authorization: lecturers of offering, HOD of dept, Dean of faculty, Registry/ICT/Super
    const { data: rolesRows } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const roles = (rolesRows ?? []).map((r: any) => r.role as string);
    const isPrivileged = roles.some((r) => ["registry", "super_admin", "ict_admin", "dean", "hod"].includes(r));
    const { data: teaches } = await supabase.from("course_lecturers")
      .select("lecturer_id").eq("offering_id", data.offering_id).eq("lecturer_id", userId).maybeSingle();
    if (!isPrivileged && !teaches) throw new Error("Forbidden");

    const { data: offering, error: eOff } = await supabase.from("course_offerings")
      .select(`
        id,
        course:courses!inner(code, title, credit_units, department_id, level:levels(code,name)),
        semester:semesters!inner(type, session:academic_sessions(name))
      `)
      .eq("id", data.offering_id).maybeSingle();
    if (eOff) throw eOff;
    if (!offering) throw new Error("Offering not found");

    const dept = (offering as any).course?.department_id
      ? (await supabase.from("departments")
          .select("name, faculty:faculties(name)")
          .eq("id", (offering as any).course.department_id).maybeSingle()).data
      : null;

    const { data: lecturers } = await supabase.from("course_lecturers")
      .select("is_lead, lecturer:profiles!course_lecturers_lecturer_id_fkey(full_name)")
      .eq("offering_id", data.offering_id);

    const { data: rows, error: eRows } = await supabase.from("results")
      .select(`
        id, ca_score, exam_score, total_score, grade, grade_point, status,
        student:students!inner(matric_number, profile:profiles!inner(full_name))
      `)
      .eq("offering_id", data.offering_id)
      .eq("status", "published")
      .order("matric_number", { referencedTable: "students", ascending: true });
    if (eRows) throw eRows;

    const results = (rows ?? []) as any[];
    const totals = results.map((r) => Number(r.total_score ?? 0));
    const passing = results.filter((r) => (r.grade_point ?? 0) >= 1).length;
    const summary = {
      count: results.length,
      passed: passing,
      failed: results.length - passing,
      average: totals.length ? totals.reduce((a, b) => a + b, 0) / totals.length : 0,
      highest: totals.length ? Math.max(...totals) : 0,
      lowest: totals.length ? Math.min(...totals) : 0,
      grade_distribution: ["A", "B", "C", "D", "E", "F"].reduce((acc, g) => {
        acc[g] = results.filter((r) => r.grade === g).length;
        return acc;
      }, {} as Record<string, number>),
    };

    return { offering, department: dept, lecturers: lecturers ?? [], results, summary };
  });

// ---------- Transcript (per student) ----------
export const getTranscript = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ student_id: z.string().uuid().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const targetId = data.student_id ?? userId;

    if (targetId !== userId) {
      const { data: rolesRows } = await supabase.from("user_roles").select("role").eq("user_id", userId);
      const roles = (rolesRows ?? []).map((r: any) => r.role as string);
      if (!roles.some((r) => ["registry", "super_admin", "ict_admin", "dean"].includes(r))) {
        throw new Error("Forbidden");
      }
    }

    const { data: student, error: eStu } = await supabase.from("students")
      .select(`
        id, matric_number, cgpa, total_credit_units, total_grade_points, standing, entry_year, is_active,
        programme:programmes(name, department:departments(name, faculty:faculties(name))),
        department:departments(name, faculty:faculties(name)),
        current_level:levels!students_current_level_id_fkey(code, name),
        entry_session:academic_sessions!students_entry_session_id_fkey(name)
      `)
      .eq("id", targetId).maybeSingle();
    if (eStu) throw eStu;
    if (!student) throw new Error("Student not found");

    const { data: profile } = await supabase.from("profiles")
      .select("full_name, email, date_of_birth, gender, state_of_origin, phone")
      .eq("id", targetId).maybeSingle();

    const { data: publishedResults, error: eRes } = await supabase.from("results")
      .select(`
        id, ca_score, exam_score, total_score, grade, grade_point,
        offering:course_offerings!inner(
          course:courses!inner(code, title, credit_units),
          semester:semesters!inner(id, type, session:academic_sessions(name, start_date))
        )
      `)
      .eq("student_id", targetId)
      .eq("status", "published");
    if (eRes) throw eRes;

    // Group by semester
    type SemBlock = {
      semester_id: string;
      session_name: string;
      semester_type: string;
      order_key: string;
      rows: any[];
      tcu: number;
      tgp: number;
      gpa: number;
    };
    const byId = new Map<string, SemBlock>();
    for (const r of (publishedResults ?? []) as any[]) {
      const sem = r.offering.semester;
      const key = sem.id;
      if (!byId.has(key)) {
        byId.set(key, {
          semester_id: key,
          session_name: sem.session?.name ?? "",
          semester_type: sem.type,
          order_key: `${sem.session?.start_date ?? sem.session?.name ?? ""}-${sem.type}`,
          rows: [],
          tcu: 0,
          tgp: 0,
          gpa: 0,
        });
      }
      const block = byId.get(key)!;
      const units = Number(r.offering.course.credit_units) || 0;
      const gp = Number(r.grade_point) || 0;
      block.rows.push({
        code: r.offering.course.code,
        title: r.offering.course.title,
        units,
        ca: r.ca_score,
        exam: r.exam_score,
        total: r.total_score,
        grade: r.grade,
        grade_point: gp,
      });
      block.tcu += units;
      block.tgp += units * gp;
    }
    const semesters = Array.from(byId.values())
      .map((b) => ({ ...b, gpa: b.tcu > 0 ? Math.round((b.tgp / b.tcu) * 100) / 100 : 0 }))
      .sort((a, b) => (a.order_key < b.order_key ? -1 : 1));

    // Running CGPA per semester
    let cumUnits = 0;
    let cumPoints = 0;
    const semestersWithCgpa = semesters.map((s) => {
      cumUnits += s.tcu;
      cumPoints += s.tgp;
      return { ...s, running_cgpa: cumUnits > 0 ? Math.round((cumPoints / cumUnits) * 100) / 100 : 0 };
    });

    const overallCgpa = cumUnits > 0 ? Math.round((cumPoints / cumUnits) * 100) / 100 : Number(student.cgpa ?? 0);
    const classOfResult =
      overallCgpa >= 4.5 ? "Distinction" :
      overallCgpa >= 3.5 ? "Upper Credit" :
      overallCgpa >= 2.5 ? "Lower Credit" :
      overallCgpa >= 1.5 ? "Merit" :
      overallCgpa >= 1.0 ? "Pass" : "Fail";

    return {
      student,
      profile,
      semesters: semestersWithCgpa,
      totals: {
        cgpa: overallCgpa,
        credit_units: cumUnits,
        grade_points: Math.round(cumPoints * 100) / 100,
        class_of_result: classOfResult,
      },
    };
  });

// ---------- Issue official transcript ----------
export const issueOfficialTranscript = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ student_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: rolesRows } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const roles = (rolesRows ?? []).map((r: any) => r.role as string);
    if (!roles.some((r) => ["registry", "super_admin", "ict_admin"].includes(r))) {
      throw new Error("Forbidden: registry role required");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const year = new Date().getFullYear();
    const { data: serialRow, error: eSer } = await supabaseAdmin.rpc("next_transcript_serial", { _year: year });
    if (eSer) throw eSer;
    const serial = serialRow as unknown as string;
    const { error } = await supabase.from("transcripts_issued").insert({
      student_id: data.student_id,
      serial,
      issued_by: userId,
      metadata: {},
    });
    if (error) throw error;
    return { serial };
  });
