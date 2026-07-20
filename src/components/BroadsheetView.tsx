import akceLogo from "@/assets/akce-logo.asset.json";

export function BroadsheetView({ data }: { data: any }) {
  const { offering, department, lecturers, results, summary } = data;
  const leadLecturer = lecturers.find((l: any) => l.is_lead) ?? lecturers[0];
  return (
    <div className="print-sheet">
      <header className="text-center border-b-2 border-black pb-3 mb-4">
        <div className="flex items-center justify-center gap-3">
          <img src={akceLogo.url} alt="AKCOE" className="h-16 w-16 object-contain" />
          <div>
            <h1 className="font-serif text-xl font-bold tracking-wide">AMINU KANO COLLEGE OF EDUCATION</h1>
            <div className="text-[11px] uppercase tracking-widest">Office of the Registrar</div>
            <div className="text-[11px] mt-1">Course Broadsheet</div>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs mb-3">
        <div><b>School:</b> {department?.faculty?.name ?? "—"}</div>
        <div><b>Department:</b> {department?.name ?? "—"}</div>
        <div><b>Course code:</b> {offering.course.code}</div>
        <div><b>Credit units:</b> {offering.course.credit_units}</div>
        <div className="col-span-2"><b>Course title:</b> {offering.course.title}</div>
        <div><b>Level:</b> {offering.course.level?.name ?? "—"}</div>
        <div><b>Semester:</b> <span className="capitalize">{offering.semester.type}</span> · {offering.semester.session?.name}</div>
      </section>

      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="bg-black text-white">
            <th className="border border-black p-1 text-left w-10">S/N</th>
            <th className="border border-black p-1 text-left">Matric No.</th>
            <th className="border border-black p-1 text-left">Name</th>
            <th className="border border-black p-1 text-right w-14">CA /40</th>
            <th className="border border-black p-1 text-right w-16">Exam /60</th>
            <th className="border border-black p-1 text-right w-16">Total /100</th>
            <th className="border border-black p-1 text-center w-12">Grade</th>
            <th className="border border-black p-1 text-right w-14">Point</th>
          </tr>
        </thead>
        <tbody>
          {results.length === 0 ? (
            <tr><td colSpan={8} className="border border-black p-4 text-center italic">No published results.</td></tr>
          ) : results.map((r: any, i: number) => (
            <tr key={r.id}>
              <td className="border border-black p-1">{i + 1}</td>
              <td className="border border-black p-1 font-mono">{r.student.matric_number}</td>
              <td className="border border-black p-1 uppercase">{r.student.profile?.full_name}</td>
              <td className="border border-black p-1 text-right font-mono">{r.ca_score ?? "—"}</td>
              <td className="border border-black p-1 text-right font-mono">{r.exam_score ?? "—"}</td>
              <td className="border border-black p-1 text-right font-mono">{r.total_score ?? "—"}</td>
              <td className="border border-black p-1 text-center font-bold">{r.grade ?? "—"}</td>
              <td className="border border-black p-1 text-right font-mono">{Number(r.grade_point ?? 0).toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {results.length > 0 && (
        <section className="mt-4 text-xs">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="font-bold mb-1">Summary</div>
              <div>Registered: {summary.count}</div>
              <div>Passed: {summary.passed}</div>
              <div>Failed: {summary.failed}</div>
            </div>
            <div>
              <div className="font-bold mb-1">Scores</div>
              <div>Average: {summary.average.toFixed(1)}</div>
              <div>Highest: {summary.highest.toFixed(1)}</div>
              <div>Lowest: {summary.lowest.toFixed(1)}</div>
            </div>
            <div>
              <div className="font-bold mb-1">Grade distribution</div>
              <div className="grid grid-cols-6 gap-1 text-center">
                {["A","B","C","D","E","F"].map((g) => (
                  <div key={g} className="border border-black px-1">
                    <div className="font-bold">{g}</div>
                    <div>{summary.grade_distribution[g]}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="mt-8 grid grid-cols-2 gap-8 text-xs">
        <SignatoryBlock label="Course Lecturer" name={leadLecturer?.lecturer?.full_name} />
        <SignatoryBlock label="Head of Department" />
        <SignatoryBlock label="Dean of School" />
        <SignatoryBlock label="Registrar" />
        <SignatoryBlock label="Provost" />
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Date printed</div>
          <div>{new Date().toLocaleDateString()}</div>
        </div>
      </section>
    </div>
  );
}

function SignatoryBlock({ label, name }: { label: string; name?: string | null }) {
  return (
    <div>
      <div className="h-10 border-b border-black" />
      <div className="mt-1 text-[10px] uppercase tracking-widest">{label}</div>
      {name && <div className="text-xs">{name}</div>}
    </div>
  );
}
