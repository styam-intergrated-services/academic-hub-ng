import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyProfile, updateMyProfile } from "@/lib/profile.functions";
import { getPortalUser } from "@/lib/portal.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Camera, Save, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
  head: () => ({
    meta: [
      { title: "My Profile · AKCOE Portal" },
      { name: "description", content: "Update your contact details, address and profile picture on the AKCOE college portal." },
    ],
  }),
});

function ProfilePage() {
  const qc = useQueryClient();
  const profileFn = useServerFn(getMyProfile);
  const updateFn = useServerFn(updateMyProfile);
  const userFn = useServerFn(getPortalUser);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["portal", "my-profile"],
    queryFn: () => profileFn(),
    staleTime: 30_000,
  });
  const { data: portalUser } = useQuery({
    queryKey: ["portal", "user"],
    queryFn: () => userFn(),
    staleTime: 60_000,
  });

  // Private bucket → resolve a short-lived signed URL for display.
  useEffect(() => {
    let active = true;
    const path = profile?.avatar_url;
    if (!path) { setAvatarSrc(null); return; }
    if (path.startsWith("http")) { setAvatarSrc(path); return; }
    supabase.storage.from("avatars").createSignedUrl(path, 3600).then(({ data }) => {
      if (active) setAvatarSrc(data?.signedUrl ?? null);
    });
    return () => { active = false; };
  }, [profile?.avatar_url]);

  async function handleAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Please choose an image file");
    if (file.size > 3 * 1024 * 1024) return toast.error("Image must be smaller than 3MB");

    setUploading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("You are signed out");
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `${uid}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      await updateFn({
        data: {
          full_name: profile?.full_name ?? portalUser?.full_name ?? "Portal user",
          phone: profile?.phone ?? null,
          date_of_birth: profile?.date_of_birth ?? null,
          gender: profile?.gender ?? null,
          address: profile?.address ?? null,
          state_of_origin: profile?.state_of_origin ?? null,
          lga: profile?.lga ?? null,
          avatar_url: path,
        },
      });
      await qc.invalidateQueries({ queryKey: ["portal"] });
      toast.success("Profile picture updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      full_name: String(fd.get("full_name") ?? "").trim(),
      phone: String(fd.get("phone") ?? "").trim(),
      date_of_birth: String(fd.get("date_of_birth") ?? "").trim(),
      gender: String(fd.get("gender") ?? "").trim(),
      address: String(fd.get("address") ?? "").trim(),
      state_of_origin: String(fd.get("state_of_origin") ?? "").trim(),
      lga: String(fd.get("lga") ?? "").trim(),
    };
    if (payload.full_name.length < 2) return toast.error("Enter your full name");
    setSaving(true);
    try {
      await updateFn({ data: payload });
      await qc.invalidateQueries({ queryKey: ["portal"] });
      toast.success("Profile saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save profile");
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const password = String(fd.get("password") ?? "");
    const confirm = String(fd.get("confirm") ?? "");
    if (password.length < 8) return toast.error("Password must be at least 8 characters");
    if (password !== confirm) return toast.error("Passwords do not match");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast.error(error.message);
    form.reset();
    toast.success("Password updated. Store it somewhere safe.");
  }

  const initials = (profile?.full_name ?? profile?.email ?? "?").slice(0, 2).toUpperCase();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Card className="overflow-hidden">
        <div className="bg-hero-gradient p-6 text-white">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative">
              <Avatar className="size-20 border-2 border-white/30">
                {avatarSrc ? <AvatarImage src={avatarSrc} alt="Profile picture" /> : null}
                <AvatarFallback className="bg-white/15 text-lg text-white">{initials}</AvatarFallback>
              </Avatar>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                aria-label="Change profile picture"
                className="absolute -bottom-1 -right-1 grid size-8 place-items-center rounded-full bg-background text-foreground shadow"
              >
                {uploading ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatar} />
            </div>
            <div className="min-w-0">
              <h1 className="font-serif text-2xl font-bold">{profile?.full_name ?? "My profile"}</h1>
              <p className="text-sm text-white/80">{profile?.email}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(portalUser?.roles ?? []).map((r) => (
                  <Badge key={r} variant="secondary" className="border-white/20 bg-white/10 capitalize text-white">
                    {r.replace("_", " ")}
                  </Badge>
                ))}
                {portalUser?.student ? (
                  <Badge variant="secondary" className="border-white/20 bg-white/10 font-mono text-white">
                    {portalUser.student.matric_number}
                  </Badge>
                ) : null}
                {profile?.staff_code ? (
                  <Badge variant="secondary" className="border-white/20 bg-white/10 text-white">
                    Staff {profile.staff_code}
                  </Badge>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif">Personal details</CardTitle>
          <CardDescription>Keep your contact information up to date — Registry uses it for official correspondence.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-64" />
          ) : (
            <form onSubmit={handleSave} className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="full_name">Full name</Label>
                <Input id="full_name" name="full_name" defaultValue={profile?.full_name ?? ""} required maxLength={120} />
              </div>
              <div>
                <Label htmlFor="phone">Phone number</Label>
                <Input id="phone" name="phone" type="tel" inputMode="tel" defaultValue={profile?.phone ?? ""} maxLength={20} placeholder="08012345678" />
              </div>
              <div>
                <Label htmlFor="date_of_birth">Date of birth</Label>
                <Input id="date_of_birth" name="date_of_birth" type="date" defaultValue={profile?.date_of_birth ?? ""} />
              </div>
              <div>
                <Label htmlFor="gender">Gender</Label>
                <select
                  id="gender"
                  name="gender"
                  defaultValue={profile?.gender ?? ""}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Prefer not to say</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>
              <div>
                <Label htmlFor="state_of_origin">State of origin</Label>
                <Input id="state_of_origin" name="state_of_origin" defaultValue={profile?.state_of_origin ?? ""} maxLength={80} />
              </div>
              <div>
                <Label htmlFor="lga">Local government area</Label>
                <Input id="lga" name="lga" defaultValue={profile?.lga ?? ""} maxLength={80} />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="address">Contact address</Label>
                <Textarea id="address" name="address" defaultValue={profile?.address ?? ""} maxLength={300} rows={3} />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={saving}>
                  {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
                  Save changes
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-serif">
            <ShieldCheck className="size-4 text-primary" /> Security
          </CardTitle>
          <CardDescription>Use a strong password — at least 8 characters.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="password">New password</Label>
              <Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
            </div>
            <div>
              <Label htmlFor="confirm">Confirm new password</Label>
              <Input id="confirm" name="confirm" type="password" required minLength={8} autoComplete="new-password" />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={loading} variant="secondary">
                {loading ? <Loader2 className="size-4 animate-spin" /> : "Update password"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
