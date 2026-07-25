import { getLecturerTeachingCount, type PortalUser } from "@/lib/portal.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BookOpen, FileCheck2, Users } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

export function LecturerDashboard({ user }: { user: PortalUser }) {
  const teachingFn = useServerFn(getLecturerTeachingCount);
  const { data, isLoading } = useQuery({
    queryKey: ["portal", "lecturer-teaching-count", user.id],
    queryFn: () => teachingFn(),
    staleTime: 30_000,
  });
  const n = data?.count ?? 0;

  return (
    <div className="space-y-6">
      <section className="rounded-xl bg-hero-gradient p-6 text-white shadow-elegant md:p-8">
        <div className="text-[10px] uppercase tracking-widest text-white/70">Lecturer Portal</div>
        <h1 className="mt-2 font-serif text-2xl font-bold sm:text-3xl md:text-4xl">
          Good day, {user.full_name ?? "Lecturer"}
        </h1>
        <p className="mt-2 max-w-xl text-sm text-white/80">
          Upload continuous assessment and exam scores, then submit for approval.
        </p>
      </section>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <StatCard icon={BookOpen} label="Courses teaching" value={isLoading ? "…" : n} accent />
        <StatCard icon={Users} label="Semester" value="Current" hint="Active session" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-serif">My teaching</CardTitle>
            <CardDescription>Assigned courses this semester</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {isLoading
                ? "Loading your assignments…"
                : n > 0
                  ? `You are teaching ${n} course${n === 1 ? "" : "s"} this semester.`
                  : "No courses assigned yet. They will appear here once Registry links you."}
            </p>
            <Link to="/teaching"><Button variant="secondary"><BookOpen className="mr-2 size-4" />Open teaching</Button></Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-serif">Result submission</CardTitle>
            <CardDescription>Draft → Submit → HOD → Dean → Registry → Published</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Link to="/upload-results"><Button className="w-full justify-start" variant="secondary"><FileCheck2 className="mr-2 size-4" />Upload results</Button></Link>
            <Link to="/teaching"><Button className="w-full justify-start" variant="secondary"><Users className="mr-2 size-4" />View classes</Button></Link>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="font-serif">Approval workflow</CardTitle></CardHeader>
        <CardContent>
          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {["Lecturer submits","HOD approves","Dean approves","Registry approves","Published to students"].map((s, i) => (
              <li key={s} className="rounded-lg border bg-muted/40 p-3">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Step {i + 1}</div>
                <div className="mt-0.5 text-sm font-medium">{s}</div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

