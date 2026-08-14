/**
 * Client-side bulk export of result data to PDF and DOCX.
 *
 * A neutral document model (title + sections of tables) is rendered either
 * through jsPDF/autoTable or the `docx` package, so the same builders feed both
 * formats. Many-student exports are packaged into a zip with JSZip.
 */

export type ExportColumn = { header: string; align?: "left" | "right" | "center"; width?: number };

export type ExportSection = {
  heading?: string;
  subheading?: string;
  lines?: string[];
  columns?: ExportColumn[];
  rows?: (string | number | null | undefined)[][];
};

export type ExportDoc = {
  title: string;
  subtitle?: string;
  sections: ExportSection[];
};

const COLLEGE = "AMINU KANO COLLEGE OF EDUCATION";

const cell = (v: string | number | null | undefined) =>
  v === null || v === undefined || v === "" ? "—" : String(v);

/* ------------------------------- PDF -------------------------------- */

export async function buildPdfBlob(doc: ExportDoc): Promise<Blob> {
  const [{ jsPDF }, autoTableMod] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const autoTable = (autoTableMod as unknown as { default: (pdf: unknown, opts: unknown) => void }).default;

  const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
  const margin = 36;
  let y = margin;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(13);
  pdf.text(COLLEGE, pdf.internal.pageSize.getWidth() / 2, y, { align: "center" });
  y += 16;
  pdf.setFontSize(11);
  pdf.text(doc.title, pdf.internal.pageSize.getWidth() / 2, y, { align: "center" });
  y += 14;
  if (doc.subtitle) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.text(doc.subtitle, pdf.internal.pageSize.getWidth() / 2, y, { align: "center" });
    y += 14;
  }

  for (const section of doc.sections) {
    if (y > pdf.internal.pageSize.getHeight() - 120) {
      pdf.addPage();
      y = margin;
    }
    if (section.heading) {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.text(section.heading, margin, y);
      y += 13;
    }
    if (section.subheading) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8.5);
      pdf.text(section.subheading, margin, y);
      y += 12;
    }
    for (const line of section.lines ?? []) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8.5);
      pdf.text(line, margin, y);
      y += 11;
    }
    if (section.columns?.length && section.rows?.length) {
      autoTable(pdf, {
        startY: y + 2,
        margin: { left: margin, right: margin },
        head: [section.columns.map((c) => c.header)],
        body: section.rows.map((r) => r.map(cell)),
        styles: { fontSize: 7.6, cellPadding: 3 },
        headStyles: { fillColor: [15, 23, 42], textColor: 255 },
        columnStyles: Object.fromEntries(
          section.columns.map((c, i) => [i, { halign: c.align ?? "left" }]),
        ),
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      y = ((pdf as any).lastAutoTable?.finalY ?? y) + 16;
    } else {
      y += 4;
    }
  }

  return pdf.output("blob");
}

/* ------------------------------- DOCX ------------------------------- */

