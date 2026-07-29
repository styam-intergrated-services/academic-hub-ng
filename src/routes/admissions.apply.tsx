import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeft, ArrowRight, Check, CircleCheck, Loader2, Save } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  ADMISSION_PROGRAMMES,
  DRAFT_KEY,
  EMPTY_DRAFT,
  ENTRY_MODES,
  STATES,
  SUBMITTED_KEY,
  makeReference,
  type ApplicationDraft,
} from "@/lib/admissions-frontend";

const SITE_URL = "https://academic-hub-ng.lovable.app";
const TITLE = "Apply for admission — Aminu Kano College of Education";
const DESC =
  "Complete the AKCOE online admission application: personal details, programme choice, academic qualifications and declaration.";

export const Route = createFileRoute("/admissions/apply")({
  component: ApplyPage,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
    links: [{ rel: "canonical", href: SITE_URL + "/admissions/apply" }],
  }),
});

const STEPS = ["Personal", "Programme", "Qualifications", "Review"] as const;

function ApplyPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<ApplicationDraft>(EMPTY_DRAFT);
  const [submitting, setSubmitting] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) setDraft({ ...EMPTY_DRAFT, ...JSON.parse(raw) });
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  const set = <K extends keyof ApplicationDraft>(key: K, value: ApplicationDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const saveDraft = () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    toast.success("Draft saved on this device");
  };

  const stepValid = () => {
    if (step === 0) return !!(draft.surname && draft.firstName && draft.email && draft.phone);
    if (step === 1) return !!(draft.programmeId && draft.entryMode);
    if (step === 2) return !!(draft.qualification && draft.examYear);
    return draft.declaration;
  };

  const next = () => {
    if (!stepValid()) {
      toast.error("Please complete the required fields on this step");
      return;
    }
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const back = () => setStep((s) => Math.max(0, s - 1));

  const submit = () => {
    if (!draft.declaration) {
      toast.error("You must accept the declaration to submit");
      return;
    }
    setSubmitting(true);
    // Front-end only: no backend call is made.
    setTimeout(() => {
      const submitted = {
        ...draft,
        reference: makeReference(),
        submittedAt: new Date().toISOString(),
      };
      localStorage.setItem(SUBMITTED_KEY, JSON.stringify(submitted));
      localStorage.removeItem(DRAFT_KEY);
      setSubmitting(false);
      navigate({ to: "/admissions/status" });
    }, 1200);
  };

  const programme = ADMISSION_PROGRAMMES.find((p) => p.id === draft.programmeId);

  return (
    <SiteLayout>
      <section className="bg-mesh -mt-16 pb-28 pt-32 sm:-mt-20 sm:pt-40">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <span className="inline-flex rounded-full glass-dark px-4 py-1.5 text-[11px] uppercase tracking-[0.24em] text-white/80">
            Online application
          </span>
          <h1 className="mt-6 font-serif text-3xl font-bold text-white text-balance-tight sm:text-5xl">
            Application for admission
          </h1>
          <p className="mt-4 text-sm text-white/70">
            2025 / 2026 academic session · Aminu Kano College of Education
          </p>
        </div>
      </section>

      <div className="mx-auto -mt-20 max-w-3xl px-4 pb-24">
        <div className="glass-panel rounded-3xl p-6 sm:p-10">
          {/* stepper */}
          <div className="grid grid-cols-4 gap-2">
            {STEPS.map((s, i) => (
              <div key={s}>
                <div className="flex items-center gap-2">
                  <span
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold transition-colors ${
                      i < step
                        ? "bg-gold text-gold-foreground"
                        : i === step
                          ? "bg-primary text-primary-foreground animate-pulse-ring"
                          : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
                  </span>
                  <span className="hidden truncate text-xs font-medium sm:block">{s}</span>
                </div>
                <div className={`mt-3 h-1 rounded-full ${i <= step ? "bg-gold" : "bg-muted"}`} />
              </div>
            ))}
          </div>

          {!hydrated ? null : (
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="mt-10 space-y-5"
              >
                {step === 0 ? (
                  <>
                    <div className="grid gap-5 sm:grid-cols-2">
                      <Field label="Surname" required>
                        <Input value={draft.surname} onChange={(e) => set("surname", e.target.value)} placeholder="Abdullahi" />
                      </Field>
                      <Field label="First name" required>
                        <Input value={draft.firstName} onChange={(e) => set("firstName", e.target.value)} placeholder="Musa" />
                      </Field>
                      <Field label="Other names">
                        <Input value={draft.otherNames} onChange={(e) => set("otherNames", e.target.value)} />
                      </Field>
                      <Field label="Date of birth">
                        <Input type="date" value={draft.dateOfBirth} onChange={(e) => set("dateOfBirth", e.target.value)} />
                      </Field>
                      <Field label="Email address" required>
                        <Input type="email" value={draft.email} onChange={(e) => set("email", e.target.value)} placeholder="you@example.com" />
                      </Field>
                      <Field label="Phone number" required>
                        <Input value={draft.phone} onChange={(e) => set("phone", e.target.value)} placeholder="080…" />
                      </Field>
                      <Field label="Gender">
                        <Picker value={draft.gender} onChange={(v) => set("gender", v)} options={["Male", "Female"]} placeholder="Select gender" />
                      </Field>
                      <Field label="State of origin">
                        <Picker value={draft.stateOfOrigin} onChange={(v) => set("stateOfOrigin", v)} options={STATES} placeholder="Select state" />
                      </Field>
                    </div>
                    <Field label="Contact address">
                      <Textarea rows={3} value={draft.address} onChange={(e) => set("address", e.target.value)} />
                    </Field>
                  </>
                ) : null}

                {step === 1 ? (
                  <div className="space-y-5">
                    <Field label="Programme of choice" required>
                      <Picker
                        value={draft.programmeId}
                        onChange={(v) => set("programmeId", v)}
                        options={ADMISSION_PROGRAMMES.map((p) => ({ value: p.id, label: `${p.name} (${p.award})` }))}
                        placeholder="Select a programme"
                      />
                    </Field>
                    {programme ? (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-2xl border bg-card p-5 text-sm"
                      >
                        <div className="font-serif text-base font-bold text-primary">{programme.name}</div>
                        <div className="mt-1 text-muted-foreground">{programme.school}</div>
                        <div className="mt-2 text-xs uppercase tracking-[0.18em] text-gold">
                          {programme.award} · {programme.duration}
                        </div>
                      </motion.div>
                    ) : null}
                    <div className="grid gap-5 sm:grid-cols-2">
                      <Field label="Mode of entry" required>
                        <Picker value={draft.entryMode} onChange={(v) => set("entryMode", v)} options={[...ENTRY_MODES]} placeholder="Select mode" />
                      </Field>
                      <Field label="Session">
                        <Picker value={draft.session} onChange={(v) => set("session", v)} options={["2025/2026", "2026/2027"]} placeholder="Select session" />
                      </Field>
                    </div>
                  </div>
                ) : null}

                {step === 2 ? (
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field label="Highest qualification" required>
                      <Picker
                        value={draft.qualification}
                        onChange={(v) => set("qualification", v)}
                        options={["SSCE / WAEC", "NECO", "NABTEB", "NCE", "OND / HND", "First degree"]}
                        placeholder="Select qualification"
                      />
                    </Field>
                    <Field label="Examination body">
                      <Picker value={draft.examType} onChange={(v) => set("examType", v)} options={["WAEC/SSCE", "NECO", "NABTEB", "Other"]} placeholder="Select body" />
                    </Field>
                    <Field label="Year of examination" required>
                      <Input inputMode="numeric" value={draft.examYear} onChange={(e) => set("examYear", e.target.value)} placeholder="2024" />
                    </Field>
                    <div className="sm:col-span-2">
                      <Field label="Subjects and grades">
                        <Textarea
                          rows={5}
                          value={draft.subjects}
                          onChange={(e) => set("subjects", e.target.value)}
                          placeholder={"English Language — C5\nMathematics — B3\nIslamic Studies — A1"}
                        />
                      </Field>
                    </div>
                  </div>
                ) : null}

                {step === 3 ? (
                  <div className="space-y-5">
                    <div className="rounded-2xl border bg-card divide-y">
                      <Row label="Full name" value={[draft.surname, draft.firstName, draft.otherNames].filter(Boolean).join(" ")} />
                      <Row label="Email" value={draft.email} />
                      <Row label="Phone" value={draft.phone} />
                      <Row label="Date of birth" value={draft.dateOfBirth} />
                      <Row label="Gender" value={draft.gender} />
                      <Row label="State of origin" value={draft.stateOfOrigin} />
                      <Row label="Programme" value={programme?.name ?? ""} />
                      <Row label="Mode of entry" value={draft.entryMode} />
                      <Row label="Session" value={draft.session} />
                      <Row label="Qualification" value={`${draft.qualification} · ${draft.examType} · ${draft.examYear}`} />
                    </div>
                    <label className="flex cursor-pointer items-start gap-3 rounded-2xl border p-5">
                      <Checkbox
                        checked={draft.declaration}
                        onCheckedChange={(v) => set("declaration", v === true)}
                        className="mt-0.5"
                      />
                      <span className="text-sm text-muted-foreground">
                        I declare that the information provided is true and correct. I understand that any false
                        declaration may lead to the withdrawal of my admission.
                      </span>
                    </label>
                    <p className="text-xs text-muted-foreground">
                      This form is a preview of the admissions experience. Submissions are stored on this device only
                      and are not yet sent to the Admissions Office.
                    </p>
                  </div>
                ) : null}
              </motion.div>
            </AnimatePresence>
          )}

          <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t pt-6">
            <div className="flex gap-2">
              {step > 0 ? (
                <Button variant="outline" className="rounded-full" onClick={back}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>
              ) : (
                <Link to="/admissions">
                  <Button variant="ghost" className="rounded-full">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Admissions
                  </Button>
                </Link>
              )}
              <Button variant="ghost" className="rounded-full" onClick={saveDraft}>
                <Save className="mr-2 h-4 w-4" /> Save draft
              </Button>
            </div>
            {step < STEPS.length - 1 ? (
              <Button className="shine rounded-full px-7" onClick={next}>
                Continue <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button
                className="shine rounded-full bg-gold px-7 text-gold-foreground hover:bg-gold/90"
                onClick={submit}
                disabled={submitting}
              >
                {submitting ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting…</>
                ) : (
                  <><CircleCheck className="mr-2 h-4 w-4" /> Submit application</>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
        {label} {required ? <span className="text-destructive">*</span> : null}
      </Label>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 px-5 py-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate text-right font-medium">{value || "—"}</span>
    </div>
  );
}

function Picker({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: (string | { value: string; label: string })[];
  placeholder: string;
}) {
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => {
          const v = typeof o === "string" ? o : o.value;
          const l = typeof o === "string" ? o : o.label;
          return (
            <SelectItem key={v} value={v}>
              {l}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
