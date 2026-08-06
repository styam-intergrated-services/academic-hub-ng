import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/** Where the onboarding link lands. `welcome=1` switches the page copy to onboarding wording. */
const ONBOARDING_REDIRECT = "https://www.akcoekano.com/reset-password?welcome=1";

/**
 * Sends the staff onboarding email through the built-in auth email channel
 * (the same one that already delivers password-reset emails reliably).
 * The recipient gets a secure link that lands on the welcome/set-password page.
 */
export const sendStaffOnboardingEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      staff_id: z.string().uuid(),
      temp_password: z.string().min(1).max(200).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: myRoles } = await context.supabase
      .from("user_roles").select("role").eq("user_id", context.userId);
    const roles = (myRoles ?? []).map((r) => r.role as string);
    if (!roles.some((r) => r === "super_admin" || r === "ict_admin")) {
      throw new Error("Forbidden: requires super_admin or ict_admin");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profile, error } = await supabaseAdmin
      .from("profiles").select("id, email, full_name").eq("id", data.staff_id).maybeSingle();
    if (error) throw error;
    if (!profile?.email) throw new Error("This staff account has no email address on file.");

    const { data: staffRoles } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", data.staff_id);
    const { data: dept } = await supabaseAdmin
      .from("departments").select("name").eq("hod_id", data.staff_id).maybeSingle();

    const roleText = (staffRoles ?? [])
      .map((r) => (r.role as string).replace(/_/g, " "))
      .join(" and ");

    const { error: sendErr } = await supabaseAdmin.auth.resetPasswordForEmail(profile.email, {
      redirectTo: ONBOARDING_REDIRECT,
    });

    const sent = !sendErr;

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      action: "staff_onboarding_email_sent",
      entity: "profiles",
      entity_id: data.staff_id,
      metadata: {
        email: profile.email,
        channel: "auth_recovery_link",
        role_text: roleText,
        department_name: dept?.name ?? null,
        sent,
        reason: sendErr?.message ?? null,
        at: new Date().toISOString(),
      },
    });

    return { sent, email: profile.email, reason: sendErr?.message ?? null };
  });
