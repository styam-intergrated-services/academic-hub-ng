import { useMemo, useState } from "react";
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
import { UserPlus, ArrowLeft, ArrowRight, Check, AlertCircle, ShieldCheck } from "lucide-react";

const STAFF_ROLES: AppRole[] = [
  "provost", "registry", "bursary", "dean", "hod", "lecturer", "examination_officer", "ict_admin",
];

const STEPS = ["Staff details", "Roles & department", "Review & confirm"] as const;

export function CreateStaffAccountCard() {
  const [step, setStep] = useState(0);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [staffCode, setStaffCode] = useState("");
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [departmentId, setDepartmentId] = useState<string>("none");
  const [confirmed, setConfirmed] = useState(false);

  const create = useServerFn(createStaffAccounts);
  const structure = useServerFn(listAcademicStructure);
  const qc = useQueryClient();

  const { data: struct } = useQuery({
    queryKey: ["admin", "structure", "departments"],
    queryFn: () => structure(),
    staleTime: 60_000,
  });
  const departments: Array<{ id: string; name: string; hod_id?: string | null }> =
    (struct as { departments?: Array<{ id: string; name: string; hod_id?: string | null }> } | undefined)?.departments ?? [];
  const department = departments.find((d) => d.id === departmentId) ?? null;

  function reset() {
    setFullName(""); setEmail(""); setPhone(""); setStaffCode("");
    setRoles([]); setDepartmentId("none"); setConfirmed(false); setStep(0);
  }

  const mut = useMutation({
    mutationFn: () =>
      create({
        data: {
          staff: [{
            full_name: fullName.trim(),
            email: email.trim().toLowerCase(),
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
      qc.invalidateQueries({ queryKey: ["admin", "audit-logs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ---- validation ----
  const detailErrors = useMemo(() => {
    const e: Record<string, string> = {};
    const name = fullName.trim();
    if (name.length < 3) e.fullName = "Enter the staff member's full name (at least 3 characters).";
    else if (!/^[\p{L}][\p{L}\s.'’-]+$/u.test(name)) e.fullName = "Use letters, spaces, hyphens, apostrophes and dots only.";
    const mail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail)) e.email = "Enter a valid login email address.";
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 7) e.phone = "Phone must contain at least 7 digits — it becomes the temporary password.";
    else if (digits.length > 15) e.phone = "Phone number looks too long.";
    const code = staffCode.trim();
    if (code && !/^[A-Za-z0-9/-]{2,32}$/.test(code)) e.staffCode = "Staff code may only contain letters, numbers, / and -.";
    return e;
  }, [fullName, email, phone, staffCode]);

  const roleErrors = useMemo(() => {
    const e: Record<string, string> = {};
    if (roles.length === 0) e.roles = "Select at least one role.";
    if (roles.includes("hod") && departmentId === "none") e.department = "A HOD must be linked to the department they lead.";
    if (!roles.includes("hod") && departmentId !== "none") e.department = "Department headship requires the HOD role — add it or clear the department.";
    return e;
  }, [roles, departmentId]);

  const detailsValid = Object.keys(detailErrors).length === 0;
  const rolesValid = Object.keys(roleErrors).length === 0;
  const canSubmit = detailsValid && rolesValid && confirmed && !mut.isPending;

  function toggleRole(r: AppRole) {
    setRoles((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));
    setConfirmed(false);
  }

  const replacingHod = Boolean(department?.hod_id && department.hod_id !== null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-lg flex items-center gap-2">
          <UserPlus className="h-4 w-4" /> Staff onboarding wizard
        </CardTitle>
        <CardDescription>
          Creates the account if it does not exist, assigns every selected role, links the department headship, records an
          audit entry, and notifies the staff member to set their own password on first sign-in. If any step fails, all
          partial changes are rolled back automatically.
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
            <Field label="Full name" id="staff-name" error={detailErrors.fullName}>
              <Input id="staff-name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Dr. Jane Doe" aria-invalid={!!detailErrors.fullName} />
            </Field>
            <Field label="Email (login)" id="staff-email" error={detailErrors.email}>
              <Input id="staff-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" aria-invalid={!!detailErrors.email} />
            </Field>
            <Field label="Phone (temporary password)" id="staff-phone" error={detailErrors.phone}>
              <Input id="staff-phone" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08012345678" aria-invalid={!!detailErrors.phone} />
            </Field>
            <Field label="Staff code (optional)" id="staff-code" error={detailErrors.staffCode}>
              <Input id="staff-code" value={staffCode} onChange={(e) => setStaffCode(e.target.value)} placeholder="AKCOE12" aria-invalid={!!detailErrors.staffCode} />
            </Field>
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
              {roleErrors.roles && <ErrorText>{roleErrors.roles}</ErrorText>}
              <p className="text-xs text-muted-foreground">
                Student and applicant roles cannot be granted here — they are issued through admissions.
              </p>
            </div>
            <div className="space-y-1.5 md:max-w-md">
              <Label>Head of department for</Label>
              <Select value={departmentId} onValueChange={(v) => { setDepartmentId(v); setConfirmed(false); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No department link</SelectItem>
                  {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {roleErrors.department && <ErrorText>{roleErrors.department}</ErrorText>}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3 text-sm">
            <Row label="Full name" value={fullName.trim()} />
            <Row label="Login email" value={email.trim().toLowerCase()} />
            <Row label="Temporary password" value={phone.trim()} />
            <Row label="Staff code" value={staffCode.trim() || "—"} />
            <Row label="Roles" value={roles.map((r) => r.replace("_", " ")).join(", ") || "—"} />
            <Row label="Department headship" value={department?.name ?? "None"} />

            {replacingHod && (
              <div className="flex gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-destructive">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>
                  {department?.name} already has a head of department. Submitting will replace that headship with{" "}
                  {fullName.trim() || "this staff member"}.
                </span>
              </div>
            )}

            <div className="rounded-md border bg-muted/40 p-3 space-y-1.5">
              <p className="font-medium flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> What happens on submit</p>
              <ul className="list-disc pl-5 text-muted-foreground space-y-0.5">
                <li>Account created if missing, otherwise the existing account is updated and its temporary password reset.</li>
                <li>{roles.length} role{roles.length === 1 ? "" : "s"} assigned; a forced password change is set for first sign-in.</li>
                <li>{department ? `Headship of ${department.name} linked.` : "No department headship linked."}</li>
                <li>An audit entry and an in-app notification are recorded.</li>
                <li>Any failure reverts every change made in this submission.</li>
              </ul>
            </div>

            <label className="flex items-start gap-2 rounded-md border p-3 cursor-pointer">
              <Checkbox checked={confirmed} onCheckedChange={(v) => setConfirmed(Boolean(v))} className="mt-0.5" />
              <span>
                I confirm these details are correct and authorise this role{department ? " and department headship" : ""} assignment.
              </span>
            </label>
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
            <Button onClick={() => mut.mutate()} disabled={!canSubmit}>
              {mut.isPending ? "Saving…" : "Create / update account"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, id, error, children }: { label: string; id: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && <ErrorText>{error}</ErrorText>}
    </div>
  );
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs text-destructive flex items-center gap-1">
      <AlertCircle className="h-3 w-3" /> {children}
    </p>
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
