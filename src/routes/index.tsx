import { createFileRoute, Link } from "@tanstack/react-router";
import {
  GraduationCap,
  ShieldCheck,
  BookOpen,
  Users,
  ArrowRight,
  Sparkles,
  BarChart3,
  FileCheck2,
  Building2,
} from "lucide-react";
import { motion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { SiteLayout } from "@/components/site/SiteLayout";
import { TextReveal, FadeIn } from "@/components/motion/TextReveal";
import { Reveal, Stagger, StaggerItem } from "@/components/motion/Reveal";
import { Counter } from "@/components/motion/Counter";
import heroCampus from "@/assets/hero-campus.jpg";
import lectureHall from "@/assets/lecture-hall.jpg";
import graduation from "@/assets/graduation.jpg";
import library from "@/assets/library.jpg";

const SITE_URL = "https://academic-hub-ng.lovable.app";
const OG_IMAGE =
  "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/08860a6d-e594-4a03-87d2-3718c2b02932";
const TITLE = "AKCOE Portal — Aminu Kano College of Education";
const DESC =
  "Register courses, upload results, track approvals and manage academic records at Aminu Kano College of Education, Kano, Nigeria.";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:url", content: SITE_URL + "/" },
      { property: "og:image", content: OG_IMAGE },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESC },
      { name: "twitter:image", content: OG_IMAGE },
    ],
    links: [{ rel: "canonical", href: SITE_URL + "/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "CollegeOrUniversity",
          name: "Aminu Kano College of Education",
          alternateName: "AKCOE",
          url: SITE_URL,
          logo: OG_IMAGE,
          address: {
            "@type": "PostalAddress",
            addressLocality: "Kano",
            addressCountry: "NG",
          },
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "AKCOE Portal",
          url: SITE_URL,
        }),
      },
    ],
  }),
});

const ROLES = [
  { icon: GraduationCap, label: "Students", desc: "Register courses, view results, print statements of result." },
  { icon: BookOpen, label: "Lecturers", desc: "Enter CA and exam scores, track submission progress." },
  { icon: Users, label: "HOD & Dean", desc: "Review and approve semester results at each stage." },
  { icon: ShieldCheck, label: "Registry", desc: "Publish results, manage records and issue transcripts." },
];

const MARQUEE = [
  "School of Education",
  "School of Arts & Social Sciences",
  "School of Sciences",
  "School of Languages",
  "School of Vocational Education",
  "Islamic Studies",
  "Hausa",
  "Mass Communication",
  "Accountancy",
  "Public Administration",
];

