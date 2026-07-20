// Consistent column mapping for every results export format (CSV/Excel/PDF).
// Change here once, and CSV, Excel, and PDF all follow.

import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { toCsv, downloadCsv } from "@/lib/csv";

export type ExportRow = {
  matric_number: string;
  full_name: string;
  programme: string;
  programme_code: string;
  department: string;
  level: string;
  session: string;
  semester: string;
  course_code: string;
  course_title: string;
  credit_units: number;
  ca_score: number | null;
  exam_score: number | null;
  total_score: number | null;
  grade: string | null;
  grade_point: number | null;
  status: string;
  published_at: string | null;
};

export const EXPORT_COLUMNS: Array<{ key: keyof ExportRow; label: string }> = [
  { key: "matric_number", label: "Matric No." },
  { key: "full_name", label: "Full Name" },
  { key: "programme", label: "Programme" },
  { key: "programme_code", label: "Prog. Code" },
  { key: "department", label: "Department" },
  { key: "level", label: "Level" },
  { key: "session", label: "Session" },
  { key: "semester", label: "Semester" },
  { key: "course_code", label: "Course Code" },
  { key: "course_title", label: "Course Title" },
  { key: "credit_units", label: "Units" },
  { key: "ca_score", label: "CA (40)" },
  { key: "exam_score", label: "Exam (60)" },
  { key: "total_score", label: "Total" },
  { key: "grade", label: "Grade" },
  { key: "grade_point", label: "Pt" },
  { key: "status", label: "Status" },
  { key: "published_at", label: "Published" },
];

function fmtCell(v: unknown): string | number {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return v;
  return String(v);
}

export function exportRowsToCsv(rows: ExportRow[], filename: string) {
  const header = EXPORT_COLUMNS.map((c) => c.label);
  const body = rows.map((r) => EXPORT_COLUMNS.map((c) => fmtCell(r[c.key])));
  downloadCsv(filename, toCsv([header, ...body]));
}

export function exportRowsToXlsx(rows: ExportRow[], filename: string, sheetName = "Results") {
  const aoa: (string | number)[][] = [EXPORT_COLUMNS.map((c) => c.label)];
  for (const r of rows) aoa.push(EXPORT_COLUMNS.map((c) => fmtCell(r[c.key])));
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = EXPORT_COLUMNS.map((c) => ({ wch: Math.min(30, Math.max(c.label.length + 2, 10)) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 30));
  XLSX.writeFile(wb, filename);
}

export function exportRowsToPdf(rows: ExportRow[], opts: { filename: string; title: string; subtitle?: string }) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  doc.setFont("helvetica", "bold").setFontSize(14).text(opts.title, 40, 40);
  if (opts.subtitle) doc.setFont("helvetica", "normal").setFontSize(10).setTextColor(90).text(opts.subtitle, 40, 58);
  doc.setTextColor(0);

  autoTable(doc, {
    startY: opts.subtitle ? 72 : 60,
    head: [EXPORT_COLUMNS.map((c) => c.label)],
    body: rows.map((r) => EXPORT_COLUMNS.map((c) => String(fmtCell(r[c.key])))),
    styles: { fontSize: 7, cellPadding: 3, overflow: "linebreak" },
    headStyles: { fillColor: [15, 42, 90], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 246, 249] },
    margin: { left: 20, right: 20 },
  });

  doc.save(opts.filename);
}

// ========== BROADSHEET (single offering, formal signatories) ==========

export type BroadsheetInput = {
  offering: {
    course: {
      code: string; title: string; credit_units: number;
      department: { name: string; code: string; faculty?: { name: string; code: string } | null };
    };
    semester: { type: string; session?: { name: string } | null };
  };
  lecturers: Array<{ is_lead: boolean; full_name: string }>;
  results: Array<{
    matric_number: string; full_name: string; programme: string;
    ca_score: number | null; exam_score: number | null; total_score: number | null;
    grade: string | null; grade_point: number | null; status: string;
  }>;
};

