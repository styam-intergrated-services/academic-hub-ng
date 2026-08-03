import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Sends the staff onboarding / welcome email.
 * The temporary password is a per-call parameter — never hardcoded — so the caller
 * passes whatever the account-creation flow actually generated for that account.
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
    const { renderStaffOnboardingEmail, sendViaResend } = await import("./staff-email.server");

    const { data: profile, error } = await supabaseAdmin
      .from("profiles").select("id, email, full_name").eq("id", data.staff_id).maybeSingle();
    if (error) throw error;
    if (!profile?.email) throw new Error("This staff account has no email address on file.");

    const { data: staffRoles } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", data.staff_id);
    const { data: dept } = await supabaseAdmin
      .from("departments").select("name").eq("hod_id", data.staff_id).maybeSingle();

    const rendered = renderStaffOnboardingEmail({
      full_name: profile.full_name,
      email: profile.email,
      temp_password: data.temp_password ?? null,
      roles: (staffRoles ?? []).map((r) => r.role as string),
      department_name: dept?.name ?? null,
    });

    const sent = await sendViaResend(profile.email, rendered.subject, rendered.html, rendered.text);

    await supabaseAdmin.from("audit_logs").insert({
      actor_id: context.userId,
      action: "staff_onboarding_email_sent",
      entity: "profiles",
      entity_id: data.staff_id,
      metadata: {
        email: profile.email,
        included_password: Boolean(data.temp_password),
        provider_id: sent.id ?? null,
        at: new Date().toISOString(),
      },
    });

    return { sent: true, email: profile.email, provider_id: sent.id ?? null };
  });
