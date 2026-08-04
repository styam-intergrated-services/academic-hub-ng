import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const APP_ROLES = [
  "super_admin","ict_admin","provost","registry","bursary","dean","hod","lecturer","examination_officer","student","applicant",
] as const;

export type AppRole = typeof APP_ROLES[number];

const SEMESTER_TYPES = ["first","second"] as const;
const SESSION_STATUSES = ["upcoming","active","archived","closed"] as const;

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r: any) => r.role);
  if (!roles.some((r: string) => ["super_admin","ict_admin"].includes(r))) {
    throw new Error("Forbidden: requires super_admin or ict_admin");
  }
}
async function assertRegistry(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r: any) => r.role);
  if (!roles.some((r: string) => ["super_admin","ict_admin","registry"].includes(r))) {
    throw new Error("Forbidden: requires registry, ict_admin or super_admin");
  }
}

// ============ USERS & ROLES ============

export const listUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    search: z.string().max(120).optional().default(""),
    role: z.enum(APP_ROLES).optional(),
    limit: z.number().int().min(1).max(200).optional().default(50),
  }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    let q = supabase
      .from("profiles")
      .select("id, email, full_name, avatar_url, phone, created_at")
      .order("created_at", { ascending: false })
      .limit(data.limit);

    if (data.search.trim()) {
      const s = `%${data.search.trim()}%`;
      q = q.or(`email.ilike.${s},full_name.ilike.${s}`);
    }

    const { data: profiles, error } = await q;
    if (error) throw error;

    const ids = (profiles ?? []).map((p) => p.id);
    if (ids.length === 0) return [];

    const { data: rolesData } = await supabase.from("user_roles").select("user_id, role").in("user_id", ids);
    const rolesByUser = new Map<string, AppRole[]>();
    for (const r of rolesData ?? []) {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push(r.role as AppRole);
      rolesByUser.set(r.user_id, arr);
    }

    let out = (profiles ?? []).map((p) => ({
      ...p,
      roles: rolesByUser.get(p.id) ?? [],
    }));

    if (data.role) out = out.filter((u) => u.roles.includes(data.role!));
    return out;
  });

export const grantRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    user_id: z.string().uuid(),
    role: z.enum(APP_ROLES),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { error } = await supabase.from("user_roles").insert({ user_id: data.user_id, role: data.role });
    if (error && !`${error.message}`.includes("duplicate")) throw error;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: userId,
      action: "role_granted",
      entity: "user_roles",
      entity_id: data.user_id,
      metadata: { role: data.role, at: new Date().toISOString() },
    });
    await supabaseAdmin.from("notifications").insert({
      user_id: data.user_id,
      title: "Portal access updated",
      body: `You have been granted the ${data.role.replace("_", " ")} role on the AKCOE portal.`,
      category: "access",
    });
    return { ok: true };
  });

export const revokeRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    user_id: z.string().uuid(),
    role: z.enum(APP_ROLES),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    if (data.user_id === userId && (data.role === "super_admin" || data.role === "ict_admin")) {
      throw new Error("You cannot revoke your own admin role");
    }
    const { error } = await supabase.from("user_roles").delete().eq("user_id", data.user_id).eq("role", data.role);
    if (error) throw error;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: userId,
      action: "role_revoked",
      entity: "user_roles",
      entity_id: data.user_id,
      metadata: { role: data.role, at: new Date().toISOString() },
    });
    await supabaseAdmin.from("notifications").insert({
      user_id: data.user_id,
      title: "Portal access updated",
      body: `Your ${data.role.replace("_", " ")} role on the AKCOE portal has been removed.`,
      category: "access",
    });
    return { ok: true };
  });


// ============ ACADEMIC STRUCTURE (reads) ============

