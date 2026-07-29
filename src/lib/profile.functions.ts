import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface MyProfile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  date_of_birth: string | null;
  gender: string | null;
  address: string | null;
  state_of_origin: string | null;
  lga: string | null;
  staff_code: string | null;
}

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyProfile | null> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("profiles")
      .select("id,email,full_name,phone,avatar_url,date_of_birth,gender,address,state_of_origin,lga,staff_code")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw error;
    return (data as MyProfile) ?? null;
  });

const profileSchema = z.object({
  full_name: z.string().trim().min(2, "Enter your full name").max(120),
  phone: z.string().trim().max(20).optional().nullable(),
  date_of_birth: z.string().trim().max(10).optional().nullable(),
  gender: z.string().trim().max(20).optional().nullable(),
  address: z.string().trim().max(300).optional().nullable(),
  state_of_origin: z.string().trim().max(80).optional().nullable(),
  lga: z.string().trim().max(80).optional().nullable(),
  avatar_url: z.string().trim().max(500).optional().nullable(),
});

export type ProfileInput = z.infer<typeof profileSchema>;

export const updateMyProfile = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => profileSchema.parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const clean = (v?: string | null) => (v && v.length > 0 ? v : null);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: data.full_name,
        phone: clean(data.phone),
        date_of_birth: clean(data.date_of_birth),
        gender: clean(data.gender),
        address: clean(data.address),
        state_of_origin: clean(data.state_of_origin),
        lga: clean(data.lga),
        ...(data.avatar_url !== undefined ? { avatar_url: clean(data.avatar_url) } : {}),
      })
      .eq("id", userId);
    if (error) throw error;
    return { ok: true };
  });
