import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { CheckCircle2, Circle, Download, FileText, Printer, RefreshCw } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ADMISSION_PROGRAMMES,
  SUBMITTED_KEY,
  TIMELINE,
  type SubmittedApplication,
} from "@/lib/admissions-frontend";
import akceLogo from "@/assets/akce-logo.asset.json";

const SITE_URL = "https://academic-hub-ng.lovable.app";
const TITLE = "Application status — AKCOE Admissions";
const DESC =
  "Track your Aminu Kano College of Education admission application: screening, departmental review, offer of admission and matriculation.";

export const Route = createFileRoute("/admissions/status")({
  component: StatusPage,
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
    links: [{ rel: "canonical", href: SITE_URL + "/admissions/status" }],
  }),
});

/** Front-end only: the tracker advances on a simple local demo stage. */
const DEMO_STAGE = 3; // offer issued

function StatusPage() {
  const [app, setApp] = useState<SubmittedApplication | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SUBMITTED_KEY);
      if (raw) setApp(JSON.parse(raw));
    } catch {
      /* ignore */
    }
    setLoaded(true);
  }, []);

  const programme = ADMISSION_PROGRAMMES.find((p) => p.id === app?.programmeId);
  const fullName = app ? [app.surname, app.firstName, app.otherNames].filter(Boolean).join(" ") : "";

  return (
    <SiteLayout>
      <section className="bg-mesh -mt-16 pb-28 pt-32 sm:-mt-20 sm:pt-40">
        <div className="mx-auto max-w-4xl px-4">
          <span className="inline-flex rounded-full glass-dark px-4 py-1.5 text-[11px] uppercase tracking-[0.24em] text-white/80">
            Application tracker
          </span>
          <h1 className="mt-6 font-serif text-3xl font-bold text-white text-balance-tight sm:text-5xl">
            Your admission status
          </h1>
        </div>
      </section>

      <div className="mx-auto -mt-20 max-w-4xl px-4 pb-24">
        {!loaded ? null : !app ? (
          <div className="glass-panel rounded-3xl p-10 text-center">
            <FileText className="mx-auto h-8 w-8 text-gold" />
            <h2 className="mt-5 font-serif text-2xl font-bold text-primary">No application found</h2>
            <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
              We could not find an application saved on this device. Start a new application to track its progress here.
            </p>
            <Link to="/admissions/apply">
              <Button className="mt-7 rounded-full">Start an application</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="glass-panel rounded-3xl p-6 sm:p-8">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Reference</div>
                  <div className="mt-1 truncate font-mono text-lg font-bold text-primary">{app.reference}</div>
                </div>
                <Badge className="shrink-0 bg-gold text-gold-foreground hover:bg-gold">Offer issued</Badge>
              </div>
              <div className="mt-6 grid gap-4 border-t pt-6 text-sm sm:grid-cols-2">
                <Info label="Applicant" value={fullName} />
                <Info label="Programme" value={programme?.name ?? "—"} />
                <Info label="Mode of entry" value={app.entryMode} />
                <Info label="Session" value={app.session} />
                <Info label="Email" value={app.email} />
                <Info label="Submitted" value={new Date(app.submittedAt).toLocaleString()} />
              </div>
            </div>

            <div className="rounded-3xl border bg-card p-6 sm:p-8">
              <h2 className="font-serif text-xl font-bold text-primary">Progress</h2>
              <div className="relative mt-8 pl-10">
                <div className="absolute left-[13px] top-2 h-[calc(100%-1.5rem)] w-px bg-border" />
                <motion.div
                  className="absolute left-[13px] top-2 w-px bg-gold"
                  initial={{ height: 0 }}
                  animate={{ height: `${(DEMO_STAGE / (TIMELINE.length - 1)) * 100}%` }}
                  transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                />
                <ul className="space-y-8">
                  {TIMELINE.map((t, i) => {
                    const done = i <= DEMO_STAGE;
                    return (
                      <motion.li
                        key={t.key}
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15 * i, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                        className="relative"
                      >
                        <span className="absolute -left-10 grid h-7 w-7 place-items-center rounded-full bg-card">
                          {done ? (
                            <CheckCircle2 className="h-6 w-6 text-gold" />
                          ) : (
                            <Circle className="h-5 w-5 text-muted-foreground" />
                          )}
                        </span>
                        <div className={`font-semibold ${done ? "text-primary" : "text-muted-foreground"}`}>
                          {t.label}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{t.desc}</p>
                      </motion.li>
                    );
                  })}
                </ul>
              </div>
            </div>

            {/* Admission letter */}
            <div className="rounded-3xl border bg-card p-6 sm:p-8 print-sheet">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 no-print">
                <h2 className="min-w-0 font-serif text-xl font-bold text-primary">Provisional admission letter</h2>
                <Button variant="outline" className="shrink-0 rounded-full" onClick={() => window.print()}>
                  <Printer className="mr-2 h-4 w-4" /> Print
                </Button>
              </div>

              <div className="mt-6 rounded-2xl border p-6 sm:p-10">
                <div className="flex items-center gap-4 border-b pb-6">
                  <img src={akceLogo.url} alt="" aria-hidden className="h-14 w-14 rounded-lg bg-white object-cover p-0.5" />
                  <div className="min-w-0">
                    <div className="font-serif text-lg font-bold text-primary">Aminu Kano College of Education</div>
                    <div className="text-xs text-muted-foreground">
                      Airport Road, Kano, Kano State, Nigeria · Office of the Registrar
                    </div>
                  </div>
                </div>
                <div className="mt-6 space-y-4 text-sm leading-relaxed">
                  <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                    <span>Ref: {app.reference}</span>
                    <span>{new Date().toLocaleDateString()}</span>
                  </div>
                  <p className="font-semibold">Dear {fullName || "Applicant"},</p>
                  <p className="font-serif text-base font-bold text-primary">
                    OFFER OF PROVISIONAL ADMISSION — {app.session} SESSION
                  </p>
                  <p>
                    I am pleased to inform you that, following the consideration of your application, you have been
                    offered provisional admission into <strong>{programme?.name ?? "your selected programme"}</strong>{" "}
                    ({programme?.award ?? ""}) at Aminu Kano College of Education for the {app.session} academic session.
                  </p>
                  <p>
                    This offer is provisional and subject to the verification of your original credentials, payment of
                    the prescribed acceptance and school fees, and completion of registration within the period
                    stipulated by the Registry.
                  </p>
                  <p>Please accept my congratulations.</p>
                  <div className="pt-6">
                    <div className="h-10 w-40 border-b border-dashed" />
                    <div className="mt-2 text-sm font-semibold">Registrar</div>
                    <div className="text-xs text-muted-foreground">Aminu Kano College of Education</div>
                  </div>
                  <p className="pt-4 text-[11px] italic text-muted-foreground">
                    Preview document — generated locally for demonstration. Not an official offer of admission.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 no-print">
              <Link to="/admissions/apply">
                <Button variant="outline" className="rounded-full">
                  <RefreshCw className="mr-2 h-4 w-4" /> Edit / new application
                </Button>
              </Link>
              <Button variant="ghost" className="rounded-full" onClick={() => window.print()}>
                <Download className="mr-2 h-4 w-4" /> Save as PDF
              </Button>
            </div>
          </div>
        )}
      </div>
    </SiteLayout>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className="mt-1 truncate font-medium">{value || "—"}</div>
    </div>
  );
}
