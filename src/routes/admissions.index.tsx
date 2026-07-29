import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CalendarDays, CheckCircle2, FileText, GraduationCap, Search } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TextReveal, FadeIn } from "@/components/motion/TextReveal";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/Reveal";
import { ADMISSION_PROGRAMMES, REQUIREMENTS, TIMELINE } from "@/lib/admissions-frontend";
import graduation from "@/assets/graduation.jpg";

const SITE_URL = "https://academic-hub-ng.lovable.app";
const TITLE = "Admissions — Aminu Kano College of Education";
const DESC =
  "Apply to Aminu Kano College of Education, Kano: NCE, affiliated degree, diploma and PGDE programmes, entry requirements and the admission timeline.";

export const Route = createFileRoute("/admissions/")({
  component: AdmissionsPage,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: SITE_URL + "/admissions" }],
  }),
});

function AdmissionsPage() {
  return (
    <SiteLayout>
      <section className="relative isolate -mt-16 overflow-hidden sm:-mt-20">
        <img
          src={graduation}
          alt="Graduates of Aminu Kano College of Education celebrating at convocation"
          width={1200}
          height={912}
          className="absolute inset-0 z-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 z-0 bg-[linear-gradient(180deg,oklch(0.16_0.05_260/0.93)_0%,oklch(0.18_0.06_260/0.86)_100%)]" />
        <div className="relative z-10 mx-auto max-w-7xl px-4 pb-20 pt-32 sm:pt-44">
          <FadeIn>
            <span className="inline-flex items-center gap-2 rounded-full glass-dark px-4 py-1.5 text-[11px] uppercase tracking-[0.24em] text-white/80">
              <CalendarDays className="h-3.5 w-3.5 text-gold" /> 2025 / 2026 session
            </span>
          </FadeIn>
          <TextReveal
            as="h1"
            text="Admissions into AKCOE"
            highlight={["AKCOE"]}
            className="mt-7 font-serif text-4xl font-bold text-white text-balance-tight sm:text-6xl"
            delay={0.15}
          />
          <FadeIn delay={0.55}>
            <p className="mt-6 max-w-xl text-white/75">
              Apply online for NCE, affiliated degree, diploma and postgraduate programmes. Track your application
              from submission through screening to matriculation.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link to="/admissions/apply">
                <Button size="lg" className="shine rounded-full bg-gold px-7 text-gold-foreground hover:bg-gold/90">
                  Start an application <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link to="/admissions/status">
                <Button
                  size="lg"
                  variant="outline"
                  className="rounded-full border-white/25 bg-white/5 px-7 text-white hover:bg-white/15 hover:text-white"
                >
                  <Search className="mr-2 h-4 w-4" /> Check status
                </Button>
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Programmes */}
      <section className="mx-auto max-w-7xl px-4 py-20">
        <Reveal>
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-gold">Open programmes</div>
          <h2 className="mt-4 font-serif text-3xl font-bold text-primary sm:text-4xl">Choose your course of study</h2>
        </Reveal>
        <Stagger className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {ADMISSION_PROGRAMMES.map((p) => (
            <StaggerItem key={p.id}>
              <div className="card-hover h-full rounded-3xl border bg-card p-6">
                <div className="flex items-start justify-between gap-3">
                  <GraduationCap className="h-5 w-5 shrink-0 text-gold" />
                  <Badge variant="secondary" className="shrink-0">{p.award}</Badge>
                </div>
                <div className="mt-5 font-serif text-lg font-bold text-primary">{p.name}</div>
                <div className="mt-2 text-sm text-muted-foreground">{p.school}</div>
                <div className="mt-4 text-xs uppercase tracking-[0.18em] text-muted-foreground">{p.duration}</div>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </section>

      {/* Requirements */}
      <section className="border-y bg-aurora">
        <div className="mx-auto max-w-7xl px-4 py-20">
          <Reveal>
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-gold">Before you apply</div>
            <h2 className="mt-4 font-serif text-3xl font-bold text-primary sm:text-4xl">Entry requirements</h2>
          </Reveal>
          <Stagger className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {REQUIREMENTS.map((r) => (
              <StaggerItem key={r.title}>
                <div className="card-hover h-full rounded-3xl border bg-card p-6">
                  <FileText className="h-5 w-5 text-gold" />
                  <div className="mt-5 font-serif text-lg font-bold text-primary">{r.title}</div>
                  <ul className="mt-4 space-y-2.5">
                    {r.items.map((i) => (
                      <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                        <span>{i}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Timeline */}
      <section className="mx-auto max-w-4xl px-4 py-20">
        <Reveal>
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-gold">How it works</div>
          <h2 className="mt-4 font-serif text-3xl font-bold text-primary sm:text-4xl">From application to matriculation</h2>
        </Reveal>
        <div className="relative mt-12 pl-10">
          <div className="absolute left-[15px] top-2 h-[calc(100%-1rem)] w-px bg-border" />
          <Stagger className="space-y-8">
            {TIMELINE.map((t, i) => (
              <StaggerItem key={t.key}>
                <div className="relative">
                  <span className="absolute -left-10 grid h-8 w-8 place-items-center rounded-full border bg-card font-serif text-sm font-bold text-gold">
                    {i + 1}
                  </span>
                  <div className="font-serif text-lg font-bold text-primary">{t.label}</div>
                  <p className="mt-1 text-sm text-muted-foreground">{t.desc}</p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
        <Reveal delay={0.1}>
          <div className="mt-14 rounded-3xl bg-mesh p-10 text-center">
            <h3 className="font-serif text-2xl font-bold text-white sm:text-3xl">Applications are open</h3>
            <p className="mx-auto mt-3 max-w-md text-sm text-white/70">
              Complete the online form in about ten minutes. You can save your progress and return later.
            </p>
            <Link to="/admissions/apply">
              <Button size="lg" className="mt-7 shine rounded-full bg-gold px-8 text-gold-foreground hover:bg-gold/90">
                Apply now <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </Reveal>
      </section>
    </SiteLayout>
  );
}