function Landing() {
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const imgY = useTransform(scrollYProgress, [0, 1], ["0%", "16%"]);
  const fade = useTransform(scrollYProgress, [0, 1], [1, 0.35]);

  return (
    <SiteLayout>
      <>
        {/* ---------------- Hero ---------------- */}
        <section ref={heroRef} className="relative isolate -mt-16 overflow-hidden sm:-mt-20">
          <motion.div style={{ y: imgY }} className="absolute inset-0 z-0">
            <img
              src={heroCampus}
              alt="Students walking through the Aminu Kano College of Education campus at golden hour"
              width={1920}
              height={1200}
              className="h-[115%] w-full object-cover"
            />
          </motion.div>
          <div className="absolute inset-0 z-0 bg-[linear-gradient(180deg,oklch(0.16_0.05_260/0.92)_0%,oklch(0.18_0.06_260/0.78)_45%,oklch(0.16_0.05_260/0.95)_100%)]" />

          <motion.div
            style={{ opacity: fade }}
            className="relative z-10 mx-auto max-w-7xl px-4 pb-24 pt-32 sm:pt-40 md:pb-32 md:pt-48"
          >
            <FadeIn>
              <span className="inline-flex items-center gap-2 rounded-full glass-dark px-4 py-1.5 text-[11px] uppercase tracking-[0.24em] text-white/80">
                <Sparkles className="h-3.5 w-3.5 text-gold" />
                Excellence in teacher education
              </span>
            </FadeIn>

            <TextReveal
              as="h1"
              text="A modern academic record system for Aminu Kano College of Education"
              highlight={["modern", "academic", "record"]}
              className="mt-7 max-w-4xl font-serif text-4xl font-bold leading-[1.05] text-white text-balance-tight sm:text-6xl md:text-7xl"
              delay={0.15}
            />

            <FadeIn delay={0.7}>
              <p className="mt-7 max-w-xl text-base leading-relaxed text-white/75 sm:text-lg">
                Course registration, score entry, multi-stage result approval, CGPA analytics and transcripts —
                one secure portal for students, lecturers, deans and registry.
              </p>
            </FadeIn>

            <FadeIn delay={0.85}>
              <div className="mt-10 flex flex-wrap items-center gap-3">
                <Link to="/auth" search={{ next: undefined }}>
                  <Button size="lg" className="shine rounded-full bg-gold px-7 text-gold-foreground hover:bg-gold/90">
                    Access portal <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link to="/admissions">
                  <Button
                    size="lg"
                    variant="outline"
                    className="rounded-full border-white/25 bg-white/5 px-7 text-white backdrop-blur hover:bg-white/15 hover:text-white"
                  >
                    Apply for admission
                  </Button>
                </Link>
              </div>
            </FadeIn>

            <Stagger className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" gap={0.1}>
              {[
                { value: 249, label: "Enrolled students", suffix: "+" },
                { value: 7629, label: "Results processed", suffix: "" },
                { value: 31, label: "Programmes", suffix: "" },
                { value: 21, label: "Departments", suffix: "" },
              ].map((s) => (
                <StaggerItem key={s.label}>
                  <div className="glass-dark card-hover rounded-2xl p-5">
                    <div className="font-serif text-3xl font-bold text-gold sm:text-4xl">
                      <Counter to={s.value} suffix={s.suffix} />
                    </div>
                    <div className="mt-1 text-xs uppercase tracking-[0.18em] text-white/60">{s.label}</div>
                  </div>
                </StaggerItem>
              ))}
            </Stagger>
          </motion.div>
        </section>

        {/* ---------------- Marquee ---------------- */}
        <section className="overflow-hidden border-y bg-card py-4">
          <div className="flex w-max animate-marquee gap-10 whitespace-nowrap">
            {[...MARQUEE, ...MARQUEE].map((m, i) => (
              <span key={i} className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
                {m} <span className="ml-10 text-gold">◆</span>
              </span>
            ))}
          </div>
        </section>

        {/* ---------------- Roles bento ---------------- */}
        <section className="bg-aurora">
          <div className="mx-auto max-w-7xl px-4 py-20 md:py-28">
            <Reveal>
              <div className="max-w-2xl">
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-gold">Built for every desk</div>
                <h2 className="mt-4 font-serif text-3xl font-bold text-primary text-balance-tight sm:text-5xl">
                  One portal, four points of view
                </h2>
                <p className="mt-4 text-muted-foreground">
                  Every role sees exactly what it needs — nothing more. Scoped permissions keep student records
                  safe while the approval chain moves at speed.
                </p>
              </div>
            </Reveal>

            <Stagger className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              {ROLES.map((r) => (
                <StaggerItem key={r.label}>
                  <div className="group card-hover h-full rounded-3xl border bg-card p-7">
                    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/5 text-primary transition-colors group-hover:bg-gold/15 group-hover:text-gold">
                      <r.icon className="h-6 w-6" />
                    </div>
                    <div className="mt-6 font-serif text-xl font-bold text-primary">{r.label}</div>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{r.desc}</p>
                  </div>
                </StaggerItem>
              ))}
            </Stagger>
          </div>
        </section>

        {/* ---------------- Feature split ---------------- */}
        <section className="border-y bg-card">
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-20 md:grid-cols-2 md:py-28">
            <Reveal direction="right">
              <div className="relative">
                <div className="overflow-hidden rounded-[2rem] shadow-[var(--shadow-lift)]">
                  <img
                    src={lectureHall}
                    alt="Students attending a lecture in a bright college hall"
                    width={1200}
                    height={912}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-[1.2s] hover:scale-105"
                  />
                </div>
                <div className="absolute -bottom-6 -right-2 hidden w-56 rounded-2xl glass-panel p-4 sm:block animate-float-slow">
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Approval chain</div>
                  <div className="mt-2 font-serif text-lg font-bold text-primary">Draft → Published</div>
                  <div className="mt-1 text-xs text-muted-foreground">HOD · Dean · Registry · Senate</div>
                </div>
              </div>
            </Reveal>

            <div>
              <Reveal>
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-gold">The result cycle</div>
                <h2 className="mt-4 font-serif text-3xl font-bold text-primary text-balance-tight sm:text-4xl">
                  Scores that move through the right hands
                </h2>
              </Reveal>
              <Stagger className="mt-8 space-y-5">
                {[
                  { icon: FileCheck2, t: "Lecturer entry", d: "CA and exam scores captured per offering with validation and bulk CSV import." },
                  { icon: ShieldCheck, t: "Layered approval", d: "HOD, Dean, Registry and Senate sign-off with a full immutable audit trail." },
                  { icon: BarChart3, t: "Live analytics", d: "GPA and CGPA trends by programme, department, level and semester." },
                ].map((f) => (
                  <StaggerItem key={f.t}>
                    <div className="flex gap-4 rounded-2xl border p-5 card-hover">
                      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gold/12 text-gold">
                        <f.icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-foreground">{f.t}</div>
                        <p className="mt-1 text-sm text-muted-foreground">{f.d}</p>
                      </div>
                    </div>
                  </StaggerItem>
                ))}
              </Stagger>
            </div>
          </div>
        </section>

        {/* ---------------- Gallery ---------------- */}
        <section className="mx-auto max-w-7xl px-4 py-20 md:py-28">
          <Reveal>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-gold">Campus life</div>
                <h2 className="mt-4 font-serif text-3xl font-bold text-primary sm:text-4xl">
                  Where teachers are made
                </h2>
              </div>
              <Link to="/about">
                <Button variant="outline" className="rounded-full">
                  About the College <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </Reveal>

          <Stagger className="mt-10 grid gap-5 md:grid-cols-3">
            {[
              { img: library, t: "Library & research", d: "Quiet study spaces and a growing digital catalogue." },
              { img: graduation, t: "Convocation", d: "Verified transcripts and graduation lists, issued by Registry." },
              { img: lectureHall, t: "Teaching practice", d: "Classroom-ready training across all NCE programmes." },
            ].map((g) => (
              <StaggerItem key={g.t}>
                <figure className="group card-hover overflow-hidden rounded-3xl border bg-card">
                  <div className="aspect-[4/3] overflow-hidden">
                    <img
                      src={g.img}
                      alt={g.t}
                      width={1200}
                      height={912}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-[1.2s] group-hover:scale-110"
                    />
                  </div>
                  <figcaption className="p-6">
                    <div className="font-serif text-lg font-bold text-primary">{g.t}</div>
                    <p className="mt-1 text-sm text-muted-foreground">{g.d}</p>
                  </figcaption>
                </figure>
              </StaggerItem>
            ))}
          </Stagger>
        </section>

        {/* ---------------- CTA ---------------- */}
        <section className="px-4 pb-24">
          <Reveal>
            <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[2.5rem] bg-mesh px-6 py-16 text-center sm:px-16 md:py-24">
              <div className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-gold/20 blur-3xl animate-float-slow" />
              <div className="relative">
                <Building2 className="mx-auto h-8 w-8 text-gold" />
                <h2 className="mx-auto mt-6 max-w-3xl font-serif text-3xl font-bold text-white text-balance-tight sm:text-5xl">
                  Ready to begin your session?
                </h2>
                <p className="mx-auto mt-5 max-w-xl text-white/70">
                  Students sign in with their matriculation number. Staff sign in with their official college email.
                </p>
                <div className="mt-9 flex flex-wrap justify-center gap-3">
                  <Link to="/auth" search={{ next: undefined }}>
                    <Button size="lg" className="shine rounded-full bg-gold px-8 text-gold-foreground hover:bg-gold/90">
                      Sign in to the portal <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                  <Link to="/contact">
                    <Button
                      size="lg"
                      variant="outline"
                      className="rounded-full border-white/25 bg-white/5 px-8 text-white hover:bg-white/15 hover:text-white"
                    >
                      Talk to Registry
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </Reveal>
        </section>
      </>
    </SiteLayout>
  );
}