export const listAcademicStructure = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const [f, d, p, l, s, sem, c] = await Promise.all([
      supabase.from("faculties").select("id,name,code,dean_id").order("name"),
      supabase.from("departments").select("id,name,code,faculty_id,hod_id").order("name"),
      supabase.from("programmes").select("id,name,code,department_id,duration_years").order("name"),
      supabase.from("levels").select("id,code,name,order_index").order("order_index"),
      supabase.from("academic_sessions").select("id,name,start_date,end_date,status").order("start_date", { ascending: false }),
      supabase.from("semesters").select("id,session_id,type,start_date,end_date,registration_open,is_current").order("start_date", { ascending: false }),
      supabase.from("courses").select("id,department_id,code,title,credit_units,level_id,semester_type,is_active,category").order("code"),
    ]);
    if (f.error) throw f.error;
    return {
      faculties: f.data ?? [],
      departments: d.data ?? [],
      programmes: p.data ?? [],
      levels: l.data ?? [],
      sessions: s.data ?? [],
      semesters: sem.data ?? [],
      courses: c.data ?? [],
    };
  });

// ============ AUDIT LOG ============

export const STAFF_AUDIT_ACTIONS = [
  "staff_account_created",
  "staff_assignment_updated",
  "role_granted",
  "role_revoked",
] as const;

export type AuditMetadata = {
  role?: string;
  roles?: string[];
  email?: string;
  staff_code?: string | null;
  department_id?: string | null;
  department_name?: string | null;
  hod_linked?: boolean;
  at?: string;
};

export type AuditLogRow = {
  id: string;
  created_at: string;
  action: string;
  entity: string;
  entity_id: string | null;
  metadata: AuditMetadata | null;
  actor_id: string | null;
  actor_name: string | null;
  actor_email: string | null;
  target_name: string | null;
  target_email: string | null;
  target_staff_code: string | null;

};


export type AuditLogPage = {
  rows: AuditLogRow[];
  total: number;
  page: number;
  page_size: number;
};

/** Strip characters that would break PostgREST `or(...)` filter syntax. */
function safeLike(v: string): string {
  return v.replace(/[,()%*"']/g, " ").trim();
}

export const listAuditLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    action: z.string().max(60).optional(),
    staff_only: z.boolean().optional().default(true),
    search: z.string().max(120).optional().default(""),
    staff_code: z.string().max(40).optional().default(""),
    department_id: z.string().uuid().optional(),
    from: z.string().max(30).optional(),
    to: z.string().max(30).optional(),
    page: z.number().int().min(1).max(2000).optional().default(1),
    page_size: z.number().int().min(1).max(2000).optional().default(25),
  }).parse(d ?? {}))
  .handler(async ({ data, context }): Promise<AuditLogPage> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    let q = supabase
      .from("audit_logs")
      .select("id, created_at, action, entity, entity_id, metadata, actor_id", { count: "exact" })
      .order("created_at", { ascending: false });

    if (data.action) q = q.eq("action", data.action);
    else if (data.staff_only) q = q.in("action", STAFF_AUDIT_ACTIONS as unknown as string[]);
    if (data.from) q = q.gte("created_at", new Date(data.from).toISOString());
    if (data.to) q = q.lte("created_at", new Date(`${data.to}T23:59:59`).toISOString());
    if (data.department_id) q = q.eq("metadata->>department_id", data.department_id);

    // Staff-code filter: resolve to the staff profiles it matches, then filter on target id.
    const code = safeLike(data.staff_code);
    if (code) {
      const { data: coded } = await supabase
        .from("profiles")
        .select("id")
        .ilike("staff_code", `%${code}%`)
        .limit(500);
      const ids = (coded ?? []).map((p) => p.id);
      if (ids.length === 0) {
        return { rows: [], total: 0, page: data.page, page_size: data.page_size };
      }
      q = q.in("entity_id", ids);
    }

    // Full-text-ish search: staff name/email/staff code, action, department name/code.
    const s = safeLike(data.search);
    if (s) {
      const like = `%${s}%`;
      const [{ data: profs }, { data: depts }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id")
          .or(`full_name.ilike.${like},email.ilike.${like},staff_code.ilike.${like}`)
          .limit(500),
        supabase
          .from("departments")
          .select("id")
          .or(`name.ilike.${like},code.ilike.${like}`)
          .limit(300),
      ]);
      const ors = [
        `action.ilike.${like}`,
        `metadata->>email.ilike.${like}`,
        `metadata->>department_name.ilike.${like}`,
        `metadata->>staff_code.ilike.${like}`,
        `metadata->>role.ilike.${like}`,
      ];
      const pIds = (profs ?? []).map((p) => p.id);
      const dIds = (depts ?? []).map((d) => d.id);
      if (pIds.length) ors.push(`entity_id.in.(${pIds.join(",")})`);
      if (dIds.length) ors.push(`metadata->>department_id.in.(${dIds.join(",")})`);
      q = q.or(ors.join(","));
    }

    const start = (data.page - 1) * data.page_size;
    const { data: logs, error, count } = await q.range(start, start + data.page_size - 1);
    if (error) throw error;

    const ids = new Set<string>();
    for (const l of logs ?? []) {
      if (l.actor_id) ids.add(l.actor_id);
      if (l.entity_id) ids.add(l.entity_id);
    }
    const people = new Map<string, { full_name: string | null; email: string; staff_code: string | null }>();
    if (ids.size) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email, staff_code")
        .in("id", [...ids]);
      for (const p of profiles ?? [])
        people.set(p.id, { full_name: p.full_name, email: p.email, staff_code: p.staff_code });
    }

    const rows: AuditLogRow[] = (logs ?? []).map((l) => {
      const actor = l.actor_id ? people.get(l.actor_id) : undefined;
      const target = l.entity_id ? people.get(l.entity_id) : undefined;
      const meta = (l.metadata ?? null) as AuditMetadata | null;
      return {
        id: l.id,
        created_at: l.created_at,
        action: l.action,
        entity: l.entity,
        entity_id: l.entity_id,
        metadata: meta,
        actor_id: l.actor_id,
        actor_name: actor?.full_name ?? null,
        actor_email: actor?.email ?? null,
        target_name: target?.full_name ?? null,
        target_email: target?.email ?? (typeof meta?.email === "string" ? (meta.email as string) : null),
        target_staff_code: target?.staff_code ?? meta?.staff_code ?? null,
      };
    });

    return { rows, total: count ?? rows.length, page: data.page, page_size: data.page_size };
  });



