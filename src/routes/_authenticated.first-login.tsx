import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { markDefaultPasswordChanged, getPortalUser } from "@/lib/portal.functions";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/first-login")({
  component: FirstLoginPage,
  head: () => ({ meta: [{ title: "Set your password — AKCOE Portal" }, { name: "robots", content: "noindex" }] }),
});

function FirstLoginPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const getUser = useServerFn(getPortalUser);
  const markChanged = useServerFn(markDefaultPasswordChanged);
  const [loading, setLoading] = useState(false);
  const { data: user } = useQuery({
    queryKey: ["portal", "user"],
    queryFn: () => getUser(),
    staleTime: 60_000,
  });
  const mandatory = !!user?.must_change_password;


  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("password") ?? "");
    const confirm = String(fd.get("confirm") ?? "");
    if (password.length < 8) return toast.error("Password must be at least 8 characters");
    if (password !== confirm) return toast.error("Passwords do not match");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) { setLoading(false); return toast.error(error.message); }
    try {
      await markChanged();
    } catch (err: any) {
      setLoading(false);
      return toast.error(err?.message ?? "Failed to save");
    }
    await qc.invalidateQueries({ queryKey: ["portal", "user"] });
    setLoading(false);
    toast.success("Password updated. Welcome to your portal.");
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="min-h-[70vh] grid place-items-center p-4">
      <Card className="w-full max-w-md shadow-elegant">
        <CardHeader>
          <CardTitle className="font-serif text-2xl">Set your new password</CardTitle>
          <CardDescription>
            {mandatory
              ? "You signed in with the temporary password issued by the College (your phone number). Choose a personal password to continue — you'll be prompted again each time you sign in until you do."
              : "You signed in with your temporary password (your year of entry). Choose a personal password to continue."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label htmlFor="password">New password</Label>
              <Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
            </div>
            <div>
              <Label htmlFor="confirm">Confirm new password</Label>
              <Input id="confirm" name="confirm" type="password" required minLength={8} autoComplete="new-password" />
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save and continue"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              disabled={loading}
              onClick={() => {
                sessionStorage.setItem("akcoe:skip-password-change", "1");
                toast.info("You can change your password anytime from your profile.");
                navigate({ to: "/dashboard", replace: true });
              }}
            >
              Skip for now
            </Button>

          </form>
        </CardContent>
      </Card>
    </div>
  );
}
