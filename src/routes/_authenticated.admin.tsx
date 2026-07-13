import { createFileRoute } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useAcademicStructure,
  SessionsSection, SemestersSection, LevelsSection, CoursesSection,
} from "@/components/portal/AcademicStructure";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

function AdminPage() {
  const { data, isLoading } = useAcademicStructure();

  if (isLoading || !data) {
    return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-64" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl text-primary">Administration</h2>
        <p className="text-sm text-muted-foreground">Academic sessions, semesters, levels and the course catalogue.</p>
      </div>
      <Tabs defaultValue="sessions">
        <TabsList>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="semesters">Semesters</TabsTrigger>
          <TabsTrigger value="levels">Levels</TabsTrigger>
          <TabsTrigger value="courses">Courses</TabsTrigger>
        </TabsList>
        <TabsContent value="sessions" className="pt-4"><SessionsSection data={data} /></TabsContent>
        <TabsContent value="semesters" className="pt-4"><SemestersSection data={data} /></TabsContent>
        <TabsContent value="levels" className="pt-4"><LevelsSection data={data} /></TabsContent>
        <TabsContent value="courses" className="pt-4"><CoursesSection data={data} /></TabsContent>
      </Tabs>
    </div>
  );
}
