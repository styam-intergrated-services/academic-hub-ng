import { createFileRoute, Link } from "@tanstack/react-router";
import { GraduationCap, ShieldCheck, BookOpen, Users, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import akceLogo from "@/assets/akce-logo.asset.json";

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


function Landing() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-background/80 backdrop-blur sticky top-0 z-40">
        <div className="mx-auto max-w-7xl px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img
              src={akceLogo.url}
              alt="Aminu Kano College of Education logo"
              className="h-11 w-11 rounded-md object-cover bg-white p-0.5 shadow-sm"
            />
            <div className="leading-tight">
              <div className="font-serif font-bold text-primary">AKCOE Portal</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Aminu Kano College of Education
              </div>
            </div>
          </Link>
          <Link to="/auth">
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">Sign in</Button>
          </Link>
        </div>
      </header>

      <main>
      <section className="bg-hero-gradient text-white">
        <div className="mx-auto max-w-7xl px-4 py-20 md:py-28 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <span className="inline-block rounded-full bg-white/10 border border-white/20 px-3 py-1 text-xs uppercase tracking-widest">
              Est. Excellence in Teacher Education
            </span>
            <h1 className="mt-5 font-serif text-4xl md:text-6xl font-bold leading-tight">
              AMINU KANO <span className="text-gradient-gold"> College of Education </span> Management Portal
            </h1>
            <p className="mt-5 text-lg text-white/80 max-w-xl">
              Register courses, upload results, track approvals, view your CGPA and manage the academic life of Aminu
              Kano College of Education — all in one secure place.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/auth" search={{ next: undefined }}>
                <Button size="lg" className="bg-gold text-gold-foreground hover:bg-gold/90">
                  Access portal <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
          <div className="hidden md:grid grid-cols-2 gap-4">
            {[
              { icon: GraduationCap, label: "Students", desc: "Register, view results, print slips" },
              { icon: BookOpen, label: "Lecturers", desc: "Upload CA & exam scores" },
              { icon: Users, label: "HOD / Dean", desc: "Approve semester results" },
              { icon: ShieldCheck, label: "Registry", desc: "Publish & manage records" },
            ].map((c) => (
              <div key={c.label} className="rounded-xl bg-white/10 border border-white/20 backdrop-blur p-5">
                <c.icon className="h-6 w-6 text-gold" />
                <div className="mt-3 font-semibold">{c.label}</div>
                <div className="text-sm text-white/70">{c.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
      </main>

      <footer className="mt-auto border-t bg-background">
        <div className="mx-auto max-w-7xl px-4 py-6 text-sm text-muted-foreground flex justify-between">
          <span>© {new Date().getFullYear()} Aminu Kano College of Education</span>
          <span>AKCOE Portal</span>
        </div>
      </footer>
    </div>
  );
}
