import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AppRole =
  | "super_admin" | "ict_admin" | "registry" | "bursary"
  | "dean" | "hod" | "lecturer" | "student" | "applicant";

export interface PortalUser {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  roles: AppRole[];
  primary_role: AppRole;
  student?: {
    matric_number: string;
    programme_id: string;
    department_id: string;
    current_level_id: string;
    cgpa: number;
    standing: string;
  } | null;
}

const ROLE_PRIORITY: AppRole[] = [
  "super_admin","ict_admin","registry","bursary","dean","hod","lecturer","student","applicant",
];

export const getPortalUser = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PortalUser> => {
    const { supabase, userId } = context;

    const [{ data: profile }, { data: rolesData }, { data: student }] = await Promise.all([
      supabase.from("profiles").select("id,email,full_name,avatar_url").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("students").select("matric_number,programme_id,department_id,current_level_id,cgpa,standing")
        .eq("id", userId).maybeSingle(),
    ]);

    const roles = (rolesData ?? []).map((r) => r.role as AppRole);
    if (roles.length === 0) roles.push("applicant");
    const primary_role = ROLE_PRIORITY.find((r) => roles.includes(r)) ?? "applicant";

    return {
      id: userId,
      email: profile?.email ?? "",
      full_name: profile?.full_name ?? null,
      avatar_url: profile?.avatar_url ?? null,
      roles,
      primary_role,
      student: student ?? null,
    };
  });
