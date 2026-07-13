import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { listUsers, grantRole, revokeRole, type AppRole } from "@/lib/admin.functions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, UserPlus, X } from "lucide-react";

const ROLES: AppRole[] = ["super_admin","ict_admin","registry","bursary","dean","hod","lecturer","student","applicant"];

export const Route = createFileRoute("/_authenticated/users")({
  component: UsersPage,
});

function UsersPage() {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<AppRole | "all">("all");
  const list = useServerFn(listUsers);
  const grant = useServerFn(grantRole);
  const revoke = useServerFn(revokeRole);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "users", search, roleFilter],
    queryFn: () => list({ data: { search, role: roleFilter === "all" ? undefined : roleFilter, limit: 100 } }),
    staleTime: 15_000,
  });

  const grantMut = useMutation({
    mutationFn: (v: { user_id: string; role: AppRole }) => grant({ data: v }),
    onSuccess: () => { toast.success("Role granted"); qc.invalidateQueries({ queryKey: ["admin","users"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const revokeMut = useMutation({
    mutationFn: (v: { user_id: string; role: AppRole }) => revoke({ data: v }),
    onSuccess: () => { toast.success("Role revoked"); qc.invalidateQueries({ queryKey: ["admin","users"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl text-primary">Users &amp; Roles</h2>
        <p className="text-sm text-muted-foreground">Search users and assign portal roles. Only super admins and ICT admins can modify roles.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-lg">Directory</CardTitle>
          <CardDescription>All registered accounts (profiles).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search name or email…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as AppRole | "all")}>
              <SelectTrigger className="md:w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                {ROLES.map((r) => <SelectItem key={r} value={r}>{r.replace("_"," ")}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Current roles</TableHead>
                  <TableHead className="w-72">Grant role</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}><TableCell colSpan={4}><Skeleton className="h-8" /></TableCell></TableRow>
                  ))
                ) : (data ?? []).length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No users match.</TableCell></TableRow>
                ) : (
                  (data ?? []).map((u) => (
                    <UserRow
                      key={u.id}
                      user={u}
                      onGrant={(role) => grantMut.mutate({ user_id: u.id, role })}
                      onRevoke={(role) => revokeMut.mutate({ user_id: u.id, role })}
                      busy={grantMut.isPending || revokeMut.isPending}
                    />
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function UserRow({
  user, onGrant, onRevoke, busy,
}: {
  user: { id: string; email: string; full_name: string | null; roles: AppRole[] };
  onGrant: (r: AppRole) => void;
  onRevoke: (r: AppRole) => void;
  busy: boolean;
}) {
  const [pick, setPick] = useState<AppRole | "">("");
  const available = ROLES.filter((r) => !user.roles.includes(r));
  return (
    <TableRow>
      <TableCell className="font-medium">{user.full_name ?? <span className="text-muted-foreground">—</span>}</TableCell>
      <TableCell className="text-sm text-muted-foreground">{user.email}</TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {user.roles.length === 0 && <span className="text-xs text-muted-foreground">None</span>}
          {user.roles.map((r) => (
            <Badge key={r} variant="secondary" className="gap-1">
              {r.replace("_"," ")}
              <button
                onClick={() => onRevoke(r)}
                disabled={busy}
                className="hover:text-destructive"
                aria-label={`Revoke ${r}`}
              ><X className="h-3 w-3" /></button>
            </Badge>
          ))}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex gap-2">
          <Select value={pick} onValueChange={(v) => setPick(v as AppRole)}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Select role" /></SelectTrigger>
            <SelectContent>
              {available.length === 0
                ? <SelectItem value="none" disabled>All roles assigned</SelectItem>
                : available.map((r) => <SelectItem key={r} value={r}>{r.replace("_"," ")}</SelectItem>)
              }
            </SelectContent>
          </Select>
          <Button size="sm" disabled={!pick || busy} onClick={() => { if (pick) { onGrant(pick); setPick(""); } }}>
            <UserPlus className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