// ============ FACULTIES ============
const facultySchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(2).max(120),
  code: z.string().min(2).max(20).transform((v) => v.toUpperCase()),
  dean_id: z.string().uuid().nullable().optional(),
});
export const upsertFaculty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => facultySchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertRegistry(context.supabase, context.userId);
    const { error } = data.id
      ? await context.supabase.from("faculties").update(data).eq("id", data.id)
      : await context.supabase.from("faculties").insert(data);
    if (error) throw error;
    return { ok: true };
  });
export const deleteFaculty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertRegistry(context.supabase, context.userId);
    const { error } = await context.supabase.from("faculties").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ============ DEPARTMENTS ============
const deptSchema = z.object({
  id: z.string().uuid().optional(),
  faculty_id: z.string().uuid(),
  name: z.string().min(2).max(120),
  code: z.string().min(2).max(20).transform((v) => v.toUpperCase()),
  hod_id: z.string().uuid().nullable().optional(),
});
export const upsertDepartment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => deptSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertRegistry(context.supabase, context.userId);
    const { error } = data.id
      ? await context.supabase.from("departments").update(data).eq("id", data.id)
      : await context.supabase.from("departments").insert(data);
    if (error) throw error;
    return { ok: true };
  });
export const deleteDepartment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertRegistry(context.supabase, context.userId);
    const { error } = await context.supabase.from("departments").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ============ PROGRAMMES ============
const progSchema = z.object({
  id: z.string().uuid().optional(),
  department_id: z.string().uuid(),
  name: z.string().min(2).max(160),
  code: z.string().min(2).max(20).transform((v) => v.toUpperCase()),
  duration_years: z.number().int().min(1).max(6),
});
export const upsertProgramme = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => progSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertRegistry(context.supabase, context.userId);
    const { error } = data.id
      ? await context.supabase.from("programmes").update(data).eq("id", data.id)
      : await context.supabase.from("programmes").insert(data);
    if (error) throw error;
    return { ok: true };
  });
