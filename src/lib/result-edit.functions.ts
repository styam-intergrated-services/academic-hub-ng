import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Manual correction of a single result record by Registry / ICT Admin /
 * Super Admin. Grade + grade point are recomputed by the database trigger,
 * the change is captured in result_history, and the student's GPA/CGPA is
 * recomputed afterwards.
 */

const ALLOWED = ["super_admin", "ict_admin", "registry"] as const;

const Schema = z.object({
  result_id: z.string().uuid(),
  ca_score: z.number().min(0).max(40).nullable(),
  exam_score: z.number().min(0).max(60).nullable(),
  status_code: z.enum(["OK", "ABS", "INC", "WH"]),
  note: z.string().max(300).optional(),
});

export const updateResultScores = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Schema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const roles = (roleRows ?? []).map((r: any) => r.role as string);
    if (!roles.some((r) => (ALLOWED as readonly string[]).includes(r))) {
      throw new Error("Forbidden: only Registry, ICT Admin or Super Admin can edit results");
    }

    const { data: existing, error: findErr } = await supabase
      .from("results")
      .select("id, student_id, offering_id")
      .eq("id", data.result_id)
      .maybeSingle();
    if (findErr) throw new Error(findErr.message);
    if (!existing) throw new Error("Result record not found");

    const total =
      data.status_code === "OK"
        ? (data.ca_score ?? 0) + (data.exam_score ?? 0)
        : 0;

    const { error } = await supabase
      .from("results")
      .update({
        ca_score: data.ca_score,
        exam_score: data.exam_score,
        total_score: total,
        status_code: data.status_code,
        correction_reason: data.note ?? null,
      } as never)
      .eq("id", data.result_id);
    if (error) throw new Error(error.message);

    // Recompute the affected student's semester GPA and cumulative CGPA.
    const { data: offering } = await supabase
      .from("course_offerings")
      .select("semester_id")
      .eq("id", existing.offering_id)
      .maybeSingle();
    if (offering?.semester_id) {
      await supabase.rpc("recompute_semester_gpa", {
        _student_id: existing.student_id,
        _semester_id: offering.semester_id,
      });
    }
    await supabase.rpc("recompute_student_cgpa", { _student_id: existing.student_id });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: userId,
      action: "result.manual_edit",
      entity: "results",
      entity_id: data.result_id,
      metadata: {
        ca_score: data.ca_score,
        exam_score: data.exam_score,
        status_code: data.status_code,
        note: data.note ?? null,
      },
    });

    return { ok: true, total_score: total };
  });
