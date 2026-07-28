import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
  head: () => ({ meta: [{ title: "Reset password — AKCOE Portal" }, { name: "robots", content: "noindex" }] }),
});

function ResetPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  useEffect(() => {
    const sub = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });

    (async () => {
      const url = new URL(window.location.href);
      const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
      const errDesc = url.searchParams.get("error_description") ?? hash.get("error_description");
      if (errDesc) {
        setLinkError(errDesc);
        return;
      }

      // Newer recovery links use a PKCE ?code=, older ones a #access_token or ?token_hash.
      const code = url.searchParams.get("code");
      const tokenHash = url.searchParams.get("token_hash");
      try {
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) setLinkError(error.message);
        } else if (tokenHash) {
          const { error } = await supabase.auth.verifyOtp({ type: "recovery", token_hash: tokenHash });
          if (error) setLinkError(error.message);
        }
      } catch (e) {
        setLinkError(e instanceof Error ? e.message : "Could not verify the reset link");
      }

      // Strip tokens from the address bar once consumed.
      if (code || tokenHash || url.hash) {
        window.history.replaceState({}, "", url.pathname);
      }

      const { data } = await supabase.auth.getSession();
      if (data.session) setReady(true);
    })();

    return () => sub.data.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("password") ?? "");
    const confirm = String(fd.get("confirm") ?? "");
    if (password.length < 8) return toast.error("Password must be at least 8 characters");
    if (password !== confirm) return toast.error("Passwords do not match");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setLoading(false);
      return toast.error(error.message);
    }
    // Clear any forced-change flag so the portal doesn't ask again.
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user.id;
    if (uid) {
      await supabase.from("profiles").update({ must_change_password: false }).eq("id", uid);
    }
    setLoading(false);
    toast.success("Password updated. Redirecting…");
    setTimeout(() => { window.location.href = "/dashboard"; }, 700);
  }


  return (
    <div className="min-h-screen grid place-items-center bg-background p-6">
      <Card className="w-full max-w-md shadow-elegant">
        <CardHeader>
          <h1 className="font-serif text-2xl font-semibold leading-none tracking-tight">Reset Your Password</h1>


          <CardDescription>
            {ready ? "Choose a new password for your AKCOE account." : "Verifying reset link…"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {ready ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="password">New password</Label>
                <Input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" />
              </div>
              <div>
                <Label htmlFor="confirm">Confirm password</Label>
                <Input id="confirm" name="confirm" type="password" required minLength={8} autoComplete="new-password" />
              </div>
              <Button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update password"}
              </Button>
            </form>
          ) : (
            <div className="text-sm text-muted-foreground">
              If nothing happens, the reset link may have expired.{" "}
              <a href="/auth" className="text-primary hover:underline">Request a new one</a>.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