export const deleteProgramme = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertRegistry(context.supabase, context.userId);
    const { error } = await context.supabase.from("programmes").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ============ LEVELS ============
const levelSchema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().min(1).max(10),
  name: z.string().min(2).max(60),
  order_index: z.number().int().min(0).max(20),
});
export const upsertLevel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => levelSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertRegistry(context.supabase, context.userId);
    const { error } = data.id
      ? await context.supabase.from("levels").update(data).eq("id", data.id)
      : await context.supabase.from("levels").insert(data);
    if (error) throw error;
    return { ok: true };
  });
export const deleteLevel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertRegistry(context.supabase, context.userId);
    const { error } = await context.supabase.from("levels").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ============ SESSIONS ============
const sessionSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(4).max(40),
  start_date: z.string(),
  end_date: z.string(),
  status: z.enum(SESSION_STATUSES),
});
export const upsertSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => sessionSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertRegistry(context.supabase, context.userId);
    const { error } = data.id
      ? await context.supabase.from("academic_sessions").update(data).eq("id", data.id)
      : await context.supabase.from("academic_sessions").insert(data);
    if (error) throw error;
    return { ok: true };
  });
export const deleteSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertRegistry(context.supabase, context.userId);
    const { error } = await context.supabase.from("academic_sessions").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ============ SEMESTERS ============
const semSchema = z.object({
  id: z.string().uuid().optional(),
  session_id: z.string().uuid(),
  type: z.enum(SEMESTER_TYPES),
  start_date: z.string(),
  end_date: z.string(),
  registration_open: z.boolean(),
  is_current: z.boolean(),
});
export const upsertSemester = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => semSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertRegistry(context.supabase, context.userId);
    if (data.is_current) {
      await context.supabase.from("semesters").update({ is_current: false }).neq("id", data.id ?? "00000000-0000-0000-0000-000000000000");
    }
    const { error } = data.id
      ? await context.supabase.from("semesters").update(data).eq("id", data.id)
      : await context.supabase.from("semesters").insert(data);
    if (error) throw error;
    return { ok: true };
  });
export const deleteSemester = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertRegistry(context.supabase, context.userId);
    const { error } = await context.supabase.from("semesters").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ============ COURSES ============
const COURSE_CATEGORIES = ["education","general_studies","subject_major","teaching_practice","siwes","elective"] as const;
const courseSchema = z.object({
  id: z.string().uuid().optional(),
  department_id: z.string().uuid(),
  code: z.string().min(3).max(20).transform((v) => v.toUpperCase()),
  title: z.string().min(3).max(200),
  credit_units: z.number().int().min(1).max(12),
  level_id: z.string().uuid(),
  semester_type: z.enum(SEMESTER_TYPES),
  is_active: z.boolean(),
  description: z.string().max(1000).nullable().optional(),
  category: z.enum(COURSE_CATEGORIES).default("subject_major"),
});
export const upsertCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => courseSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertRegistry(context.supabase, context.userId);
    const { error } = data.id
      ? await context.supabase.from("courses").update(data).eq("id", data.id)
      : await context.supabase.from("courses").insert(data);
    if (error) throw error;
    return { ok: true };
  });
export const deleteCourse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertRegistry(context.supabase, context.userId);
    const { error } = await context.supabase.from("courses").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ============ STAFF ONBOARDING ============

const STUDENT_ONLY_ROLES: AppRole[] = ["student", "applicant"];

