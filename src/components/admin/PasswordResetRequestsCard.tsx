import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { listResetRequests, resolveResetRequest, adminResetUserPassword } from "@/lib/password-reset.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { KeyRound } from "lucide-react";

export function PasswordResetRequestsCard() {
  const qc = useQueryClient();
  const list = useServerFn(listResetRequests);
  const resolve = useServerFn(resolveResetRequest);
  const adminReset = useServerFn(adminResetUserPassword);
  const [email, setEmail] = useState("");
  const [issued, setIssued] = useState<{ email: string; password: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "reset-requests"],
    queryFn: () => list({ data: { status: "pending" as const } }),
    staleTime: 15_000,
  });

  const resolveMut = useMutation({
    mutationFn: (v: { id: string; action: "approve" | "reject" }) => resolve({ data: v }),
    onSuccess: (res) => {
      toast.success(
        res.temporary_password
          ? `Reset done — the student signs in with "${res.temporary_password}" and must set a new password.`
          : "Request rejected",
      );
      qc.invalidateQueries({ queryKey: ["admin", "reset-requests"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const emailMut = useMutation({
    mutationFn: (v: { email: string }) => adminReset({ data: v }),
    onSuccess: (res) => {
      setIssued({ email: res.email, password: res.temporary_password });
      setEmail("");
      toast.success("Temporary password issued");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-lg flex items-center gap-2">
          <KeyRound className="h-4 w-4" /> Password resets
        </CardTitle>
        <CardDescription>
          Approve student reset requests, or issue a one-time temporary password for a staff account.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Matric number</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Requested</TableHead>
                <TableHead className="w-56">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={4}><Skeleton className="h-8" /></TableCell></TableRow>
              ) : (data ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    No pending reset requests.
                  </TableCell>
                </TableRow>
              ) : (
                (data ?? []).map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.matric_number ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.contact ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(r.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          disabled={resolveMut.isPending}
                          onClick={() => resolveMut.mutate({ id: r.id, action: "approve" })}
                        >
                          Reset password
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={resolveMut.isPending}
                          onClick={() => resolveMut.mutate({ id: r.id, action: "reject" })}
                        >
                          Reject
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <form
          className="flex flex-col md:flex-row gap-3 md:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            if (email.trim()) emailMut.mutate({ email: email.trim() });
          }}
        >
          <div className="flex-1">
            <Label htmlFor="reset-email">Staff / admin account email</Label>
            <Input
              id="reset-email"
              type="email"
              placeholder="name@akcoekano.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={!email.trim() || emailMut.isPending} variant="secondary">
            Issue temporary password
          </Button>
        </form>

        {issued && (
          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            <div className="font-medium">Temporary password for {issued.email}</div>
            <code className="mt-1 block font-mono text-base">{issued.password}</code>
            <p className="text-xs text-muted-foreground mt-2">
              Shown once — share it directly with the account owner. They must change it at next sign-in.
            </p>
            <Button size="sm" variant="ghost" className="mt-2" onClick={() => setIssued(null)}>
              Dismiss
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
