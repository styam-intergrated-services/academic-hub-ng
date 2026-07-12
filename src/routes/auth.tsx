import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { z } from "zod";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({ meta: [{ title: "Sign in — AKCOE Portal" }, { name: "robots", content: "noindex" }] }),
});

const emailSchema = z.string().trim().email("Enter a valid email").max(255);
const passwordSchema = z.string().min(8, "At least 8 characters").max(72);

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

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
    if (error) return toast.error(error.message);
    toast.success("Welcome back");
    navigate({ to: "/dashboard" });
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
      options: { emailRedirectTo: window.location.origin, data: { full_name } },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Account created. You can now sign in.");
  }

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
            <CardTitle className="font-serif text-2xl">Welcome</CardTitle>
            <CardDescription>Sign in to your AKCOE account.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin">
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                <TabsTrigger value="signup">Create account</TabsTrigger>
              </TabsList>
              <TabsContent value="signin" className="space-y-4 mt-4">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" required autoComplete="email" /></div>
                  <div><Label htmlFor="password">Password</Label><Input id="password" name="password" type="password" required autoComplete="current-password" /></div>
                  <Button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
                  </Button>
                </form>
              </TabsContent>
              <TabsContent value="signup" className="space-y-4 mt-4">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div><Label htmlFor="full_name">Full name</Label><Input id="full_name" name="full_name" required /></div>
                  <div><Label htmlFor="email2">Email</Label><Input id="email2" name="email" type="email" required autoComplete="email" /></div>
                  <div><Label htmlFor="password2">Password</Label><Input id="password2" name="password" type="password" required minLength={8} autoComplete="new-password" /></div>
                  <Button type="submit" disabled={loading} className="w-full bg-primary text-primary-foreground">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create account"}
                  </Button>
                  <p className="text-xs text-muted-foreground">New accounts start as applicants. An administrator assigns your role.</p>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
