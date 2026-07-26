import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { createStaffAccounts, listAcademicStructure, type AppRole } from "@/lib/admin.functions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus } from "lucide-react";

const STAFF_ROLES: AppRole[] = [
  "provost", "registry", "bursary", "dean", "hod", "lecturer", "examination_officer", "ict_admin",
];

export function CreateStaffAccountCard() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [staffCode, setStaffCode] = useState("");
  const [role, setRole] = useState<AppRole | "none">("none");
  const [departmentId, setDepartmentId] = useState<string>("none");

  const create = useServerFn(createStaffAccounts);
  const structure = useServerFn(listAcademicStructure);
  const qc = useQueryClient();

  const { data: struct } = useQuery({
    queryKey: ["admin", "structure", "departments"],
    queryFn: () => structure(),
    staleTime: 60_000,
  });
  const departments: Array<{ id: string; name: string }> =
    (struct as { departments?: Array<{ id: string; name: string }> } | undefined)?.departments ?? [];

  const mut = useMutation({
    mutationFn: () =>
      create({
        data: {
          staff: [{
            full_name: fullName.trim(),
            email: email.trim(),
            phone: phone.trim(),
            staff_code: staffCode.trim() || undefined,
            roles: role === "none" ? [] : [role],
            department_id: departmentId === "none" ? undefined : departmentId,
          }],
        },
      }),
    onSuccess: (res) => {
      const r = res.results[0];
      if (r?.error) { toast.error(r.error); return; }
      toast.success(`Account ready for ${email} — temporary password is their phone number.`);
      setFullName(""); setEmail(""); setPhone(""); setStaffCode("");
      setRole("none"); setDepartmentId("none");
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSubmit = fullName.trim().length > 1 && /\S+@\S+\.\S+/.test(email) && phone.trim().length >= 6;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-lg flex items-center gap-2">
          <UserPlus className="h-4 w-4" /> Create staff account
        </CardTitle>
        <CardDescription>
          The staff member signs in with their email and their phone number as a temporary password, then must set a new
          password before they can use the portal.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="staff-name">Full name</Label>
          <Input id="staff-name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Dr. Jane Doe" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="staff-email">Email (login)</Label>
          <Input id="staff-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="staff-phone">Phone (temporary password)</Label>
          <Input id="staff-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08012345678" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="staff-code">Staff code (optional)</Label>
          <Input id="staff-code" value={staffCode} onChange={(e) => setStaffCode(e.target.value)} placeholder="AKCOE12" />
        </div>
        <div className="space-y-1.5">
          <Label>Role</Label>
          <Select value={role} onValueChange={(v) => setRole(v as AppRole | "none")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No role yet</SelectItem>
              {STAFF_ROLES.map((r) => <SelectItem key={r} value={r}>{r.replace("_", " ")}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Head of department for</Label>
          <Select value={departmentId} onValueChange={setDepartmentId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No department link</SelectItem>
              {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="md:col-span-2">
          <Button onClick={() => mut.mutate()} disabled={!canSubmit || mut.isPending}>
            {mut.isPending ? "Creating…" : "Create account"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
