import { createFileRoute } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useAcademicStructure,
  FacultiesSection, DepartmentsSection, ProgrammesSection,
} from "@/components/portal/AcademicStructure";

export const Route = createFileRoute("/_authenticated/departments")({
  component: DepartmentsPage,
});

function DepartmentsPage() {
  const { data, isLoading } = useAcademicStructure();

  if (isLoading || !data) {
    return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-64" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl text-primary">Faculties, Departments &amp; Programmes</h2>
        <p className="text-sm text-muted-foreground">Manage the academic org chart.</p>
      </div>
      <Tabs defaultValue="faculties">
        <TabsList>
          <TabsTrigger value="faculties">Faculties</TabsTrigger>
          <TabsTrigger value="departments">Departments</TabsTrigger>
          <TabsTrigger value="programmes">Programmes</TabsTrigger>
        </TabsList>
        <TabsContent value="faculties" className="pt-4"><FacultiesSection data={data} /></TabsContent>
        <TabsContent value="departments" className="pt-4"><DepartmentsSection data={data} /></TabsContent>
        <TabsContent value="programmes" className="pt-4"><ProgrammesSection data={data} /></TabsContent>
      </Tabs>
    </div>
  );
}
