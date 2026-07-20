import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const applicationInput = z.object({
  full_name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(30).optional().nullable(),
  date_of_birth: z.string().optional().nullable(),
  gender: z.enum(["male", "female"]).optional().nullable(),
  state_of_origin: z.string().trim().max(80).optional().nullable(),
  lga: z.string().trim().max(80).optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
  previous_school: z.string().trim().max(200).optional().nullable(),
  qualification: z.string().trim().max(200).optional().nullable(),
  subjects_grades: z.any().optional().nullable(),
  programme_id: z.string().uuid(),
  entry_session_id: z.string().uuid().optional().nullable(),
});

export type ApplicationInput = z.infer<typeof applicationInput>;

export const upsertMyApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: ApplicationInput) => applicationInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const row = { ...data, user_id: userId, submitted_at: new Date().toISOString() };
    const { data: saved, error } = await supabase
      .from("applications")
      .upsert(row, { onConflict: "user_id" })
      .select()
      .single();
    if (error) throw error;
    return saved;
  });

export const getMyApplication = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("applications")
      .select("*, programme:programmes(code,name), session:academic_sessions(name)")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return data;
  });

export const listApplications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { status?: string } | undefined) => d ?? {})
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase.from("applications")
      .select("id,user_id,full_name,email,phone,status,matric_number,created_at,programme:programmes(code,name),session:academic_sessions(name)")
      .order("created_at", { ascending: false });
    if (data?.status) q = q.eq("status", data.status as any);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

export const updateApplicationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; status: "pending" | "under_review" | "approved" | "rejected"; notes?: string }) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["pending", "under_review", "approved", "rejected"]),
      notes: z.string().max(1000).optional(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("applications").update({
      status: data.status,
      review_notes: data.notes ?? null,
      reviewer_id: userId,
      reviewed_at: new Date().toISOString(),
    }).eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const matriculateApplication = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: matric, error } = await supabase.rpc("matriculate_application", { _application_id: data.id });
    if (error) throw error;
    return { matric_number: matric as unknown as string };
  });

export const listProgrammesForApply = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: programmes }, { data: sessions }] = await Promise.all([
      context.supabase.from("programmes").select("id,code,name,department:departments(code,name)").order("code"),
      context.supabase.from("academic_sessions").select("id,name,status,start_date").order("start_date", { ascending: false }).limit(4),
    ]);
    return { programmes: programmes ?? [], sessions: sessions ?? [] };
  });
