import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const RESET_ROLES = ["super_admin", "ict_admin", "registry"];

async function assertResetAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r: any) => r.role);
  if (!roles.some((r: string) => RESET_ROLES.includes(r))) {
    throw new Error("Forbidden: requires registry, ICT admin or super admin");
  }
}

function randomTempPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  const body = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
  return `Akcoe#${body}`;
}

/** Pending / recent password-reset requests raised from the sign-in page. */
export const listResetRequests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ status: z.enum(["pending", "completed", "rejected", "all"]).default("pending") }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertResetAdmin(context.supabase, context.userId);
    let q = context.supabase
      .from("password_reset_requests")
      .select("id, matric_number, contact, note, status, created_at, resolved_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

/**
 * Approve or reject a reset request.
 * Approving a student request restores the temporary password (year of entry)
 * and re-arms the forced password change on next sign-in.
 */
export const resolveResetRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), action: z.enum(["approve", "reject"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertResetAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: req, error } = await supabaseAdmin
      .from("password_reset_requests")
      .select("id, student_id, matric_number, status")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw error;
    if (!req) throw new Error("Request not found");
    if (req.status !== "pending") throw new Error("This request has already been handled");

    let temporary_password: string | null = null;

    if (data.action === "approve") {
      if (!req.student_id) throw new Error("Request is not linked to a student record");
      const { data: student } = await supabaseAdmin
        .from("students")
        .select("id, entry_year, auth_user_id")
        .eq("id", req.student_id)
        .maybeSingle();
      if (!student) throw new Error("Student record not found");
      if (!student.entry_year) throw new Error("Student has no entry year on record");

      const derived = `AKCOE@${student.entry_year}`;
      if (student.auth_user_id) {
        const { error: upErr } = await supabaseAdmin.auth.admin.updateUserById(student.auth_user_id, {
          password: derived,
        });
        if (upErr) throw new Error(upErr.message);
      }
      await supabaseAdmin.from("students").update({ default_password_changed: false }).eq("id", student.id);
      temporary_password = String(student.entry_year);
    }

    const { error: resErr } = await supabaseAdmin
      .from("password_reset_requests")
      .update({
        status: data.action === "approve" ? "completed" : "rejected",
        resolved_by: context.userId,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", req.id);
    if (resErr) throw resErr;

    return { ok: true, temporary_password };
  });

/**
 * Admin-issued reset for any account with a real email (staff, applicants, admins).
 * Sets a one-time temporary password and forces a change at next sign-in.
 */
export const adminResetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ email: z.string().email().max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertResetAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const email = data.email.trim().toLowerCase();
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const user = list?.users?.find((u) => (u.email ?? "").toLowerCase() === email);
    if (!user) throw new Error("No account with that email");

    const temp = randomTempPassword();
    const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, { password: temp });
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("profiles").update({ must_change_password: true }).eq("id", user.id);

    return { ok: true, email, temporary_password: temp };
  });
