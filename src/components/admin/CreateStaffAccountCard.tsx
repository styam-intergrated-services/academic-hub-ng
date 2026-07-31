import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { createStaffAccounts, listAcademicStructure, type AppRole } from "@/lib/admin.functions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, ArrowLeft, ArrowRight, Check } from "lucide-react";

const STAFF_ROLES: AppRole[] = [
  "provost", "registry", "bursary", "dean", "hod", "lecturer", "examination_officer", "ict_admin",
];

const STEPS = ["Staff details", "Roles & department", "Review"] as const;

export function CreateStaffAccountCard() {
  const [step, setStep] = useState(0);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [staffCode, setStaffCode] = useState("");
  const [roles, setRoles] = useState<AppRole[]>([]);
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
  const departmentName = departments.find((d) => d.id === departmentId)?.name ?? null;

  function reset() {
    setFullName(""); setEmail(""); setPhone(""); setStaffCode("");
    setRoles([]); setDepartmentId("none"); setStep(0);
  }

  const mut = useMutation({
    mutationFn: () =>
      create({
        data: {
          staff: [{
            full_name: fullName.trim(),
            email: email.trim(),
            phone: phone.trim(),
            staff_code: staffCode.trim() || undefined,
            roles,
            department_id: departmentId === "none" ? undefined : departmentId,
          }],
        },
      }),
    onSuccess: (res) => {
      const r = res.results[0];
      if (r?.error) { toast.error(r.error); return; }
      toast.success(
        `${r?.created ? "Account created" : "Account updated"} for ${email} — temporary password is their phone number. They have been notified in-app.`,
      );
      reset();
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const detailsValid = fullName.trim().length > 1 && /\S+@\S+\.\S+/.test(email) && phone.trim().length >= 6;
  const rolesValid = roles.length > 0;

  function toggleRole(r: AppRole) {
    setRoles((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-lg flex items-center gap-2">
          <UserPlus className="h-4 w-4" /> Staff onboarding wizard
        </CardTitle>
        <CardDescription>
          Creates the account if it does not exist, assigns every selected role, links the department headship, records an
          audit entry, and notifies the staff member to set their own password on first sign-in.
        </CardDescription>
        <div className="flex flex-wrap items-center gap-2 pt-2">
          {STEPS.map((label, i) => (
            <Badge key={label} variant={i === step ? "default" : i < step ? "secondary" : "outline"} className="gap-1">
              {i < step ? <Check className="h-3 w-3" /> : `${i + 1}.`} {label}
            </Badge>
          ))}
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {step === 0 && (
          <div className="grid gap-4 md:grid-cols-2">
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
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>Roles (select one or more)</Label>
              <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                {STAFF_ROLES.map((r) => (
                  <label key={r} className="flex items-center gap-2 rounded-md border p-2 text-sm capitalize cursor-pointer">
                    <Checkbox checked={roles.includes(r)} onCheckedChange={() => toggleRole(r)} />
                    {r.replace("_", " ")}
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-1.5 md:max-w-md">
              <Label>Head of department for</Label>
              <Select value={departmentId} onValueChange={setDepartmentId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No department link</SelectItem>
                  {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-2 text-sm">
            <Row label="Full name" value={fullName} />
            <Row label="Login email" value={email} />
            <Row label="Temporary password" value={phone} />
            <Row label="Staff code" value={staffCode || "—"} />
            <Row label="Roles" value={roles.map((r) => r.replace("_", " ")).join(", ") || "—"} />
            <Row label="Department headship" value={departmentName ?? "None"} />
            <p className="text-muted-foreground pt-2">
              They will be prompted to set a personal password on first sign-in and will receive an in-app notification
              confirming this assignment.
            </p>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 pt-1">
          <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0 || mut.isPending}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          {step < 2 ? (
            <Button
              onClick={() => setStep((s) => s + 1)}
              disabled={(step === 0 && !detailsValid) || (step === 1 && !rolesValid)}
            >
              Next <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={() => mut.mutate()} disabled={!detailsValid || !rolesValid || mut.isPending}>
              {mut.isPending ? "Saving…" : "Create / update account"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b py-1.5 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}
