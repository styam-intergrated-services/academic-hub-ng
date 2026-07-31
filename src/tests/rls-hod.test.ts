/**
 * RLS regression suite — HOD scope.
 *
 * These tests sign in as a real HOD account against the live Data API and assert
 * what row-level security actually returns, so a policy change that widens a
 * HOD's reach shows up as a failing test.
 *
 * They require credentials to be supplied through the environment (never commit them):
 *   RLS_TEST_HOD_EMAIL=... RLS_TEST_HOD_PASSWORD=... bunx vitest run src/tests/rls-hod.test.ts
 * Without those variables the suite skips instead of failing.
 */
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
const KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY;
const EMAIL = process.env.RLS_TEST_HOD_EMAIL;
const PASSWORD = process.env.RLS_TEST_HOD_PASSWORD;

const enabled = Boolean(URL && KEY && EMAIL && PASSWORD);
const d = enabled ? describe : describe.skip;

d("RLS: HOD scope", () => {
  let client: SupabaseClient;
  let uid: string;
  let myDeptIds: string[] = [];

  beforeAll(async () => {
    client = createClient(URL!, KEY!, {
      auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    });
    const { data, error } = await client.auth.signInWithPassword({ email: EMAIL!, password: PASSWORD! });
    if (error) throw new Error(`HOD sign-in failed: ${error.message}`);
    uid = data.user!.id;

    const { data: depts } = await client.from("departments").select("id, hod_id");
    myDeptIds = (depts ?? []).filter((x) => x.hod_id === uid).map((x) => x.id);
    expect(myDeptIds.length, "test account must head at least one department").toBeGreaterThan(0);
  });

  afterAll(async () => { await client?.auth.signOut(); });

  it("holds exactly the lecturer + hod roles (no admin escalation)", async () => {
    const { data } = await client.from("user_roles").select("role").eq("user_id", uid);
    const roles = (data ?? []).map((r) => r.role).sort();
    expect(roles).toEqual(["hod", "lecturer"]);
    expect(roles).not.toContain("super_admin");
    expect(roles).not.toContain("ict_admin");
    expect(roles).not.toContain("registry");
    expect(roles).not.toContain("dean");
  });

  it("cannot read other users' roles", async () => {
    const { data } = await client.from("user_roles").select("user_id").neq("user_id", uid);
    expect(data ?? []).toHaveLength(0);
  });

  it("only sees profiles of its own department's students (plus its own)", async () => {
    const { data: visible } = await client.from("profiles").select("id");
    const ids = (visible ?? []).map((p) => p.id);
    expect(ids).toContain(uid);

    // Every other visible profile must belong to a student in a department this user heads.
    const others = ids.filter((id) => id !== uid);
    if (others.length) {
      const { data: students } = await client
        .from("students")
        .select("auth_user_id, department_id")
        .in("auth_user_id", others);
      for (const id of others) {
        const row = (students ?? []).find((s) => s.auth_user_id === id);
        expect(row, `profile ${id} is visible but is not a student of this HOD's department`).toBeTruthy();
        expect(myDeptIds).toContain(row!.department_id);
      }
    }
  });

  it("cannot write to departments — not even its own", async () => {
    const { error } = await client
      .from("departments")
      .update({ hod_id: null })
      .eq("id", myDeptIds[0]!)
      .select("id");
    // RLS blocks the write: either an explicit error, or zero rows affected.
    const { data: after } = await client.from("departments").select("hod_id").eq("id", myDeptIds[0]!).maybeSingle();
    expect(after?.hod_id, "HOD must not be able to edit department records").toBe(uid);
    if (!error) expect(after?.hod_id).toBe(uid);
  });

  it("cannot grant itself a role", async () => {
    const { error } = await client.from("user_roles").insert({ user_id: uid, role: "super_admin" });
    expect(error, "self role escalation must be blocked by RLS").toBeTruthy();
  });

  it("cannot read the admin audit log", async () => {
    const { data } = await client.from("audit_logs").select("id").limit(5);
    expect(data ?? []).toHaveLength(0);
  });

  it("cannot read applications or password reset requests", async () => {
    const { data: apps } = await client.from("applications").select("id").limit(5);
    expect(apps ?? []).toHaveLength(0);
    const { data: resets } = await client.from("password_reset_requests").select("id").limit(5);
    expect(resets ?? []).toHaveLength(0);
  });

  /**
   * KNOWN SCOPE GAP (documented, not aspirational):
   * `students`, `results`, `gpa_records`, `course_registrations` and `result_history`
   * currently grant SELECT to the `hod` role college-wide; department scoping for those
   * tables is applied in the server functions, not in RLS. This test pins the current
   * behaviour so tightening the policies is a deliberate, visible change.
   */
  it("students/results reads are still role-wide at the database layer (app-layer scoping)", async () => {
    const { data: students } = await client.from("students").select("id, department_id").limit(200);
    const outside = (students ?? []).filter((s) => !myDeptIds.includes(s.department_id));
    expect(
      outside.length,
      "if this is now 0, RLS was tightened — update this test to assert department-only access",
    ).toBeGreaterThan(0);
  });
});
