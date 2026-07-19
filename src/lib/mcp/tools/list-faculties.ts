import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser, unauthorized } from "../supabase";

export default defineTool({
  name: "list_faculties",
  title: "List schools & departments",
  description: "List AKCOE's schools (faculties) with their departments and programme counts.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_i, ctx) => {
    if (!ctx.isAuthenticated()) return unauthorized();
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("faculties")
      .select("code,name,departments(code,name,programmes(code,name))")
      .order("name");
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { faculties: data ?? [] },
    };
  },
});