export async function buildDocxBlob(doc: ExportDoc): Promise<Blob> {
  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    Table,
    TableRow,
    TableCell,
    AlignmentType,
    WidthType,
    ShadingType,
    BorderStyle,
    HeadingLevel,
  } = await import("docx");

  const border = { style: BorderStyle.SINGLE, size: 1, color: "999999" };
  const borders = { top: border, bottom: border, left: border, right: border };
  const CONTENT_WIDTH = 9360;

  const children: object[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: COLLEGE, bold: true, size: 28 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: doc.title, bold: true, size: 24 })],
    }),
  ];
  if (doc.subtitle) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: doc.subtitle, size: 18 })],
      }),
    );
  }

  for (const section of doc.sections) {
    if (section.heading) {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 240, after: 80 },
          children: [new TextRun({ text: section.heading, bold: true, size: 22 })],
        }),
      );
    }
    if (section.subheading) {
      children.push(new Paragraph({ children: [new TextRun({ text: section.subheading, size: 18 })] }));
    }
    for (const line of section.lines ?? []) {
      children.push(new Paragraph({ children: [new TextRun({ text: line, size: 18 })] }));
    }
    if (section.columns?.length && section.rows?.length) {
      const cols = section.columns;
      const totalWeight = cols.reduce((a, c) => a + (c.width ?? 1), 0);
      const widths = cols.map((c) => Math.floor((CONTENT_WIDTH * (c.width ?? 1)) / totalWeight));
      widths[widths.length - 1] = CONTENT_WIDTH - widths.slice(0, -1).reduce((a, b) => a + b, 0);

      const mkCell = (text: string, i: number, head: boolean) =>
        new TableCell({
          borders,
          width: { size: widths[i], type: WidthType.DXA },
          margins: { top: 60, bottom: 60, left: 100, right: 100 },
          shading: head ? { fill: "E7E5E4", type: ShadingType.CLEAR, color: "auto" } : undefined,
          children: [
            new Paragraph({
              alignment:
                cols[i].align === "right"
                  ? AlignmentType.RIGHT
                  : cols[i].align === "center"
                    ? AlignmentType.CENTER
                    : AlignmentType.LEFT,
              children: [new TextRun({ text, bold: head, size: 16 })],
            }),
          ],
        });

      children.push(
        new Table({
          width: { size: CONTENT_WIDTH, type: WidthType.DXA },
          columnWidths: widths,
          rows: [
            new TableRow({ children: cols.map((c, i) => mkCell(c.header, i, true)) }),
            ...section.rows.map(
              (r) => new TableRow({ children: cols.map((_, i) => mkCell(cell(r[i]), i, false)) }),
            ),
          ],
        }),
      );
      children.push(new Paragraph({ children: [] }));
    }
  }

  const document = new Document({
    styles: { default: { document: { run: { font: "Arial", size: 20 } } } },
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        children: children as any,
      },
    ],
  });

  return Packer.toBlob(document);
}

/* ---------------------------- delivery ------------------------------ */

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function downloadZip(files: { name: string; blob: Blob }[], zipName: string) {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  for (const f of files) zip.file(f.name, f.blob);
  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  downloadBlob(blob, zipName.endsWith(".zip") ? zipName : `${zipName}.zip`);
}

export const safeName = (s: string) => s.replace(/[^\w.-]+/g, "_").replace(/_+/g, "_").slice(0, 80);

export async function renderDoc(doc: ExportDoc, format: "pdf" | "docx"): Promise<Blob> {
  return format === "pdf" ? buildPdfBlob(doc) : buildDocxBlob(doc);
}

/* -------------------- result-specific builders ---------------------- */

export type ResultExportRow = {
  session_name: string;
  semester_label: string;
  department_name: string;
  level_name: string;
  course_code: string;
  course_title: string;
  credit_units: number;
  matric_number: string;
  student_name: string;
  programme_name?: string | null;
  ca_score: number | null;
  exam_score: number | null;
  total_score: number | null;
  grade: string | null;
  grade_point: number | null;
  status_code?: string;
};

const BROADSHEET_COLUMNS: ExportColumn[] = [
  { header: "S/N", align: "right", width: 0.6 },
  { header: "Matric No.", width: 2.6 },
  { header: "Name", width: 3.2 },
  { header: "CA /40", align: "right", width: 0.9 },
  { header: "Exam /60", align: "right", width: 1 },
  { header: "Total", align: "right", width: 0.9 },
  { header: "Grade", align: "center", width: 0.8 },
  { header: "Point", align: "right", width: 0.8 },
];

/** Combined broadsheet: department → level → course, one table per course. */
export function buildBroadsheetDoc(rows: ResultExportRow[], scopeLabel?: string): ExportDoc {
  const groups = new Map<string, { heading: string; sub: string; rows: ResultExportRow[] }>();
  for (const r of rows) {
    const key = `${r.department_name}|${r.level_name}|${r.session_name}|${r.semester_label}|${r.course_code}`;
    const g =
      groups.get(key) ??
      {
        heading: `${r.department_name} · ${r.level_name} · ${r.course_code} — ${r.course_title}`,
        sub: `${r.session_name} · ${r.semester_label} · ${r.credit_units} credit unit(s)`,
        rows: [],
      };
    g.rows.push(r);
    groups.set(key, g);
  }

  const sections: ExportSection[] = Array.from(groups.values())
    .sort((a, b) => a.heading.localeCompare(b.heading))
    .map((g) => {
      const sorted = [...g.rows].sort((a, b) => a.matric_number.localeCompare(b.matric_number));
      const scored = sorted.filter((r) => r.total_score != null);
      const avg = scored.length
        ? scored.reduce((a, r) => a + Number(r.total_score), 0) / scored.length
        : 0;
      const passed = sorted.filter((r) => (r.grade_point ?? 0) > 0).length;
      return {
        heading: g.heading,
        subheading: g.sub,
        lines: [
          `Registered: ${sorted.length} · Passed: ${passed} · Failed: ${sorted.length - passed} · Average score: ${avg.toFixed(1)}`,
        ],
        columns: BROADSHEET_COLUMNS,
        rows: sorted.map((r, i) => [
          i + 1,
          r.matric_number,
          r.student_name.toUpperCase(),
          r.ca_score,
          r.exam_score,
          r.total_score,
          r.grade,
          r.grade_point != null ? Number(r.grade_point).toFixed(1) : null,
        ]),
      } satisfies ExportSection;
    });

  return {
    title: "Course Broadsheet",
    subtitle: [scopeLabel, `${rows.length.toLocaleString()} result records`, new Date().toLocaleDateString()]
      .filter(Boolean)
      .join(" · "),
    sections,
  };
}

