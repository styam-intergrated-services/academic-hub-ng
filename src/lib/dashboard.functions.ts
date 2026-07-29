import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface NotificationItem {
  id: string;
  title: string;
  body: string | null;
  category: string | null;
  is_read: boolean;
  created_at: string;
}

export const getMyNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ items: NotificationItem[]; unread: number }> => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("notifications")
      .select("id,title,body,category,is_read,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);
    const items = (data ?? []) as NotificationItem[];
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_read", false);
    return { items, unread: count ?? 0 };
  });

export const markNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("is_read", false);
    if (error) throw error;
    return { ok: true };
  });

export interface StudentExtras {
  recentResults: {
    id: string;
    code: string;
    title: string;
    total_score: number | null;
    grade: string | null;
    credit_units: number;
    published_at: string | null;
  }[];
  semesterGpa: { label: string; gpa: number; cgpa: number }[];
  upcomingExams: {
    id: string;
    code: string;
    title: string;
    exam_date: string;
    start_time: string;
    venue: string;
  }[];
  outstandingFees: number;
}

export const getStudentExtras = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<StudentExtras> => {
    const { supabase, userId } = context;
    const empty: StudentExtras = { recentResults: [], semesterGpa: [], upcomingExams: [], outstandingFees: 0 };

    const { data: student } = await supabase
      .from("students")
      .select("id")
      .eq("auth_user_id", userId)
      .maybeSingle();
    if (!student?.id) return empty;
    const sid = student.id;

    const { data: results } = await supabase
      .from("results")
      .select("id,total_score,grade,published_at,offering_id")
      .eq("student_id", sid)
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(6);

    const offeringIds = Array.from(new Set((results ?? []).map((r) => r.offering_id)));
    const courseByOffering = new Map<string, { code: string; title: string; credit_units: number }>();
    if (offeringIds.length > 0) {
      const { data: offerings } = await supabase
        .from("course_offerings")
        .select("id,course_id")
        .in("id", offeringIds);
      const courseIds = Array.from(new Set((offerings ?? []).map((o) => o.course_id)));
      const { data: courses } = await supabase
        .from("courses")
        .select("id,code,title,credit_units")
        .in("id", courseIds.length ? courseIds : ["00000000-0000-0000-0000-000000000000"]);
      const cmap = new Map((courses ?? []).map((c) => [c.id, c]));
      for (const o of offerings ?? []) {
        const c = cmap.get(o.course_id);
        if (c) courseByOffering.set(o.id, { code: c.code, title: c.title, credit_units: c.credit_units });
      }
    }

    const recentResults = (results ?? []).map((r) => {
      const c = courseByOffering.get(r.offering_id);
      return {
        id: r.id,
        code: c?.code ?? "—",
        title: c?.title ?? "Course",
        total_score: r.total_score,
        grade: r.grade,
        credit_units: c?.credit_units ?? 0,
        published_at: r.published_at,
      };
    });

    const { data: gpaRows } = await supabase
      .from("gpa_records")
      .select("gpa,cgpa,semester_id,computed_at")
      .eq("student_id", sid)
      .order("computed_at", { ascending: true })
      .limit(12);
    const semIds = Array.from(new Set((gpaRows ?? []).map((g) => g.semester_id)));
    const semLabel = new Map<string, string>();
    if (semIds.length > 0) {
      const { data: sems } = await supabase
        .from("semesters")
        .select("id,label,contact_number,type")
        .in("id", semIds);
      for (const s of sems ?? []) {
        semLabel.set(s.id, s.label ?? (s.contact_number ? `Contact ${s.contact_number}` : s.type));
      }
    }
    const semesterGpa = (gpaRows ?? []).map((g) => ({
      label: semLabel.get(g.semester_id) ?? "Semester",
      gpa: Number(g.gpa),
      cgpa: Number(g.cgpa),
    }));

    // Upcoming exams for offerings the student is registered in.
    const { data: regs } = await supabase
      .from("course_registrations")
      .select("offering_id")
      .eq("student_id", sid)
      .eq("status", "approved")
      .limit(60);
    const regOfferings = (regs ?? []).map((r) => r.offering_id);
    let upcomingExams: StudentExtras["upcomingExams"] = [];
    if (regOfferings.length > 0) {
      const today = new Date().toISOString().slice(0, 10);
      const { data: exams } = await supabase
        .from("exam_schedules")
        .select("id,offering_id,exam_date,start_time,venue")
        .in("offering_id", regOfferings)
        .gte("exam_date", today)
        .order("exam_date", { ascending: true })
        .limit(5);
      const examOfferings = Array.from(new Set((exams ?? []).map((e) => e.offering_id)));
      const map = new Map<string, { code: string; title: string }>();
      if (examOfferings.length > 0) {
        const { data: offs } = await supabase
          .from("course_offerings")
          .select("id,course_id")
          .in("id", examOfferings);
        const { data: crs } = await supabase
          .from("courses")
          .select("id,code,title")
          .in("id", Array.from(new Set((offs ?? []).map((o) => o.course_id))));
        const cm = new Map((crs ?? []).map((c) => [c.id, c]));
        for (const o of offs ?? []) {
          const c = cm.get(o.course_id);
          if (c) map.set(o.id, { code: c.code, title: c.title });
        }
      }
      upcomingExams = (exams ?? []).map((e) => ({
        id: e.id,
        code: map.get(e.offering_id)?.code ?? "—",
        title: map.get(e.offering_id)?.title ?? "Course",
        exam_date: e.exam_date,
        start_time: e.start_time,
        venue: e.venue,
      }));
    }

    return { recentResults, semesterGpa, upcomingExams, outstandingFees: 0 };
  });

