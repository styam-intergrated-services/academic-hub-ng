import { createFileRoute, Link } from "@tanstack/react-router";
import { Mail, MapPin, Globe, LifeBuoy } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const SITE_URL = "https://academic-hub-ng.lovable.app";
const TITLE = "Contact AKCOE — Aminu Kano College of Education Portal";
const DESC =
  "Reach Aminu Kano College of Education, Kano: campus address, email, registry and portal support for students, lecturers and staff.";

export const Route = createFileRoute("/contact")({
  component: ContactPage,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: SITE_URL + "/contact" }],
  }),
});

function ContactPage() {
  return (
    <SiteLayout>
      <section className="bg-hero-gradient text-white">
        <div className="mx-auto max-w-7xl px-4 py-16 md:py-20">
          <span className="inline-block rounded-full bg-white/10 border border-white/20 px-3 py-1 text-xs uppercase tracking-widest">
            Contact us
          </span>
          <h1 className="mt-5 font-serif text-4xl md:text-5xl font-bold leading-tight">Get in touch</h1>
          <p className="mt-5 max-w-2xl text-lg text-white/80">
            Admissions, registry and portal support for Aminu Kano College of Education, Kano.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="flex-row items-center gap-3 space-y-0">
            <MapPin className="h-5 w-5 text-gold" />
            <CardTitle className="text-base">Campus address</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            No. 2 Ruga Kings Garden, behind Total Fueling Station, Airport Road, Kano, Kano State, Nigeria.
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center gap-3 space-y-0">
            <Mail className="h-5 w-5 text-gold" />
            <CardTitle className="text-base">Email</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-1">
            <div><a className="hover:text-primary" href="mailto:info@akcoekano.com">info@akcoekano.com</a></div>
            <div><a className="hover:text-primary" href="mailto:registry@akcoekano.com">registry@akcoekano.com</a></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center gap-3 space-y-0">
            <Globe className="h-5 w-5 text-gold" />
            <CardTitle className="text-base">Online</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <a className="hover:text-primary" href="https://www.akcoekano.com" rel="noreferrer">
              www.akcoekano.com
            </a>
          </CardContent>
        </Card>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16">
        <Card>
          <CardHeader className="flex-row items-center gap-3 space-y-0">
            <LifeBuoy className="h-5 w-5 text-gold" />
            <CardTitle className="font-serif text-primary">Portal support</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              Students sign in with their matriculation number. If you cannot access your account, use
              the “Forgot password” link on the sign-in page or contact the Registry with your matric
              number and full name.
            </p>
            <p>
              Staff accounts (lecturers, HODs, deans, examination officers) are created by the ICT
              unit. Email <a className="hover:text-primary" href="mailto:registry@akcoekano.com">registry@akcoekano.com</a> to
              request access or a role change.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link to="/auth">
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90">Sign in to the portal</Button>
              </Link>
              <Link to="/about">
                <Button variant="outline">About the College</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>
    </SiteLayout>
  );
}
