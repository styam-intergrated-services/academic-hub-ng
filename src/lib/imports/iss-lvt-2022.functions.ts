import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import issLvtPayload from "./iss-lvt-2022.data.json";

type IssLvtPayload = {
  session: string;
  programme_name: string;
  department: string;
  entry_year: number;
  contacts: { contact_no: number; level_code: string }[];
  courses: { code: string; credit_units: number; category: string; contacts: number[] }[];
  students: { matric_number: string; name: string; results: unknown[] }[];
};

const RunSchema = z.object({ dry_run: z.boolean() });

export const runIssLvt2022Import = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => RunSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    // Load the bundled JSON at request time so it doesn't cross the client bundle.
    const payload = (await import("./iss-lvt-2022.data.json", { with: { type: "json" } })).default;
    const { data: result, error } = await supabase.rpc("admin_import_iss_lvt_2022", {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      _payload: payload as any,
      _dry_run: data.dry_run,
    });
    if (error) throw new Error(error.message);
    return result as {
      dry_run: boolean;
      session_id: string;
      semesters_created: number;
      courses_created: number;
      offerings_created: number;
      students_new: number;
      students_existing: number;
      registrations_created: number;
      results_upserted: number;
    };
  });

export const getIssLvt2022Summary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const payload = (await import("./iss-lvt-2022.data.json", { with: { type: "json" } })).default as {
      session: string;
      programme_name: string;
      department: string;
      entry_year: number;
      contacts: { contact_no: number; level_code: string }[];
      courses: { code: string; credit_units: number; category: string; contacts: number[] }[];
      students: { matric_number: string; name: string; results: unknown[] }[];
    };
    return {
      session: payload.session,
      programme_name: payload.programme_name,
      department: payload.department,
      entry_year: payload.entry_year,
      contacts: payload.contacts,
      course_count: payload.courses.length,
      student_count: payload.students.length,
      result_count: payload.students.reduce((acc, s) => acc + s.results.length, 0),
      sample_students: payload.students.slice(0, 5).map((s) => ({
        matric_number: s.matric_number,
        name: s.name,
        result_count: s.results.length,
      })),
      sample_courses: payload.courses.slice(0, 20),
    };
  });
