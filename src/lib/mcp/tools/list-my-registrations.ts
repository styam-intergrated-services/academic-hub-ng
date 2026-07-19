import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, unauthorized } from "../supabase";

export default defineTool({
  name: "list_my_registrations",
  title: "List my course registrations",
  description: "List the signed-in student's registered courses. Optionally filter by semester_id.",
  inputSchema: {
    semester_id: z.string().uuid().optional().describe("Optional semester UUID to filter"),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ semester_id }, ctx) => {
    if (!ctx.isAuthenticated()) return unauthorized();
    const supabase = supabaseForUser(ctx);
    let q = supabase
      .from("course_registrations")
      .select("id,status,offering:course_offerings(id,semester_id,semester:semesters(name),course:courses(code,title,credit_units))")
      .eq("student_id", ctx.getUserId()!);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    const filtered = semester_id ? (data ?? []).filter((r: any) => r.offering?.semester_id === semester_id) : (data ?? []);
    return {
      content: [{ type: "text", text: JSON.stringify(filtered, null, 2) }],
      structuredContent: { registrations: filtered },
    };
  },
});
