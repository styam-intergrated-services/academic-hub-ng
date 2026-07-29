import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const SITE_URL = "https://academic-hub-ng.lovable.app";
const TITLE = "About AKCOE — Aminu Kano College of Education, Kano";
const DESC =
  "Vision, mission, core values and academic structure of Aminu Kano College of Education, Kano — NCE, diploma and FUDMA-affiliated degree programmes.";

export const Route = createFileRoute("/about")({
  component: AboutPage,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: SITE_URL + "/about" }],
  }),
});

const SCHOOLS: { name: string; departments: string[] }[] = [
  {
    name: "School of Education",
    departments: [
      "Education Foundations",
      "Curriculum Studies",
      "Educational Psychology",
      "General Studies",
      "Educational Administration and Planning",
      "Human Kinetics and Health Education",
    ],
  },
  { name: "School of Languages", departments: ["Arabic Language", "English Language", "Hausa Language"] },
  {
    name: "School of Arts and Social Sciences",
    departments: ["Islamic Studies", "Social Studies", "Mass Communication", "Law", "Public Administration"],
  },
  {
    name: "School of Sciences",
    departments: [
      "Computer Science",
      "Mathematics",
      "Biology",
      "Chemistry",
      "Physics",
      "Integrated Science",
      "Sociology",
    ],
  },
  {
    name: "School of Vocational and Technical Education",
    departments: ["Business Education", "Business Management", "Accountancy"],
  },
  { name: "School of Early Childhood Care and Primary Education", departments: ["Primary Education"] },
];

const VALUES = [
  "Upgrade professional skills in teachers",
  "Ensure high quality education at the basic level for nation building",
  "Provide equal opportunity for educational pursuit",
  "Produce highly disciplined teachers",
  "Inculcate a sense of responsibility in our students",
];

function AboutPage() {
  return (
    <SiteLayout>
      <section className="bg-hero-gradient text-white">
        <div className="mx-auto max-w-7xl px-4 py-16 md:py-20">
          <span className="inline-block rounded-full bg-white/10 border border-white/20 px-3 py-1 text-xs uppercase tracking-widest">
            About the College
          </span>
          <h1 className="mt-5 font-serif text-4xl md:text-5xl font-bold leading-tight">
            Aminu Kano College of Education, Kano
          </h1>
          <p className="mt-5 max-w-3xl text-lg text-white/80">
            A community-owned teacher training institution in Kano State, offering NCE, diploma and
            degree programmes in affiliation with Federal University Dutsin-Ma (FUDMA).
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="font-serif text-primary">Vision</CardTitle></CardHeader>
          <CardContent className="text-muted-foreground">
            To be the leading community-owned teacher training institution in Northern Nigeria.
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="font-serif text-primary">Mission</CardTitle></CardHeader>
          <CardContent className="text-muted-foreground">
            To develop, organize and support research, teacher training and retraining in enhancing
            literacy and academic development in our community.
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader><CardTitle className="font-serif text-primary">Core values</CardTitle></CardHeader>
          <CardContent>
            <ul className="grid gap-2 sm:grid-cols-2 text-muted-foreground list-disc pl-5">
              {VALUES.map((v) => <li key={v}>{v}</li>)}
            </ul>
          </CardContent>
        </Card>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16">
        <h2 className="font-serif text-2xl text-primary">Schools &amp; departments</h2>
        <p className="text-sm text-muted-foreground">
          As set out in the College Academic Brief (May 2024).
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {SCHOOLS.map((s) => (
            <Card key={s.name}>
              <CardHeader><CardTitle className="text-base">{s.name}</CardTitle></CardHeader>
              <CardContent>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {s.departments.map((d) => <li key={d}>{d}</li>)}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader><CardTitle className="text-base">NCE programmes</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              27 double-major and combined NCE teaching programmes across languages, sciences,
              Islamic studies, social studies, business and primary education.
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Diploma programmes</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Computer Science, Mass Communication, Account &amp; Audit, Law, Business Administration
              and Public Administration.
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Degree programmes (FUDMA)</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              B.Ed. Administration and Planning, B.Ed. Guidance and Counselling, B.A. (Ed) English,
              B.A. (Ed) Languages, B.A. Hausa, B.A. Arabic, B.A. Islamic Studies, B.Sc. (Ed) Computer,
              B.Sc. Human Kinetics, B.Sc. Sociology and B.Sc. Business Management.
            </CardContent>
          </Card>
        </div>
      </section>
    </SiteLayout>
  );
}
