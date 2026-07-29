import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Generic bulk score-sheet importer.
 *
 * Registry / Super Admin / ICT Admin paste or upload a CSV of scores for ANY
 * department. The heavy lifting happens inside the `admin_bulk_import_results`
 * database routine so the whole import runs in one transaction and can bypass
 * the live registration window guard safely.
 */

const ALLOWED = ["super_admin", "ict_admin", "registry"] as const;

export type ImportRow = {
  matric_number: string;
  course_code: string;
  course_title?: string | null;
  credit_units?: number | null;
  category?: string | null;
  contact_no?: number | null;
  score?: number | null;
  ca?: number | null;
  exam?: number | null;
  status_code?: string | null;
};

export type ImportReport = {
  dry_run: boolean;
  session_name: string;
  rows_read: number;
  semesters_created: number;
  courses_created: number;
  offerings_created: number;
  registrations_created: number;
  results_created: number;
  results_updated: number;
  errors: { row: number; matric_number?: string; reason: string }[];
};

async function assertAllowed(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r: any) => r.role as string);
  if (!roles.some((r: string) => (ALLOWED as readonly string[]).includes(r))) {
    throw new Error("Forbidden: only Registry, ICT Admin or Super Admin can import results");
  }
}

export const runBulkResultImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    session_name: string;
    publish?: boolean;
    dry_run: boolean;
    rows: ImportRow[];
  }) => {
    const name = (input.session_name ?? "").trim();
    if (!name) throw new Error("Academic session name is required");
    if (!Array.isArray(input.rows) || input.rows.length === 0) {
      throw new Error("No rows to import");
    }
    if (input.rows.length > 5000) {
      throw new Error("Please split the sheet — a maximum of 5,000 rows can be imported at once");
    }
    return { ...input, session_name: name };
  })
  .handler(async ({ data, context }): Promise<ImportReport> => {
    await assertAllowed(context.supabase, context.userId);

    // Drop null/blank keys: the importer distinguishes "ca/exam supplied"
    // from "single score supplied" by key presence.
    const rows = data.rows.map((r) => {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(r)) {
        if (v === null || v === undefined || v === "") continue;
        out[k] = v;
      }
      return out;
    });

    const { data: report, error } = await context.supabase.rpc("admin_bulk_import_results", {
      _payload: {
        session_name: data.session_name,
        publish: data.publish ?? true,
        rows,
      } as any,
      _dry_run: data.dry_run,
    });
    if (error) throw new Error(error.message);
    return report as unknown as ImportReport;
  });

/** Sessions + a matric-number sample, to help the operator fill the form. */
export const getImportContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAllowed(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: sessions }, { data: depts }] = await Promise.all([
      supabaseAdmin.from("academic_sessions").select("id, name").order("name"),
      supabaseAdmin.from("departments").select("id, name").order("name"),
    ]);

    const { count } = await supabaseAdmin
      .from("students")
      .select("id", { count: "exact", head: true });

    return {
      sessions: (sessions ?? []).map((s: any) => s.name as string),
      departments: (depts ?? []).map((d: any) => ({ id: d.id, name: d.name })),
      studentCount: count ?? 0,
    };
  });
