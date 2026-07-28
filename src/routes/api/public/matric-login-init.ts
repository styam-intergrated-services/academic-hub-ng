import { createFileRoute } from "@tanstack/react-router";
import { matricToSyntheticEmail, normalizeMatric } from "@/lib/matric";

/**
 * Public activation endpoint for matric-number login.
 *
 * Contract:
 *   POST { matric, password }
 *   - looks up the student by matric_number
 *   - if the student has no auth_user_id yet AND password === entry_year (as string),
 *     creates a Supabase auth user with a synthetic internal email
 *     (`<matric-slug>@students.akcoe.internal`) using the same password,
 *     links it back to the student row, and marks default_password_changed = false.
 *   - returns { synthetic_email } on success so the browser can sign in normally.
 *
 * Never authenticates the caller — only bootstraps the auth user. All subsequent
 * sign-ins go through the normal Supabase auth flow.
 */
export const Route = createFileRoute("/api/public/matric-login-init")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { matric?: string; password?: string };
        try {
          body = (await request.json()) as { matric?: string; password?: string };
        } catch {
          return json({ error: "Invalid JSON" }, 400);
        }
        const matric = body.matric ? normalizeMatric(body.matric) : "";
        const password = String(body.password ?? "");
        if (!matric || !password) return json({ error: "Missing matric or password" }, 400);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: student, error } = await supabaseAdmin
          .from("students")
          .select("id, matric_number, full_name, entry_year, auth_user_id, default_password_changed")
          .eq("matric_number", matric)
          .maybeSingle();
        if (error) return json({ error: "Lookup failed" }, 500);
        if (!student) return json({ error: "No student found with that matric number" }, 404);

        const syntheticEmail = matricToSyntheticEmail(student.matric_number);
        const entryYear = student.entry_year != null ? String(student.entry_year) : "";
        // Auth requires a stronger secret than a bare 4-digit year, so the account
        // password is derived from the year. Students still only ever type the year.
        const derived = entryYear ? `AKCOE@${entryYear}` : "";
        const typedIsTemp = !!entryYear && (password === entryYear || password === derived);

        // Already activated → hand back the derived secret when the student is still
        // on the temporary password, so the browser can complete sign-in.
        if (student.auth_user_id) {
          if (typedIsTemp && student.default_password_changed === false) {
            return json({ synthetic_email: syntheticEmail, signin_password: derived, activated: false }, 200);
          }
          return json({ synthetic_email: syntheticEmail, activated: false }, 200);
        }

        // First-login: only the entry_year works as the temporary password.
        if (!typedIsTemp) {
          return json({ error: "Invalid matric number or temporary password" }, 401);
        }

        // Create the auth user with the derived password, then link it.
        const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email: syntheticEmail,
          password: derived,
          email_confirm: true,
          user_metadata: { matric_number: student.matric_number, synthetic: true },
        });

        if (createErr || !created?.user) {
          return json({ error: createErr?.message ?? "Failed to create account" }, 500);
        }

        const { error: linkErr } = await supabaseAdmin
          .from("students")
          .update({ auth_user_id: created.user.id, default_password_changed: false })
          .eq("id", student.id);
        if (linkErr) {
          // Best-effort rollback of the just-created auth user.
          await supabaseAdmin.auth.admin.deleteUser(created.user.id).catch(() => {});
          return json({ error: linkErr.message }, 500);
        }

        // Give the new user the student role so RLS-friendly paths work immediately.
        await supabaseAdmin
          .from("user_roles")
          .insert({ user_id: created.user.id, role: "student" })
          .then(() => {}, () => {});

        // Seed a minimal profile row (profiles.id = auth user id).
        await supabaseAdmin
          .from("profiles")
          .upsert(
            { id: created.user.id, email: syntheticEmail, full_name: student.full_name ?? student.matric_number },
            { onConflict: "id" },
          )
          .then(() => {}, () => {});

        return json({ synthetic_email: syntheticEmail, signin_password: derived, activated: true }, 200);
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