export interface LecturerClass {
  offering_id: string;
  code: string;
  title: string;
  credit_units: number;
  students: number;
  entered: number;
  submitted: number;
  published: number;
}

export const getLecturerClasses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ classes: LecturerClass[]; semesterLabel: string | null }> => {
    const { supabase, userId } = context;
    const { data: sem } = await supabase
      .from("semesters")
      .select("id,label,type,session_id")
      .eq("is_current", true)
      .maybeSingle();
    if (!sem?.id) return { classes: [], semesterLabel: null };

    const { data: offerings } = await supabase
      .from("course_offerings")
      .select("id,course_id")
      .eq("semester_id", sem.id);
    const offeringIds = (offerings ?? []).map((o) => o.id);
    if (offeringIds.length === 0) return { classes: [], semesterLabel: sem.label ?? sem.type };

    const { data: mine } = await supabase
      .from("course_lecturers")
      .select("offering_id")
      .eq("lecturer_id", userId)
      .in("offering_id", offeringIds);
    const myOfferings = (mine ?? []).map((m) => m.offering_id);
    if (myOfferings.length === 0) return { classes: [], semesterLabel: sem.label ?? sem.type };

    const courseIds = (offerings ?? []).filter((o) => myOfferings.includes(o.id)).map((o) => o.course_id);
    const { data: courses } = await supabase
      .from("courses")
      .select("id,code,title,credit_units")
      .in("id", courseIds);
    const cmap = new Map((courses ?? []).map((c) => [c.id, c]));

    const { data: regs } = await supabase
      .from("course_registrations")
      .select("offering_id")
      .in("offering_id", myOfferings)
      .eq("status", "approved");
    const { data: results } = await supabase
      .from("results")
      .select("offering_id,status")
      .in("offering_id", myOfferings);

    const classes: LecturerClass[] = myOfferings.map((oid) => {
      const courseId = (offerings ?? []).find((o) => o.id === oid)?.course_id;
      const c = courseId ? cmap.get(courseId) : undefined;
      const rs = (results ?? []).filter((r) => r.offering_id === oid);
      return {
        offering_id: oid,
        code: c?.code ?? "—",
        title: c?.title ?? "Course",
        credit_units: c?.credit_units ?? 0,
        students: (regs ?? []).filter((r) => r.offering_id === oid).length,
        entered: rs.length,
        submitted: rs.filter((r) => r.status !== "draft").length,
        published: rs.filter((r) => r.status === "published").length,
      };
    });

    return { classes, semesterLabel: sem.label ?? sem.type };
  });

