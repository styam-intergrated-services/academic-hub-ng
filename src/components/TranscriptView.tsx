import akceLogo from "@/assets/akce-logo.asset.json";

export function TranscriptView({ data, official, serial }: { data: any; official: boolean; serial?: string | null }) {
  const { student, profile, semesters, totals } = data;
  return (
    <div className="print-sheet relative">
      {!official && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-0">
          <div className="rotate-[-30deg] text-6xl md:text-8xl font-serif font-bold text-black/5 select-none whitespace-nowrap">
            UNOFFICIAL · STUDENT COPY
          </div>
        </div>
      )}
      <div className="relative z-10">
        <header className="text-center border-b-2 border-black pb-3 mb-4">
          <div className="flex items-center justify-center gap-3">
            <img src={akceLogo.url} alt="AKCOE" className="h-16 w-16 object-contain" />
            <div>
              <h1 className="font-serif text-xl font-bold tracking-wide">AMINU KANO COLLEGE OF EDUCATION</h1>
              <div className="text-[11px] uppercase tracking-widest">Office of the Registrar</div>
              <div className="text-[11px] mt-1">
                {official ? "Official Academic Transcript" : "Academic Transcript (Unofficial)"}
              </div>
              {serial && <div className="text-[10px] mt-0.5 font-mono">Serial: {serial}</div>}
            </div>
          </div>
        </header>

        <section className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs mb-4">
          <div><b>Full name:</b> <span className="uppercase">{profile?.full_name ?? "—"}</span></div>
          <div><b>Matric No.:</b> {student.matric_number}</div>
          <div><b>Date of birth:</b> {profile?.date_of_birth ?? "—"}</div>
          <div><b>Gender:</b> <span className="capitalize">{profile?.gender ?? "—"}</span></div>
          <div><b>State of origin:</b> {profile?.state_of_origin ?? "—"}</div>
          <div><b>Entry year:</b> {student.entry_year ?? "—"}</div>
          <div className="col-span-2"><b>Programme:</b> {student.programme?.name ?? "—"}</div>
          <div><b>School:</b> {student.department?.faculty?.name ?? "—"}</div>
          <div><b>Department:</b> {student.department?.name ?? "—"}</div>
          <div><b>Current level:</b> {student.current_level?.name ?? "—"}</div>
          <div><b>Status:</b> <span className="capitalize">{student.is_active ? "Active" : "Inactive"}</span></div>
        </section>

        {semesters.length === 0 ? (
          <div className="border border-black p-6 text-center text-xs italic">No published results on record.</div>
        ) : semesters.map((s: any) => (
          <div key={s.semester_id} className="mb-4 avoid-break">
            <div className="bg-black text-white px-2 py-1 text-xs font-bold uppercase tracking-wider">
              {s.session_name} — <span className="capitalize">{s.semester_type}</span> Semester
            </div>
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  <th className="border border-black p-1 text-left w-24">Code</th>
                  <th className="border border-black p-1 text-left">Course Title</th>
                  <th className="border border-black p-1 text-right w-14">Units</th>
                  <th className="border border-black p-1 text-center w-14">Grade</th>
                  <th className="border border-black p-1 text-right w-14">Point</th>
                  <th className="border border-black p-1 text-right w-16">Weighted</th>
                </tr>
              </thead>
              <tbody>
                {s.rows.map((r: any, i: number) => (
                  <tr key={i}>
                    <td className="border border-black p-1 font-mono">{r.code}</td>
                    <td className="border border-black p-1">{r.title}</td>
                    <td className="border border-black p-1 text-right font-mono">{r.units}</td>
                    <td className="border border-black p-1 text-center font-bold">{r.grade}</td>
                    <td className="border border-black p-1 text-right font-mono">{Number(r.grade_point).toFixed(1)}</td>
                    <td className="border border-black p-1 text-right font-mono">{(r.units * r.grade_point).toFixed(1)}</td>
                  </tr>
                ))}
                <tr className="bg-muted/30 font-bold">
                  <td className="border border-black p-1" colSpan={2}>Semester totals</td>
                  <td className="border border-black p-1 text-right font-mono">{s.tcu}</td>
                  <td className="border border-black p-1 text-center">GPA</td>
                  <td className="border border-black p-1 text-right font-mono">{s.gpa.toFixed(2)}</td>
                  <td className="border border-black p-1 text-right font-mono">CGPA {s.running_cgpa.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ))}

        <section className="mt-6 border-2 border-black p-3 text-xs grid grid-cols-4 gap-2 avoid-break">
          <div><div className="text-[10px] uppercase">Total Credit Units</div><div className="font-serif text-lg font-bold">{totals.credit_units}</div></div>
          <div><div className="text-[10px] uppercase">Total Grade Points</div><div className="font-serif text-lg font-bold">{totals.grade_points.toFixed(1)}</div></div>
          <div><div className="text-[10px] uppercase">CGPA</div><div className="font-serif text-lg font-bold">{totals.cgpa.toFixed(2)}</div></div>
          <div><div className="text-[10px] uppercase">Class of Result</div><div className="font-serif text-lg font-bold">{totals.class_of_result}</div></div>
        </section>

        <section className="mt-8 text-xs">
          <div className="text-[10px] mb-4">
            Grading scale: A (75–100) 5.0 · B (65–74) 4.0 · C (55–64) 3.0 · D (45–54) 2.0 · E (40–44) 1.0 · F (0–39) 0.0.
            Class of result: Distinction (≥4.50), Credit (≥3.50), Merit (≥2.50), Pass (≥1.00).
          </div>
          {official ? (
            <div className="grid grid-cols-2 gap-8 mt-6">
              <SignatoryBlock label="Registrar" />
              <SignatoryBlock label="Provost" />
              <div>
                <div className="text-[10px] uppercase tracking-widest">Date issued</div>
                <div>{new Date().toLocaleDateString()}</div>
              </div>
            </div>
          ) : (
            <div className="italic text-muted-foreground">
              This is an unofficial student copy. Official transcripts bear the Registrar's signature and a serial number issued by the Office of the Registrar.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function SignatoryBlock({ label }: { label: string }) {
  return (
    <div>
      <div className="h-10 border-b border-black" />
      <div className="mt-1 text-[10px] uppercase tracking-widest">{label}</div>
    </div>
  );
}
