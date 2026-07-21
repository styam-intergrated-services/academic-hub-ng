import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const STAFF_ROLES = ["super_admin","ict_admin","provost","registry","bursary","dean","hod","lecturer"];

async function assertProvost(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r: any) => r.role);
  if (!roles.some((r: string) => ["super_admin","ict_admin","provost"].includes(r))) {
    throw new Error("Forbidden: requires provost, ict_admin or super_admin");
  }
}
async function assertSenate(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r: any) => r.role);
  if (!roles.some((r: string) => ["super_admin","ict_admin","provost","registry"].includes(r))) {
    throw new Error("Forbidden: senate approval required");
  }
}

// =============== EXECUTIVE OVERVIEW ===============

export const getProvostOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertProvost(supabase, userId);

    const [
      studentsRes, staffRes, deptsRes, progsRes,
      currentSessionRes, currentSemRes,
      admissionsRes, registrationsRes,
      paymentsRes, feesOutstandingRes,
      awaitingRes, publishedRes,
      announcementsRes, eventsRes, notifRes,
      graduationRes, policyRes,
    ] = await Promise.all([
      supabase.from("students").select("id", { count: "exact", head: true }),
      supabase.from("user_roles").select("user_id").in("role", STAFF_ROLES as any),
      supabase.from("departments").select("id", { count: "exact", head: true }),
      supabase.from("programmes").select("id", { count: "exact", head: true }),
      supabase.from("academic_sessions").select("id,name,status,start_date,end_date").eq("status","active").maybeSingle(),
      supabase.from("semesters").select("id,session_id,type,registration_open,is_current").eq("is_current", true).maybeSingle(),
      supabase.from("applications").select("id,status,matriculated_at"),
      supabase.from("course_registrations").select("student_id"),
      supabase.from("payments").select("amount,status"),
      supabase.from("payments").select("id,status"),
      supabase.from("results").select("id,status,requires_senate"),
      supabase.from("results").select("id", { count: "exact", head: true }).eq("status","published"),
      supabase.from("announcements").select("id,title,status,created_at,category").order("created_at",{ascending:false}).limit(5),
      supabase.from("academic_calendar_events").select("id,title,event_date,category").gte("event_date", new Date().toISOString().slice(0,10)).order("event_date").limit(6),
      supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("is_read", false),
      supabase.from("graduation_lists").select("id,status"),
      supabase.from("policy_documents").select("id,status"),
    ]);

    const uniqueStaff = new Set((staffRes.data ?? []).map((r: any) => r.user_id)).size;
    const uniqueRegistered = new Set((registrationsRes.data ?? []).map((r: any) => r.student_id)).size;
    const totalRevenue = (paymentsRes.data ?? []).filter((p: any) => p.status === "verified").reduce((s: number, p: any) => s + Number(p.amount ?? 0), 0);
    const outstandingCount = (feesOutstandingRes.data ?? []).filter((p: any) => p.status !== "verified").length;
    const admissionsThisSession = (admissionsRes.data ?? []).filter((a: any) => a.status === "matriculated" && a.matriculated_at).length;
    const resultsAwaitingSenate = (awaitingRes.data ?? []).filter((r: any) => r.status !== "published" && r.status !== "draft").length;
    const senatePendingCount =
      (announcementsRes.data ?? []).filter((a: any) => a.status === "pending_senate").length +
      (graduationRes.data ?? []).filter((g: any) => g.status === "pending_senate").length +
      (policyRes.data ?? []).filter((p: any) => p.status === "pending_senate").length;

    return {
      totals: {
        students: studentsRes.count ?? 0,
        staff: uniqueStaff,
        departments: deptsRes.count ?? 0,
        programmes: progsRes.count ?? 0,
        admissionsThisSession,
        registeredStudents: uniqueRegistered,
        outstandingFees: outstandingCount,
        revenueGenerated: totalRevenue,
        resultsAwaitingSenate,
        publishedResults: publishedRes.count ?? 0,
        senatePendingCount,
        unreadNotifications: notifRes.count ?? 0,
      },
      currentSession: currentSessionRes.data ?? null,
      currentSemester: currentSemRes.data ?? null,
      announcements: announcementsRes.data ?? [],
      upcomingEvents: eventsRes.data ?? [],
    };
  });

// =============== ACADEMIC REPORTS ===============

