import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, GraduationCap, CheckCircle2 } from "lucide-react";
import {
  getMyApplication, upsertMyApplication, listProgrammesForApply,
} from "@/lib/admissions.functions";

export const Route = createFileRoute("/_authenticated/apply")({
  component: ApplyPage,
});

function ApplyPage() {
  const getMine = useServerFn(getMyApplication);
  const getOpts = useServerFn(listProgrammesForApply);
  const save = useServerFn(upsertMyApplication);
  const qc = useQueryClient();

  const { data: mine, isLoading } = useQuery({ queryKey: ["my-application"], queryFn: () => getMine() });
  const { data: opts } = useQuery({ queryKey: ["apply-options"], queryFn: () => getOpts() });

  const [form, setForm] = useState<any>({
    full_name: "", email: "", phone: "", date_of_birth: "", gender: "",
    state_of_origin: "", lga: "", address: "",
    previous_school: "", qualification: "",
    programme_id: "", entry_session_id: "",
  });

  useEffect(() => {
    if (mine) setForm({
      full_name: mine.full_name ?? "", email: mine.email ?? "", phone: mine.phone ?? "",
      date_of_birth: mine.date_of_birth ?? "", gender: mine.gender ?? "",
      state_of_origin: mine.state_of_origin ?? "", lga: mine.lga ?? "", address: mine.address ?? "",
      previous_school: mine.previous_school ?? "", qualification: mine.qualification ?? "",
      programme_id: mine.programme_id ?? "", entry_session_id: mine.entry_session_id ?? "",
    });
  }, [mine]);

  const mut = useMutation({
    mutationFn: (payload: any) => save({ data: payload }),
    onSuccess: () => { toast.success("Application saved"); qc.invalidateQueries({ queryKey: ["my-application"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Failed to save"),
  });

  if (isLoading) return <div className="p-6"><Loader2 className="animate-spin" /></div>;

  const readOnly = mine && ["approved", "rejected", "matriculated"].includes(mine.status);

  return (
    <div className="space-y-6 max-w-4xl">
      <section className="bg-hero-gradient text-white rounded-xl p-6 shadow-elegant">
        <div className="text-xs uppercase tracking-widest text-white/70">Admissions</div>
        <h1 className="mt-2 font-serif text-3xl font-bold flex items-center gap-3">
          <GraduationCap className="h-8 w-8" /> AKCOE NCE Application
        </h1>
        <p className="mt-2 text-white/80">Complete this form to apply for admission into the Nigeria Certificate in Education programme.</p>
        {mine && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs text-white/70">Status:</span>
            <Badge variant="secondary" className="uppercase">{mine.status.replace("_", " ")}</Badge>
            {mine.matric_number && (
              <Badge className="bg-primary-glow text-primary"><CheckCircle2 className="h-3 w-3 mr-1" />Matric: {mine.matric_number}</Badge>
            )}
          </div>
        )}
      </section>

      <form onSubmit={(e) => { e.preventDefault(); mut.mutate(form); }} className="space-y-6">
        <Card>
          <CardHeader><CardTitle className="font-serif">Personal Information</CardTitle></CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-4">
            <Field label="Full name"><Input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} disabled={!!readOnly} /></Field>
            <Field label="Email"><Input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} disabled={!!readOnly} /></Field>
            <Field label="Phone"><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} disabled={!!readOnly} /></Field>
            <Field label="Date of birth"><Input type="date" value={form.date_of_birth ?? ""} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} disabled={!!readOnly} /></Field>
            <Field label="Gender">
              <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })} disabled={!!readOnly}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent><SelectItem value="male">Male</SelectItem><SelectItem value="female">Female</SelectItem></SelectContent>
              </Select>
            </Field>
            <Field label="State of origin"><Input value={form.state_of_origin} onChange={(e) => setForm({ ...form, state_of_origin: e.target.value })} disabled={!!readOnly} /></Field>
            <Field label="LGA"><Input value={form.lga} onChange={(e) => setForm({ ...form, lga: e.target.value })} disabled={!!readOnly} /></Field>
            <Field label="Address" full><Textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} disabled={!!readOnly} /></Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="font-serif">Academic Background</CardTitle></CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-4">
            <Field label="Previous school"><Input value={form.previous_school} onChange={(e) => setForm({ ...form, previous_school: e.target.value })} disabled={!!readOnly} /></Field>
            <Field label="Qualification (e.g. SSCE, NABTEB)"><Input value={form.qualification} onChange={(e) => setForm({ ...form, qualification: e.target.value })} disabled={!!readOnly} /></Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-serif">Programme Choice</CardTitle>
            <CardDescription>Select the NCE programme you wish to apply for.</CardDescription>
          </CardHeader>
          <CardContent className="grid md:grid-cols-2 gap-4">
            <Field label="Programme">
              <Select value={form.programme_id} onValueChange={(v) => setForm({ ...form, programme_id: v })} disabled={!!readOnly}>
                <SelectTrigger><SelectValue placeholder="Select programme" /></SelectTrigger>
                <SelectContent className="max-h-64">
                  {opts?.programmes.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.code} — {p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Preferred entry session">
              <Select value={form.entry_session_id} onValueChange={(v) => setForm({ ...form, entry_session_id: v })} disabled={!!readOnly}>
                <SelectTrigger><SelectValue placeholder="Select session" /></SelectTrigger>
                <SelectContent>
                  {opts?.sessions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}{s.status === "active" ? " (active)" : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </CardContent>
        </Card>

        {!readOnly && (
          <div className="flex justify-end">
            <Button type="submit" disabled={mut.isPending || !form.programme_id} className="bg-primary text-primary-foreground">
              {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save & Submit"}
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "md:col-span-2 space-y-2" : "space-y-2"}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
