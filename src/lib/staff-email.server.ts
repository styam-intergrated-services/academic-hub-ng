// Server-only helpers for sending staff onboarding email via Resend.

export const PORTAL_URL = "https://www.akcoekano.com/auth";

export interface StaffOnboardingEmailInput {
  full_name: string | null;
  email: string;
  temp_password?: string | null;
  roles: string[];
  department_name?: string | null;
}

export function renderStaffOnboardingEmail(input: StaffOnboardingEmailInput) {
  const name = (input.full_name ?? "").trim() || "Colleague";
  const roleText = input.roles.length
    ? input.roles.map((r) => r.replace(/_/g, " ")).join(" and ")
    : "staff";
  const dept = input.department_name ? ` for the ${input.department_name} department` : "";
  const navy = "#0f2542";
  const gold = "#b8892b";

  const passwordBlock = input.temp_password
    ? `<tr><td style="padding:6px 0;color:#475569;">Temporary password</td>
         <td style="padding:6px 0;font-weight:700;color:${navy};font-family:monospace;">${escapeHtml(input.temp_password)}</td></tr>`
    : "";

  const html = `<!doctype html>
<html><body style="margin:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
  <div style="max-width:560px;margin:0 auto;padding:24px;">
    <div style="border-top:4px solid ${gold};background:${navy};color:#ffffff;padding:20px 24px;">
      <div style="font-size:18px;font-weight:700;">Aminu Kano College of Education</div>
      <div style="font-size:13px;opacity:.85;">Staff Portal Access</div>
    </div>
    <div style="border:1px solid #e2e8f0;border-top:0;padding:24px;">
      <p style="margin:0 0 12px;">Dear ${escapeHtml(name)},</p>
      <p style="margin:0 0 16px;line-height:1.6;">
        Your account on the College Management Portal is ready. You have been assigned the
        <strong>${escapeHtml(roleText)}</strong> role${escapeHtml(dept)}.
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin:0 0 16px;">
        <tr><td style="padding:6px 0;color:#475569;">Portal</td>
            <td style="padding:6px 0;"><a href="${PORTAL_URL}" style="color:${navy};font-weight:700;">${PORTAL_URL}</a></td></tr>
        <tr><td style="padding:6px 0;color:#475569;">Username</td>
            <td style="padding:6px 0;font-weight:700;color:${navy};">${escapeHtml(input.email)}</td></tr>
        ${passwordBlock}
      </table>
      <p style="margin:0 0 16px;line-height:1.6;">
        Sign in with the details above. On your first login you will be prompted to set your own
        permanent password. If you are not ready to do that yet, you may choose
        <em>“Skip for now”</em> and set it later from your profile.
      </p>
      <p style="margin:0 0 20px;">
        <a href="${PORTAL_URL}" style="background:${navy};color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:6px;display:inline-block;font-weight:700;">Sign in to the portal</a>
      </p>
      <p style="margin:0;font-size:13px;color:#64748b;line-height:1.6;">
        These credentials are personal to you. Please do not share this email or your password with anyone.
      </p>
    </div>
    <p style="font-size:12px;color:#94a3b8;text-align:center;margin:16px 0 0;">
      Aminu Kano College of Education — Kano, Nigeria
    </p>
  </div>
</body></html>`;

  const text = [
    `Dear ${name},`,
    "",
    `Your account on the AKCOE College Management Portal is ready (${roleText}${dept}).`,
    `Portal: ${PORTAL_URL}`,
    `Username: ${input.email}`,
    input.temp_password ? `Temporary password: ${input.temp_password}` : null,
    "",
    "On first login you will be prompted to set your own permanent password. You may choose \"Skip for now\" and set it later.",
    "These credentials are personal to you — please do not share this email.",
    "",
    "Aminu Kano College of Education",
  ].filter(Boolean).join("\n");

  return { subject: "Your AKCOE Staff Portal login details", html, text };
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function sendViaResend(to: string, subject: string, html: string, text: string) {
  const apiKey = process.env["RESEND_API_KEY"];
  if (!apiKey) throw new Error("RESEND_API_KEY is not configured. Add it in Project Settings → Secrets.");
  const from = process.env["RESEND_FROM"] ?? "AKCOE Portal <onboarding@resend.dev>";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ from, to: [to], subject, html, text }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Email provider request failed [${res.status}]: ${body}`);
  }
  return (await res.json()) as { id?: string };
}
