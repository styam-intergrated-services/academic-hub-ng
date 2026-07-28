import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { matricToSyntheticEmail, normalizeMatric } from "@/lib/matric";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({
    next: typeof s.next === "string" ? s.next : undefined,
  }),
  component: AuthPage,
  head: () => ({ meta: [{ title: "Sign in — AKCOE Portal" }, { name: "robots", content: "noindex" }] }),
});

function safeNext(next: string | undefined): string {
  if (!next) return "/dashboard";
  if (!next.startsWith("/") || next.startsWith("//")) return "/dashboard";
  return next;
}

const emailSchema = z.string().trim().email("Enter a valid email").max(255);
const passwordSchema = z.string().min(8, "At least 8 characters").max(72);

/** Turn raw auth errors into something a student or staff member can act on. */
function friendlyAuthError(message: string | undefined, mode: "email" | "matric"): string {
  const m = (message ?? "").toLowerCase();
  if (m.includes("invalid login credentials")) {
    return mode === "matric"
      ? "Incorrect matric number or password. First time signing in? Use your year of entry (e.g. 2022)."
      : "Incorrect email or password. Please check and try again.";
  }
  if (m.includes("email not confirmed")) {
    return "This account hasn't been confirmed yet. Check your inbox for the confirmation link.";
  }
  if (m.includes("rate limit") || m.includes("too many")) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  if (m.includes("failed to fetch") || m.includes("network")) {
    return "Network problem — check your connection and try again.";
  }
  return message || "Sign in failed. Please try again.";
}

