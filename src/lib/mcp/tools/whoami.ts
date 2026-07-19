import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser, unauthorized } from "../supabase";

export default defineTool({
  name: "whoami",
  title: "Who am I",
  description: "Return the signed-in AKCOE user's profile, roles, and (if a student) matric number, programme, level and CGPA.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return unauthorized();
    const supabase = supabaseForUser(ctx);
    const userId = ctx.getUserId();
    const [{ data: profile }, { data: roles }, { data: student }] = await Promise.all([
      supabase.from("profiles").select("email,full_name,phone,avatar_url").eq("id", userId!).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId!),
      supabase.from("students")
        .select("matric_number,cgpa,standing,total_credit_units,programme:programmes(name,code),department:departments(name,code),level:levels(name,code)")
        .eq("id", userId!).maybeSingle(),
    ]);
    const payload = {
      user_id: userId,
      email: profile?.email ?? ctx.getUserEmail(),
      full_name: profile?.full_name,
      phone: profile?.phone,
      roles: (roles ?? []).map((r) => r.role),
      student: student ?? null,
    };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});
