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
};


export const listAuditLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    action: z.string().max(60).optional(),
    staff_only: z.boolean().optional().default(true),
    search: z.string().max(120).optional().default(""),
    from: z.string().max(30).optional(),
    to: z.string().max(30).optional(),
    limit: z.number().int().min(1).max(500).optional().default(150),
  }).parse(d ?? {}))
  .handler(async ({ data, context }): Promise<AuditLogRow[]> => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    let q = supabase
      .from("audit_logs")
      .select("id, created_at, action, entity, entity_id, metadata, actor_id")
      .order("created_at", { ascending: false })
      .limit(data.limit);

    if (data.action) q = q.eq("action", data.action);
    else if (data.staff_only) q = q.in("action", STAFF_AUDIT_ACTIONS as unknown as string[]);
    if (data.from) q = q.gte("created_at", new Date(data.from).toISOString());
    if (data.to) q = q.lte("created_at", new Date(`${data.to}T23:59:59`).toISOString());

    const { data: logs, error } = await q;
    if (error) throw error;

    const ids = new Set<string>();
    for (const l of logs ?? []) {
      if (l.actor_id) ids.add(l.actor_id);
      if (l.entity_id) ids.add(l.entity_id);
    }
    const people = new Map<string, { full_name: string | null; email: string }>();
    if (ids.size) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", [...ids]);
      for (const p of profiles ?? []) people.set(p.id, { full_name: p.full_name, email: p.email });
    }

    let rows: AuditLogRow[] = (logs ?? []).map((l) => {
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
      };
    });

    const s = data.search.trim().toLowerCase();
    if (s) {
      rows = rows.filter((r) =>
        [r.actor_name, r.actor_email, r.target_name, r.target_email, r.action, JSON.stringify(r.metadata ?? {})]
          .some((v) => (v ?? "").toString().toLowerCase().includes(s)),
      );
    }
    return rows;
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

const staffMemberSchema = z.object({
  full_name: z.string().min(2).max(160),
  email: z.string().email().max(200),
  phone: z.string().min(6).max(32),
  staff_code: z.string().max(32).optional(),
  roles: z.array(z.enum(APP_ROLES)).max(6).default([]),
  department_id: z.string().uuid().optional(),
});

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
      roles: string[]; department_linked: boolean; error?: string;
    }> = [];

    for (const person of data.staff) {
      const email = person.email.trim().toLowerCase();
      const password = person.phone.replace(/\s+/g, "");
      try {
        let userId: string | null = null;
        let created = false;

        const { data: createdUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name: person.full_name, staff_code: person.staff_code ?? null },
        });

        if (createErr) {
          // already registered → look the account up and reset the temp password
          const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
          const existing = list?.users?.find((u) => (u.email ?? "").toLowerCase() === email);
          if (!existing) throw createErr;
          userId = existing.id;
          await supabaseAdmin.auth.admin.updateUserById(userId, {
            password,
            user_metadata: { full_name: person.full_name, staff_code: person.staff_code ?? null },
          });
        } else {
          userId = createdUser.user!.id;
          created = true;
        }

        await supabaseAdmin.from("profiles").upsert(
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

        for (const role of person.roles) {
          await supabaseAdmin.from("user_roles").upsert(
            { user_id: userId!, role },
            { onConflict: "user_id,role" },
          );
        }

        let deptLinked = false;
        let deptName: string | null = null;
        if (person.department_id) {
          const { data: dept, error: deptErr } = await supabaseAdmin
            .from("departments")
            .update({ hod_id: userId! })
            .eq("id", person.department_id)
            .select("name")
            .maybeSingle();
          deptLinked = !deptErr;
          deptName = dept?.name ?? null;
        }

        // Audit trail: who changed roles/department, and when.
        await supabaseAdmin.from("audit_logs").insert({
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

        // In-app notification confirming the assignment + first-login prompt.
        const roleText = person.roles.length
          ? person.roles.map((r) => r.replace("_", " ")).join(" and ")
          : "staff";
        await supabaseAdmin.from("notifications").insert({
          user_id: userId!,
          title: "Your portal access is ready",
          body:
            `You have been assigned the ${roleText} role${deptName ? ` for the ${deptName} department` : ""}. ` +
            `Sign in with ${email} using the temporary password issued by the College, then set your own password when prompted.`,
          link: "/first-login",
          category: "access",
        });

        results.push({
          email, user_id: userId, created,
          roles: person.roles, department_linked: deptLinked,
        });

      } catch (e) {
        results.push({
          email, user_id: null, created: false, roles: [], department_linked: false,
          error: e instanceof Error ? e.message : "Unknown error",
        });
      }
    }

    return { results };
  });