function AuthPage() {
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  const dest = safeNext(next);
  const [loading, setLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [awaitingVerify, setAwaitingVerify] = useState<string | null>(null);
  // The page is server-rendered: until React hydrates, a tap on a submit button
  // would fall through to a native form GET (silent failure + password in the URL).
  const [hydrated, setHydrated] = useState(false);
  const [prefillEmail, setPrefillEmail] = useState("");

  useEffect(() => {
    setHydrated(true);

    // Clean up credentials left in the URL by a pre-hydration native submit.
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has("email") || url.searchParams.has("password")) {
        setPrefillEmail(url.searchParams.get("email") ?? "");
        url.searchParams.delete("email");
        url.searchParams.delete("password");
        url.searchParams.delete("matric");
        url.searchParams.delete("full_name");
        window.history.replaceState({}, "", url.pathname + url.search + url.hash);
      }
    } catch {
      /* ignore */
    }

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) window.location.href = dest;
    });
  }, [dest]);

  const busy = loading || !hydrated;

  async function handleSignIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "");
    const password = String(fd.get("password") ?? "");
    try {
      emailSchema.parse(email); passwordSchema.parse(password);
    } catch (err: any) {
      toast.error(err.issues?.[0]?.message ?? "Invalid input");
      setLoading(false); return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(friendlyAuthError(error.message, "email"));
    toast.success("Welcome back");
    window.location.href = dest;
  }

  async function handleSignUp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "");
    const password = String(fd.get("password") ?? "");
    const full_name = String(fd.get("full_name") ?? "");
    try {
      emailSchema.parse(email); passwordSchema.parse(password);
      z.string().trim().min(2).max(120).parse(full_name);
    } catch (err: any) {
      toast.error(err.issues?.[0]?.message ?? "Invalid input");
      setLoading(false); return;
    }
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: window.location.origin + dest, data: { full_name } },
    });
    setLoading(false);
    if (error) return toast.error(friendlyAuthError(error.message, "email"));
    setAwaitingVerify(email);
    toast.success("Check your email to confirm your account.");
  }
  async function handleMatricSignIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const matric = normalizeMatric(String(fd.get("matric") ?? ""));
    const password = String(fd.get("password") ?? "");
    if (!matric || !password) {
      setLoading(false);
      return toast.error("Enter your matric number and password");
    }
    const syntheticEmail = matricToSyntheticEmail(matric);

    // Try normal sign-in first (already activated).
    let attempt = await supabase.auth.signInWithPassword({ email: syntheticEmail, password });
    if (attempt.error) {
      // Fall back to activation: entry_year as temporary password creates the account.
      try {
        const resp = await fetch("/api/public/matric-login-init", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ matric, password }),
        });
        const payload = (await resp.json().catch(() => ({}))) as { error?: string; signin_password?: string };
        if (!resp.ok) {
          setLoading(false);
          return toast.error(payload?.error ?? "Invalid matric number or password");
        }
        attempt = await supabase.auth.signInWithPassword({
          email: syntheticEmail,
          password: payload.signin_password ?? password,
        });
      } catch {
        setLoading(false);
        return toast.error("Could not activate your account. Please try again.");
      }
    }
    setLoading(false);
    if (attempt.error) return toast.error(friendlyAuthError(attempt.error.message, "matric"));
    toast.success("Welcome");
    // PortalShell redirects to /first-login when default_password_changed is false.
    window.location.href = dest;
  }


  async function handleForgot(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "");
    try { emailSchema.parse(email); }
    catch (err: any) {
      toast.error(err.issues?.[0]?.message ?? "Invalid email");
      setLoading(false); return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/reset-password",
    });
    setLoading(false);
    if (error) return toast.error(friendlyAuthError(error.message, "email"));
    toast.success("If an account exists, a reset link has been sent.");
    setForgotOpen(false);
  }

  /** Students sign in with a matric number (no mailbox) — Registry approves the reset. */
  async function handleForgotMatric(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const matric = normalizeMatric(String(fd.get("matric") ?? ""));
    const contact = String(fd.get("contact") ?? "");
    if (!matric) { setLoading(false); return toast.error("Enter your matric number"); }
    try {
      const resp = await fetch("/api/public/password-reset-request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ matric, contact }),
      });
      setLoading(false);
      if (!resp.ok) return toast.error("Could not send your request. Please try again.");
      toast.success("Request sent. Registry will reset your password — then sign in with your year of entry.");
      setForgotOpen(false);
    } catch {
      setLoading(false);
      toast.error("Network problem — check your connection and try again.");
    }
  }


  void navigate;

  return (
    <div className="min-h-screen grid md:grid-cols-2">
      <div className="bg-hero-gradient text-white p-10 hidden md:flex flex-col justify-between">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-md bg-white/10 border border-white/20 grid place-items-center font-serif font-bold">AK</div>
          <div>
            <div className="font-serif font-bold">AKCOE Portal</div>
            <div className="text-xs text-white/70 uppercase tracking-widest">Aminu Kano College of Education</div>
          </div>
        </div>
        <div>
          <h2 className="font-serif text-4xl font-bold">Empowering Nigeria's teachers.</h2>
          <p className="mt-4 text-white/80 max-w-md">Manage your academic journey with a secure, modern portal built for a scalable college experience.</p>
        </div>
        <div className="text-xs text-white/60">© {new Date().getFullYear()} AKCOE</div>
      </div>

      <div className="flex items-center justify-center p-6 md:p-10 bg-background">
        <Card className="w-full max-w-md shadow-elegant">
          <CardHeader>
            <h1 className="font-serif text-2xl font-semibold leading-none tracking-tight">Sign in to AKCOE Portal</h1>


            <CardDescription>Sign in to your AKCOE account.</CardDescription>
          </CardHeader>
          <CardContent>
            {forgotOpen ? (
              <div className="space-y-4">
                <div>
                  <p className="font-medium text-sm">Forgot your password?</p>
                  <p className="text-xs text-muted-foreground">
                    Staff and admins reset by email. Students who sign in with a matric number request a reset from Registry.
                  </p>
                </div>
                <Tabs defaultValue="email">
                  <TabsList className="grid grid-cols-2 w-full">
                    <TabsTrigger value="email">By email</TabsTrigger>
                    <TabsTrigger value="matric">By matric no.</TabsTrigger>
                  </TabsList>
                  <TabsContent value="email" className="mt-4">
                    <form onSubmit={handleForgot} method="post" className="space-y-4">
                      <div>
                        <Label htmlFor="forgot-email">Email</Label>
                        <Input id="forgot-email" name="email" type="email" required autoComplete="email" />
                        <p className="text-xs text-muted-foreground mt-2">We'll email you a link to set a new password.</p>
                      </div>
                      <Button type="submit" disabled={busy} className="w-full bg-primary text-primary-foreground">
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : !hydrated ? "Loading…" : "Send reset link"}
                      </Button>
                    </form>
                  </TabsContent>
                  <TabsContent value="matric" className="mt-4">
                    <form onSubmit={handleForgotMatric} method="post" className="space-y-4">
                      <div>
                        <Label htmlFor="forgot-matric">Matric number</Label>
                        <Input id="forgot-matric" name="matric" required placeholder="AKCOE/2022/0001" autoCapitalize="characters" />
                      </div>
                      <div>
                        <Label htmlFor="forgot-contact">Phone or email (optional)</Label>
                        <Input id="forgot-contact" name="contact" placeholder="So Registry can reach you" />
                      </div>
                      <Button type="submit" disabled={busy} className="w-full bg-primary text-primary-foreground">
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : !hydrated ? "Loading…" : "Request password reset"}
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        Once approved, sign in with your <span className="font-medium">year of entry</span> and you'll be asked to set a new password.
                      </p>
                    </form>
                  </TabsContent>
                </Tabs>
                <Button type="button" variant="ghost" className="w-full" onClick={() => setForgotOpen(false)}>Back to sign in</Button>
              </div>

            ) : awaitingVerify ? (
              <div className="space-y-3 text-sm">
                <p className="font-medium">Verify your email</p>
                <p className="text-muted-foreground">
                  We sent a confirmation link to <span className="font-medium text-foreground">{awaitingVerify}</span>.
                  Click the link in that email to activate your account — you'll be signed in and taken to your dashboard.
                </p>
                <Button variant="ghost" onClick={() => setAwaitingVerify(null)}>Back to sign in</Button>
              </div>
            ) : (
              <Tabs defaultValue="signin">
                <TabsList className="grid grid-cols-3 w-full">
                  <TabsTrigger value="signin">Email</TabsTrigger>
                  <TabsTrigger value="matric">Matric No.</TabsTrigger>
                  <TabsTrigger value="signup">Sign up</TabsTrigger>
                </TabsList>
                <TabsContent value="signin" className="space-y-4 mt-4">
                  <form onSubmit={handleSignIn} method="post" className="space-y-4">
                    <div><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" required autoComplete="email" defaultValue={prefillEmail} key={prefillEmail} /></div>
                    <div><Label htmlFor="password">Password</Label><Input id="password" name="password" type="password" required autoComplete="current-password" /></div>
                    <Button type="submit" disabled={busy} className="w-full bg-primary text-primary-foreground">
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : !hydrated ? "Loading…" : "Sign in"}
                    </Button>
                    <button
                      type="button"
                      onClick={() => setForgotOpen(true)}
                      className="text-xs text-primary hover:underline block w-full text-center"
                    >
                      Forgot password?
                    </button>
                  </form>
                </TabsContent>
                <TabsContent value="matric" className="space-y-4 mt-4">
                  <form onSubmit={handleMatricSignIn} method="post" className="space-y-4">
                    <div>
                      <Label htmlFor="matric">Matric number</Label>
                      <Input id="matric" name="matric" required placeholder="AKCOE/2022/0001" autoCapitalize="characters" />
                    </div>
                    <div>
                      <Label htmlFor="matric-password">Password</Label>
                      <Input id="matric-password" name="password" type="password" required autoComplete="current-password" />
                    </div>
                    <Button type="submit" disabled={busy} className="w-full bg-primary text-primary-foreground">
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : !hydrated ? "Loading…" : "Sign in with matric"}
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      First time signing in? Use your <span className="font-medium">year of entry</span> (e.g. 2022) as your temporary password.
                      You'll be asked to set a new password right after.
                    </p>
                  </form>
                </TabsContent>
                <TabsContent value="signup" className="space-y-4 mt-4">
                  <form onSubmit={handleSignUp} method="post" className="space-y-4">
                    <div><Label htmlFor="full_name">Full name</Label><Input id="full_name" name="full_name" required /></div>
                    <div><Label htmlFor="email2">Email</Label><Input id="email2" name="email" type="email" required autoComplete="email" /></div>
                    <div><Label htmlFor="password2">Password</Label><Input id="password2" name="password" type="password" required minLength={8} autoComplete="new-password" /></div>
                    <Button type="submit" disabled={busy} className="w-full bg-primary text-primary-foreground">
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : !hydrated ? "Loading…" : "Create account"}
                    </Button>
                    <p className="text-xs text-muted-foreground">You'll receive an email to confirm your address before you can sign in.</p>
                  </form>
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
