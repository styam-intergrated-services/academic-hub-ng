import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser, unauthorized } from "../supabase";

export default defineTool({
  name: "list_my_programme_catalog",
  title: "List my programme catalogue",
  description:
    "Return the signed-in student's programme, all NCE levels, current/upcoming semesters, and every course available to their programme (their department + shared GSE/EDF/PSY/CUR foundations) with credit units, grouped by level and semester. Supports course-registration planning.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_i, ctx) => {
    if (!ctx.isAuthenticated()) return unauthorized();
    const supabase = supabaseForUser(ctx);
    const userId = ctx.getUserId()!;

    const { data: student, error: se } = await supabase
      .from("students")
      .select("id,matric_number,current_level_id,programme:programmes(id,code,name,department_id,department:departments(code,name))")
      .eq("id", userId)
      .maybeSingle();
    if (se) return { content: [{ type: "text", text: se.message }], isError: true };
    if (!student) {
      return {
        content: [{ type: "text", text: "You are not a matriculated student. Only students have a programme catalogue." }],
        isError: true,
      };
    }

    const programme = student.programme as any;
    const studentDeptId = programme?.department_id as string;

    const [{ data: levels }, { data: semesters }, { data: sharedDepts }] = await Promise.all([
      supabase.from("levels").select("id,code,name,order_index").order("order_index"),
      supabase.from("semesters")
        .select("id,type,is_current,registration_open,start_date,end_date,session:academic_sessions(name)")
        .order("start_date", { ascending: false })
        .limit(6),
      supabase.from("departments").select("id,code").in("code", ["GSE","EDF","PSY","CUR"]),
    ]);

    const deptIds = [studentDeptId, ...(sharedDepts ?? []).map((d) => d.id)].filter(Boolean);
    const { data: courses, error: ce } = await supabase
      .from("courses")
      .select("id,code,title,credit_units,semester_type,level:levels(code,order_index),department:departments(code,name)")
      .in("department_id", deptIds)
      .eq("is_active", true)
      .order("code");
    if (ce) return { content: [{ type: "text", text: ce.message }], isError: true };

    const grouped: Record<string, Record<string, any[]>> = {};
    for (const c of courses ?? []) {
      const lvl = (c.level as any)?.code ?? "?";
      const sem = c.semester_type;
      grouped[lvl] ??= { first: [], second: [] };
      grouped[lvl][sem].push({
        code: c.code, title: c.title, credit_units: c.credit_units,
        department: (c.department as any)?.code,
      });
    }

    const payload = {
      student: { matric_number: student.matric_number, current_level_id: student.current_level_id },
      programme,
      levels: levels ?? [],
      semesters: semesters ?? [],
      courses_by_level_and_semester: grouped,
      totals: {
        courses: courses?.length ?? 0,
        credit_units: (courses ?? []).reduce((s, c) => s + (c.credit_units ?? 0), 0),
      },
    };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});
