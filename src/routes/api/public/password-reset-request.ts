import { createFileRoute } from "@tanstack/react-router";
import { normalizeMatric } from "@/lib/matric";

/**
 * Public "forgot password" intake for students who sign in with a matric number.
 * Those accounts use an internal synthetic email, so a reset link cannot be
 * mailed to them. Instead we record a request that Registry/ICT approves,
 * which restores the year-of-entry temporary password.
 *
 * Always answers with a generic success so the endpoint cannot be used to
 * enumerate valid matric numbers.
 */
export const Route = createFileRoute("/api/public/password-reset-request")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { matric?: string; contact?: string };
        try {
          body = (await request.json()) as { matric?: string; contact?: string };
        } catch {
          return json({ error: "Invalid JSON" }, 400);
        }

        const matric = body.matric ? normalizeMatric(body.matric).slice(0, 64) : "";
        const contact = String(body.contact ?? "").trim().slice(0, 120) || null;
        if (!matric) return json({ error: "Enter your matric number" }, 400);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: student } = await supabaseAdmin
          .from("students")
          .select("id")
          .eq("matric_number", matric)
          .maybeSingle();

        if (student) {
          // Collapse repeat requests: keep one pending row per student.
          const { data: existing } = await supabaseAdmin
            .from("password_reset_requests")
            .select("id")
            .eq("student_id", student.id)
            .eq("status", "pending")
            .maybeSingle();

          if (existing) {
            await supabaseAdmin
              .from("password_reset_requests")
              .update({ contact, created_at: new Date().toISOString() })
              .eq("id", existing.id);
          } else {
            await supabaseAdmin.from("password_reset_requests").insert({
              student_id: student.id,
              matric_number: matric,
              contact,
              note: "Requested from the sign-in page",
            });
          }
        }

        return json({ ok: true }, 200);
      },
    },
  },
});

function json(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}