export function generateBroadsheetPdf(data: BroadsheetInput, filename: string) {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const { offering, lecturers, results } = data;
  const dept = offering.course.department;

  // College header
  doc.setFont("helvetica", "bold").setFontSize(15)
    .text("AMINU KANO COLLEGE OF EDUCATION", pageW / 2, 44, { align: "center" });
  doc.setFontSize(10).setFont("helvetica", "normal")
    .text("Office of the Registrar — Examinations & Records", pageW / 2, 60, { align: "center" });
  doc.setDrawColor(15, 42, 90).setLineWidth(1).line(40, 70, pageW - 40, 70);

  // Faculty / Department / Programme header
  doc.setFontSize(11).setFont("helvetica", "bold")
    .text("COURSE RESULT BROADSHEET", pageW / 2, 90, { align: "center" });

  const meta: Array<[string, string]> = [
    ["Faculty / School", dept.faculty?.name ?? "—"],
    ["Department", dept.name],
    ["Course", `${offering.course.code} — ${offering.course.title}`],
    ["Credit Units", String(offering.course.credit_units)],
    ["Session", offering.semester.session?.name ?? "—"],
    ["Semester", offering.semester.type],
    ["Lecturer(s)", lecturers.length ? lecturers.map((l) => (l.is_lead ? `${l.full_name} (Lead)` : l.full_name)).join(", ") : "—"],
    ["Prepared on", new Date().toLocaleDateString()],
  ];
  autoTable(doc, {
    startY: 100,
    body: meta,
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 2 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 110 } },
    margin: { left: 40, right: 40 },
  });

  // Roster
  const gradeCounts = results.reduce<Record<string, number>>((a, r) => { const g = r.grade ?? "—"; a[g] = (a[g] ?? 0) + 1; return a; }, {});
  const total = results.length;

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 12,
    head: [["S/N", "Matric No.", "Full Name", "Prog.", "CA (40)", "Exam (60)", "Total", "Grade", "Pt"]],
    body: results.map((r, i) => [
      String(i + 1), r.matric_number, r.full_name, r.programme,
      r.ca_score ?? "—", r.exam_score ?? "—", r.total_score ?? "—",
      r.grade ?? "—", r.grade_point ?? "—",
    ]),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [15, 42, 90], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 246, 249] },
    columnStyles: {
      0: { halign: "right", cellWidth: 25 },
      4: { halign: "right" }, 5: { halign: "right" },
      6: { halign: "right" }, 8: { halign: "right" },
    },
    margin: { left: 40, right: 40 },
  });

  // Summary block
  let y = (doc as any).lastAutoTable.finalY + 14;
  doc.setFontSize(9).setFont("helvetica", "bold").text("Grade Distribution", 40, y);
  y += 12;
  doc.setFont("helvetica", "normal");
  const summaryLine = `Total students: ${total}   ·   ` +
    ["A","B","C","D","E","F"].map((g) => `${g}: ${gradeCounts[g] ?? 0}`).join("   ");
  doc.text(summaryLine, 40, y);

  // Signatories
  y += 40;
  const sigCols = [
    { label: "Course Lecturer", name: lecturers.find((l) => l.is_lead)?.full_name ?? lecturers[0]?.full_name ?? "" },
    { label: "Head of Department", name: "" },
    { label: "Dean / Director", name: "" },
    { label: "Registrar", name: "" },
  ];
  const colW = (pageW - 80) / sigCols.length;
  sigCols.forEach((s, i) => {
    const x = 40 + i * colW;
    doc.setDrawColor(0).setLineWidth(0.5).line(x + 10, y, x + colW - 10, y);
    doc.setFontSize(8).setFont("helvetica", "bold").text(s.label, x + colW / 2, y + 12, { align: "center" });
    doc.setFont("helvetica", "normal").setFontSize(8);
    if (s.name) doc.text(s.name, x + colW / 2, y + 24, { align: "center" });
    doc.text("Signature & Date", x + colW / 2, y + 36, { align: "center" });
  });

  // Footer / page number
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFontSize(7).setTextColor(120).text(
      `AKCOE Portal · Broadsheet · Page ${p} of ${pageCount}`,
      pageW / 2, doc.internal.pageSize.getHeight() - 20, { align: "center" }
    );
  }

  doc.save(filename);
}
