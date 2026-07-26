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
        if (person.department_id) {
          const { error: deptErr } = await supabaseAdmin
            .from("departments")
            .update({ hod_id: userId! })
            .eq("id", person.department_id);
          deptLinked = !deptErr;
        }

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