export const getAcademicReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertProvost(supabase, userId);

    const [depts, students, results, offerings, courses, regs] = await Promise.all([
      supabase.from("departments").select("id,name,code"),
      supabase.from("students").select("id,department_id,current_level_id,cgpa"),
      supabase.from("results").select("id,offering_id,student_id,grade,grade_point,status,status_code").eq("status","published"),
      supabase.from("course_offerings").select("id,course_id,semester_id"),
      supabase.from("courses").select("id,code,title,department_id,credit_units"),
      supabase.from("course_registrations").select("id,offering_id,student_id"),
    ]);

    const deptById = new Map((depts.data ?? []).map((d: any) => [d.id, d]));
    const courseById = new Map((courses.data ?? []).map((c: any) => [c.id, c]));
    const offeringById = new Map((offerings.data ?? []).map((o: any) => [o.id, o]));

    // Enrolment by department
    const enrolmentByDept: Record<string, number> = {};
    for (const s of students.data ?? []) {
      const d: any = deptById.get(s.department_id);
      if (!d) continue;
      enrolmentByDept[d.name] = (enrolmentByDept[d.name] ?? 0) + 1;
    }

    // GPA distribution buckets
    const buckets = [
      { name: "0.00–0.99", min: 0, max: 1, count: 0 },
      { name: "1.00–1.99", min: 1, max: 2, count: 0 },
      { name: "2.00–2.99", min: 2, max: 3, count: 0 },
      { name: "3.00–3.99", min: 3, max: 4, count: 0 },
      { name: "4.00–5.00", min: 4, max: 5.01, count: 0 },
    ];
    for (const s of students.data ?? []) {
      const cg = Number(s.cgpa ?? 0);
      const b = buckets.find((x) => cg >= x.min && cg < x.max);
      if (b) b.count += 1;
    }

    // Pass/fail per course (top 20 by volume)
    const perCourse: Record<string, { code: string; title: string; pass: number; fail: number; total: number }> = {};
    for (const r of results.data ?? []) {
      const off: any = offeringById.get(r.offering_id);
      if (!off) continue;
      const c: any = courseById.get(off.course_id);
      if (!c) continue;
      const key = c.code;
      perCourse[key] ??= { code: c.code, title: c.title, pass: 0, fail: 0, total: 0 };
      perCourse[key].total += 1;
      if (r.status_code !== "OK") continue;
      const gp = Number(r.grade_point ?? 0);
      if (gp >= 1) perCourse[key].pass += 1; else perCourse[key].fail += 1;
    }
    const passFail = Object.values(perCourse).sort((a, b) => b.total - a.total).slice(0, 20);

    // Course registration stats
    const regByOffering: Record<string, number> = {};
    for (const r of regs.data ?? []) regByOffering[r.offering_id] = (regByOffering[r.offering_id] ?? 0) + 1;
    const registrationStats = Object.entries(regByOffering).map(([offId, count]) => {
      const off: any = offeringById.get(offId);
      const c: any = off ? courseById.get(off.course_id) : null;
      return { code: c?.code ?? "?", title: c?.title ?? "?", registered: count };
    }).sort((a, b) => b.registered - a.registered).slice(0, 20);

    // Graduation stats: students at NCE3+ with CGPA >= 1.0 grouped by classification
    const classify = (cg: number) =>
      cg >= 4.5 ? "Distinction" : cg >= 3.5 ? "Credit" : cg >= 2.5 ? "Merit" : cg >= 1.0 ? "Pass" : "Fail";
    const grad: Record<string, number> = { Distinction: 0, Credit: 0, Merit: 0, Pass: 0, Fail: 0 };
    for (const s of students.data ?? []) grad[classify(Number(s.cgpa ?? 0))] += 1;

    return {
      enrolmentByDept: Object.entries(enrolmentByDept).map(([name, count]) => ({ name, count })),
      gpaDistribution: buckets,
      passFail,
      registrationStats,
      graduationStats: Object.entries(grad).map(([classification, count]) => ({ classification, count })),
    };
  });

// =============== FINANCIAL REPORTS ===============

export const getFinancialReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertProvost(supabase, userId);

    const [pays, students, progs] = await Promise.all([
      supabase.from("payments").select("id,amount,status,created_at,student_id,fee_structure_id"),
      supabase.from("students").select("id,programme_id"),
      supabase.from("programmes").select("id,name"),
    ]);

    const progById = new Map((progs.data ?? []).map((p: any) => [p.id, p]));
    const studentProg = new Map((students.data ?? []).map((s: any) => [s.id, s.programme_id]));

    const verified = (pays.data ?? []).filter((p: any) => p.status === "verified");
    const totalRevenue = verified.reduce((s: number, p: any) => s + Number(p.amount ?? 0), 0);
    const outstanding = (pays.data ?? []).filter((p: any) => p.status !== "verified");
    const totalOutstanding = outstanding.reduce((s: number, p: any) => s + Number(p.amount ?? 0), 0);

    // Monthly trend (last 12 months)
    const trend: Record<string, number> = {};
    for (const p of verified) {
      const key = String(p.created_at).slice(0, 7);
      trend[key] = (trend[key] ?? 0) + Number(p.amount ?? 0);
    }
    const trendArr = Object.entries(trend).sort(([a],[b]) => a.localeCompare(b)).slice(-12).map(([month, amount]) => ({ month, amount }));

    // Collection by programme
    const byProg: Record<string, number> = {};
    for (const p of verified) {
      const progId = studentProg.get(p.student_id);
      const prog: any = progId ? progById.get(progId) : null;
      const name = prog?.name ?? "Unassigned";
      byProg[name] = (byProg[name] ?? 0) + Number(p.amount ?? 0);
    }

    return {
      totalRevenue,
      totalOutstanding,
      collectionRate: totalRevenue + totalOutstanding > 0 ? Math.round((totalRevenue / (totalRevenue + totalOutstanding)) * 100) : 0,
      trend: trendArr,
      byProgramme: Object.entries(byProg).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount),
    };
  });

