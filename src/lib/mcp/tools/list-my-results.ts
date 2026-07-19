import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser, unauthorized } from "../supabase";

export default defineTool({
  name: "list_my_results",
  title: "List my published results",
  description: "List the signed-in student's published course results with grades and grade points, plus semester GPA records and current CGPA.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_i, ctx) => {
    if (!ctx.isAuthenticated()) return unauthorized();
    const supabase = supabaseForUser(ctx);
    const userId = ctx.getUserId()!;
    const [{ data: results, error: e1 }, { data: gpa, error: e2 }, { data: student }] = await Promise.all([
      supabase.from("results")
        .select("ca_score,exam_score,grade,grade_point,status,published_at,offering:course_offerings(course:courses(code,title,credit_units),semester:semesters(name))")
        .eq("student_id", userId).eq("status", "published"),
      supabase.from("gpa_records").select("gpa,cgpa,credit_units,standing,semester:semesters(name)").eq("student_id", userId),
      supabase.from("students").select("cgpa,total_credit_units,standing").eq("id", userId).maybeSingle(),
    ]);
    if (e1) return { content: [{ type: "text", text: e1.message }], isError: true };
    if (e2) return { content: [{ type: "text", text: e2.message }], isError: true };
    const payload = { student, results: results ?? [], semester_gpa: gpa ?? [] };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});