const SLIP_COLUMNS: ExportColumn[] = [
  { header: "Code", width: 1.4 },
  { header: "Course title", width: 4 },
  { header: "CU", align: "right", width: 0.6 },
  { header: "CA", align: "right", width: 0.7 },
  { header: "Exam", align: "right", width: 0.8 },
  { header: "Total", align: "right", width: 0.8 },
  { header: "Grade", align: "center", width: 0.8 },
  { header: "Point", align: "right", width: 0.8 },
];

/** One student's result slip, grouped by session + semester with GPA per block. */
export function buildStudentSlipDoc(rows: ResultExportRow[]): ExportDoc {
  const first = rows[0];
  const blocks = new Map<string, ResultExportRow[]>();
  for (const r of rows) {
    const key = `${r.session_name} · ${r.semester_label}`;
    blocks.set(key, [...(blocks.get(key) ?? []), r]);
  }

  let cumUnits = 0;
  let cumPoints = 0;
  const sections: ExportSection[] = [];
  for (const [label, list] of Array.from(blocks.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
    const counted = list.filter((r) => r.grade_point != null && (r.credit_units ?? 0) > 0);
    const units = counted.reduce((a, r) => a + Number(r.credit_units), 0);
    const points = counted.reduce((a, r) => a + Number(r.credit_units) * Number(r.grade_point), 0);
    cumUnits += units;
    cumPoints += points;
    sections.push({
      heading: label,
      lines: [
        `Credit units: ${units} · Points: ${points.toFixed(1)} · GPA: ${(units ? points / units : 0).toFixed(2)} · CGPA: ${(cumUnits ? cumPoints / cumUnits : 0).toFixed(2)}`,
      ],
      columns: SLIP_COLUMNS,
      rows: list.map((r) => [
        r.course_code,
        r.course_title,
        r.credit_units,
        r.ca_score,
        r.exam_score,
        r.total_score,
        r.grade,
        r.grade_point != null ? Number(r.grade_point).toFixed(1) : null,
      ]),
    });
  }

  return {
    title: "Statement of Results",
    subtitle: [
      first?.student_name?.toUpperCase(),
      first?.matric_number,
      first?.programme_name ?? first?.department_name,
      first?.level_name,
    ]
      .filter(Boolean)
      .join(" · "),
    sections,
  };
}

/** Export one file per student, zipped when there is more than one. */
export async function exportPerStudent(
  rows: ResultExportRow[],
  format: "pdf" | "docx",
  zipName: string,
): Promise<number> {
  const byStudent = new Map<string, ResultExportRow[]>();
  for (const r of rows) {
    const key = r.matric_number || r.student_name;
    byStudent.set(key, [...(byStudent.get(key) ?? []), r]);
  }

  const entries = Array.from(byStudent.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  if (entries.length === 0) return 0;

  if (entries.length === 1) {
    const [key, list] = entries[0];
    const blob = await renderDoc(buildStudentSlipDoc(list), format);
    downloadBlob(blob, `${safeName(key)}-results.${format}`);
    return 1;
  }

  const files: { name: string; blob: Blob }[] = [];
  for (const [key, list] of entries) {
    const blob = await renderDoc(buildStudentSlipDoc(list), format);
    files.push({ name: `${safeName(key)}-results.${format}`, blob });
  }
  await downloadZip(files, zipName);
  return files.length;
}