// =============== ADMIN REPORTS ===============

export const getAdminReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertProvost(supabase, userId);

    const [rolesRes, deptsRes, studentsRes, coursesRes, apps, levels] = await Promise.all([
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("departments").select("id,name"),
      supabase.from("students").select("id,department_id,current_level_id"),
      supabase.from("courses").select("id,department_id"),
      supabase.from("applications").select("id,status"),
      supabase.from("levels").select("id,code,name"),
    ]);

    // Staff by role
    const staffByRole: Record<string, number> = {};
    for (const r of rolesRes.data ?? []) {
      if (!STAFF_ROLES.includes(r.role)) continue;
      staffByRole[r.role] = (staffByRole[r.role] ?? 0) + 1;
    }

    // Department stats
    const deptById = new Map((deptsRes.data ?? []).map((d: any) => [d.id, d]));
    const deptStats: Record<string, { name: string; students: number; courses: number }> = {};
    for (const d of deptsRes.data ?? []) deptStats[d.id] = { name: d.name, students: 0, courses: 0 };
    for (const s of studentsRes.data ?? []) if (deptStats[s.department_id]) deptStats[s.department_id].students += 1;
    for (const c of coursesRes.data ?? []) if (deptStats[c.department_id]) deptStats[c.department_id].courses += 1;

    // Admission funnel
    const funnel: Record<string, number> = { submitted: 0, under_review: 0, admitted: 0, matriculated: 0, rejected: 0 };
    for (const a of apps.data ?? []) funnel[a.status] = (funnel[a.status] ?? 0) + 1;

    // Population by level
    const levelById = new Map((levels.data ?? []).map((l: any) => [l.id, l]));
    const byLevel: Record<string, number> = {};
    for (const s of studentsRes.data ?? []) {
      const l: any = levelById.get(s.current_level_id);
      const name = l?.name ?? "Unassigned";
      byLevel[name] = (byLevel[name] ?? 0) + 1;
    }

    // Gender split
    const byGender: Record<string, number> = { male: 0, female: 0, other: 0, unknown: 0 };
    for (const s of studentsRes.data ?? []) {
      const g = (s as any).gender ?? "unknown";
      byGender[g] = (byGender[g] ?? 0) + 1;
    }

    return {
      staffByRole: Object.entries(staffByRole).map(([role, count]) => ({ role, count })),
      departmentStats: Object.values(deptStats),
      admissionFunnel: Object.entries(funnel).map(([status, count]) => ({ status, count })),
      populationByLevel: Object.entries(byLevel).map(([name, count]) => ({ name, count })),
      genderSplit: Object.entries(byGender).map(([name, value]) => ({ name, value })),
    };
  });

// =============== ANNOUNCEMENTS ===============

export const listAnnouncements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("announcements")
      .select("id,title,body,category,status,is_public,author_id,approved_by,approved_at,publish_at,created_at,updated_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return data ?? [];
  });

const annSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(3).max(200),
  body: z.string().min(3).max(5000),
  category: z.string().min(2).max(40).default("general"),
  status: z.enum(["draft","pending_senate","published","archived","rejected"]).default("draft"),
  is_public: z.boolean().default(false),
  publish_at: z.string().nullable().optional(),
});

export const upsertAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => annSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.id) {
      const { error } = await supabase.from("announcements").update({
        title: data.title, body: data.body, category: data.category,
        status: data.status, is_public: data.is_public, publish_at: data.publish_at ?? null,
      }).eq("id", data.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("announcements").insert({
        title: data.title, body: data.body, category: data.category,
        status: data.status, is_public: data.is_public, publish_at: data.publish_at ?? null,
        author_id: userId,
      });
      if (error) throw error;
    }
    return { ok: true };
  });

export const decideAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid(),
    decision: z.enum(["approve","reject","archive"]),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertSenate(supabase, userId);
    const next = data.decision === "approve" ? "published" : data.decision === "reject" ? "rejected" : "archived";
    const patch: any = { status: next };
    if (data.decision === "approve") { patch.approved_by = userId; patch.approved_at = new Date().toISOString(); }
    const { error } = await supabase.from("announcements").update(patch).eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const deleteAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("announcements").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