export interface ExamOfficerOverview {
  scopes: { type: string; name: string }[];
  offeringsCovered: number;
  pendingResults: number;
  publishedResults: number;
  upcomingExams: { id: string; exam_date: string; start_time: string; venue: string; code: string }[];
}

export const getExamOfficerOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ExamOfficerOverview> => {
    const { supabase, userId } = context;
    const empty: ExamOfficerOverview = {
      scopes: [], offeringsCovered: 0, pendingResults: 0, publishedResults: 0, upcomingExams: [],
    };

    const { data: eo } = await supabase
      .from("examination_officers")
      .select("scope_type,scope_id")
      .eq("user_id", userId);
    if (!eo || eo.length === 0) return empty;

    const deptIds = new Set<string>();
    const scopes: { type: string; name: string }[] = [];

    for (const s of eo) {
      if (s.scope_type === "department") {
        const { data: d } = await supabase.from("departments").select("id,name").eq("id", s.scope_id).maybeSingle();
        if (d) { deptIds.add(d.id); scopes.push({ type: "Department", name: d.name }); }
      } else if (s.scope_type === "faculty") {
        const { data: f } = await supabase.from("faculties").select("id,name").eq("id", s.scope_id).maybeSingle();
        const { data: ds } = await supabase.from("departments").select("id").eq("faculty_id", s.scope_id);
        for (const d of ds ?? []) deptIds.add(d.id);
        if (f) scopes.push({ type: "Faculty", name: f.name });
      } else {
        const { data: p } = await supabase.from("programmes").select("id,name,department_id").eq("id", s.scope_id).maybeSingle();
        if (p) { deptIds.add(p.department_id); scopes.push({ type: "Programme", name: p.name }); }
      }
    }
    if (deptIds.size === 0) return { ...empty, scopes };

    const { data: courses } = await supabase
      .from("courses")
      .select("id,code")
      .in("department_id", Array.from(deptIds));
    const courseIds = (courses ?? []).map((c) => c.id);
    if (courseIds.length === 0) return { ...empty, scopes };
    const codeByCourse = new Map((courses ?? []).map((c) => [c.id, c.code]));

    const { data: offerings } = await supabase
      .from("course_offerings")
      .select("id,course_id")
      .in("course_id", courseIds);
    const offeringIds = (offerings ?? []).map((o) => o.id);
    if (offeringIds.length === 0) return { ...empty, scopes };
    const codeByOffering = new Map(
      (offerings ?? []).map((o) => [o.id, codeByCourse.get(o.course_id) ?? "—"]),
    );

    // Chunk to keep the IN() lists sane.
    const chunk = offeringIds.slice(0, 400);
    const { count: pending } = await supabase
      .from("results")
      .select("id", { count: "exact", head: true })
      .in("offering_id", chunk)
      .in("status", ["submitted", "hod_approved", "dean_approved", "registry_approved"]);
    const { count: published } = await supabase
      .from("results")
      .select("id", { count: "exact", head: true })
      .in("offering_id", chunk)
      .eq("status", "published");

    const today = new Date().toISOString().slice(0, 10);
    const { data: exams } = await supabase
      .from("exam_schedules")
      .select("id,offering_id,exam_date,start_time,venue")
      .in("offering_id", chunk)
      .gte("exam_date", today)
      .order("exam_date", { ascending: true })
      .limit(6);

    return {
      scopes,
      offeringsCovered: offeringIds.length,
      pendingResults: pending ?? 0,
      publishedResults: published ?? 0,
      upcomingExams: (exams ?? []).map((e) => ({
        id: e.id,
        exam_date: e.exam_date,
        start_time: e.start_time,
        venue: e.venue,
        code: codeByOffering.get(e.offering_id) ?? "—",
      })),
    };
  });
