import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import akceLogo from "@/assets/akce-logo.asset.json";

type OAuthNs = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: any }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: any }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: any }>;
};
const oauth = () => (supabase.auth as unknown as { oauth: OAuthNs }).oauth;

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const next = location.pathname + location.searchStr;
      throw redirect({ to: "/auth", search: { next } });
    }
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauth().getAuthorizationDetails(authorizationId);
    if (error) throw error;
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <div className="min-h-screen grid place-items-center p-6">
      <Card className="max-w-md">
        <CardHeader><CardTitle>Authorization error</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{String((error as Error)?.message ?? error)}</p>
        </CardContent>
      </Card>
    </div>
  ),
});

function Consent() {
  const details = Route.useLoaderData() as any;
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState<"approve" | "deny" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(approve: boolean) {
    setError(null);
    setBusy(approve ? "approve" : "deny");
    const { data, error } = approve
      ? await oauth().approveAuthorization(authorization_id)
      : await oauth().denyAuthorization(authorization_id);
    if (error) { setBusy(null); setError(error.message ?? String(error)); return; }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) { setBusy(null); setError("No redirect returned by the authorization server."); return; }
    window.location.href = target;
  }

  const clientName = details?.client?.name ?? details?.client?.client_name ?? "an external client";
  const scopes: string[] = details?.scopes ?? details?.requested_scopes ?? [];

  return (
    <div className="min-h-screen grid place-items-center p-6 bg-muted/30">
      <Card className="max-w-lg w-full shadow-elegant">
        <CardHeader className="text-center">
          <img src={akceLogo.url} alt="AKCOE" className="h-14 w-14 rounded-md object-cover bg-white p-0.5 mx-auto mb-2" />
          <CardTitle className="font-serif text-2xl">Connect {clientName} to AKCOE Portal</CardTitle>
          <CardDescription>This lets {clientName} use the AKCOE Portal as you.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="text-sm space-y-2 border rounded-md p-4 bg-background">
            <li>• Read your profile, roles, and (if you are a student) matric number, programme, level, and CGPA.</li>
            <li>• Read your own course registrations, published results, and notifications.</li>
            <li>• Actions run under your account and remain bound by AKCOE portal role-based access rules.</li>
          </ul>
          {scopes.length > 0 && (
            <div className="text-xs text-muted-foreground">Requested scopes: {scopes.join(", ")}</div>
          )}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-3 justify-end">
            <Button variant="outline" disabled={busy !== null} onClick={() => decide(false)}>
              {busy === "deny" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Deny"}
            </Button>
            <Button className="bg-primary text-primary-foreground" disabled={busy !== null} onClick={() => decide(true)}>
              {busy === "approve" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Approve & connect"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