const staffMemberSchema = z.object({
  full_name: z.string().trim().min(3, "Full name must be at least 3 characters").max(160)
    .refine((v) => /^[\p{L}][\p{L}\s.'’-]+$/u.test(v), "Full name contains invalid characters"),
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(200),
  phone: z.string().trim().min(6).max(32)
    .refine((v) => v.replace(/\D/g, "").length >= 7, "Phone must contain at least 7 digits"),
  staff_code: z.string().trim().max(32)
    .refine((v) => v === "" || /^[A-Za-z0-9/-]{2,32}$/.test(v), "Staff code may only contain letters, numbers, / and -")
    .optional(),
  roles: z.array(z.enum(APP_ROLES)).min(1, "Select at least one role").max(6),
  department_id: z.string().uuid().optional(),
})
  .refine((v) => !v.roles.some((r) => STUDENT_ONLY_ROLES.includes(r)),
    { message: "Student and applicant roles cannot be assigned through staff onboarding", path: ["roles"] })
  .refine((v) => !v.roles.includes("hod") || !!v.department_id,
    { message: "Select the department this HOD leads", path: ["department_id"] })
  .refine((v) => !v.department_id || v.roles.includes("hod"),
    { message: "Department headship requires the HOD role", path: ["roles"] });


export type StaffMemberInput = z.infer<typeof staffMemberSchema>;

/**
 * Create (or repair) staff auth accounts in bulk.
 * - login email = provided email, initial password = provided phone digits
 * - profiles.must_change_password = true → forced password change on first login
 * - roles granted via user_roles; optional department_id sets departments.hod_id
 */
export const createStaffAccounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ staff: z.array(staffMemberSchema).min(1).max(100) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const results: Array<{
      email: string; user_id: string | null; created: boolean;
      roles: string[]; department_linked: boolean; error?: string; rolled_back?: boolean;
      email_sent?: boolean; email_error?: string;
    }> = [];


    for (const person of data.staff) {
      const email = person.email.trim().toLowerCase();
      const password = person.phone.replace(/\s+/g, "");

      // Undo stack — executed newest-first when any step of this staff member fails.
      const rollback: Array<() => Promise<void>> = [];
      let userId: string | null = null;
      let created = false;

      try {
        const { data: createdUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name: person.full_name, staff_code: person.staff_code ?? null },
        });

        let resetExistingPassword = false;
        if (createErr) {
          // Already registered → reuse the account. The temporary password reset is
          // deferred until every other step succeeds, because an auth password change
          // cannot be rolled back (the previous hash is unreadable).
          const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
          const existing = list?.users?.find((u) => (u.email ?? "").toLowerCase() === email);
          if (!existing) throw createErr;
          userId = existing.id;
          resetExistingPassword = true;
        } else {
          userId = createdUser.user!.id;
          created = true;
          const newUserId = userId;
          rollback.push(async () => { await supabaseAdmin.auth.admin.deleteUser(newUserId); });
        }


        // Snapshot the profile so an existing staff record can be restored on failure.
        const { data: prevProfile } = await supabaseAdmin
          .from("profiles")
          .select("id, email, full_name, phone, staff_code, must_change_password")
          .eq("id", userId!)
          .maybeSingle();

        const { error: profileErr } = await supabaseAdmin.from("profiles").upsert(
          {
            id: userId!,
            email,
            full_name: person.full_name,
            phone: person.phone,
            staff_code: person.staff_code ?? null,
            must_change_password: true,
          },
          { onConflict: "id" },
        );
        if (profileErr) throw profileErr;
        if (prevProfile) {
          rollback.push(async () => { await supabaseAdmin.from("profiles").upsert(prevProfile, { onConflict: "id" }); });
        } else if (!created) {
          const uid = userId!;
          rollback.push(async () => { await supabaseAdmin.from("profiles").delete().eq("id", uid); });
        }

        // Only revoke roles that this call actually added.
        const { data: existingRoles } = await supabaseAdmin
          .from("user_roles").select("role").eq("user_id", userId!);
        const had = new Set((existingRoles ?? []).map((r) => r.role as AppRole));

        for (const role of person.roles) {
          const { error: roleErr } = await supabaseAdmin.from("user_roles").upsert(
            { user_id: userId!, role },
            { onConflict: "user_id,role" },
          );
          if (roleErr) throw roleErr;
          if (!had.has(role)) {
            const uid = userId!;
            rollback.push(async () => {
              await supabaseAdmin.from("user_roles").delete().eq("user_id", uid).eq("role", role);
            });
          }
        }

        let deptLinked = false;
        let deptName: string | null = null;
        if (person.department_id) {
          const { data: prevDept } = await supabaseAdmin
            .from("departments").select("id, name, hod_id").eq("id", person.department_id).maybeSingle();
          if (!prevDept) throw new Error("Selected department no longer exists");

          const { error: deptErr } = await supabaseAdmin
            .from("departments")
            .update({ hod_id: userId! })
            .eq("id", person.department_id);
          if (deptErr) throw deptErr;

          deptLinked = true;
          deptName = prevDept.name;
          const previousHod = prevDept.hod_id;
          const deptId = prevDept.id;
          rollback.push(async () => {
            await supabaseAdmin.from("departments").update({ hod_id: previousHod }).eq("id", deptId);
          });
        }

        // Audit trail: who changed roles/department, and when.
        const { error: auditErr } = await supabaseAdmin.from("audit_logs").insert({
          actor_id: context.userId,
          action: created ? "staff_account_created" : "staff_assignment_updated",
          entity: "profiles",
          entity_id: userId!,
          metadata: {
            email,
            staff_code: person.staff_code ?? null,
            roles: person.roles,
            department_id: person.department_id ?? null,
            department_name: deptName,
            hod_linked: deptLinked,
            at: new Date().toISOString(),
          },
        });
        if (auditErr) throw auditErr;

        // Last irreversible step: reset the temporary password on an existing account.
        // Done only after every rollback-able step succeeded.
        if (resetExistingPassword) {
          const { error: pwErr } = await supabaseAdmin.auth.admin.updateUserById(userId!, {
            password,
            user_metadata: { full_name: person.full_name, staff_code: person.staff_code ?? null },
          });
          if (pwErr) throw pwErr;
        }



        // In-app notification confirming the assignment + first-login prompt.
        const roleText = person.roles.map((r) => r.replace("_", " ")).join(" and ");
        await supabaseAdmin.from("notifications").insert({
          user_id: userId!,
          title: "Your portal access is ready",
          body:
            `You have been assigned the ${roleText} role${deptName ? ` for the ${deptName} department` : ""}. ` +
            `Sign in with ${email} using the temporary password issued by the College, then set your own password when prompted.`,
          link: "/first-login",
          category: "access",
        });

        // Onboarding email with the temporary password that was just generated.
        let emailSent = false;
        let emailError: string | undefined;
        try {
          const { renderStaffOnboardingEmail, sendViaResend } = await import("./staff-email.server");
          const rendered = renderStaffOnboardingEmail({
            full_name: person.full_name,
            email,
            temp_password: password,
            roles: person.roles,
            department_name: deptName,
          });
          const sent = await sendViaResend(email, rendered.subject, rendered.html, rendered.text);
          emailSent = true;
          await supabaseAdmin.from("audit_logs").insert({
            actor_id: context.userId,
            action: "staff_onboarding_email_sent",
            entity: "profiles",
            entity_id: userId!,
            metadata: { email, included_password: true, provider_id: sent.id ?? null, at: new Date().toISOString() },
          });
        } catch (mailErr) {
          // Email failure must not roll back a valid account.
          emailError = mailErr instanceof Error ? mailErr.message : "Email could not be sent";
        }

        results.push({
          email, user_id: userId, created,
          roles: person.roles, department_linked: deptLinked,
          email_sent: emailSent, email_error: emailError,
        });


      } catch (e) {
        let rolledBack = true;
        for (const undo of rollback.reverse()) {
          try { await undo(); } catch { rolledBack = false; }
        }
        results.push({
          email, user_id: null, created: false, roles: [], department_linked: false,
          rolled_back: rolledBack,
          error:
            (e instanceof Error ? e.message : "Unknown error") +
            (rolledBack
              ? " — no changes were saved (all partial changes were reverted)."
              : " — some partial changes could not be reverted automatically; review this account manually."),
        });
      }
    }


    return { results };
  });
