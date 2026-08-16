// Read a tabular score sheet from CSV, Excel (.xlsx/.xls) or Word (.docx).
// Everything runs in the browser and returns a plain string matrix.

import { parseCsv } from "@/lib/csv";

export type SheetTable = { name: string; table: string[][] };

function clean(table: string[][]): string[][] {
  return table
    .map((r) => r.map((c) => (c ?? "").toString().trim()))
    .filter((r) => r.some((c) => c !== ""));
}

async function readText(file: File): Promise<string> {
  return await file.text();
}

async function readExcel(file: File): Promise<SheetTable[]> {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  return wb.SheetNames.map((name) => {
    const rows = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[name]!, {
      header: 1,
      raw: false,
      defval: "",
      blankrows: false,
    });
    return { name, table: clean(rows as unknown as string[][]) };
  }).filter((s) => s.table.length > 0);
}

async function readDocx(file: File): Promise<SheetTable[]> {
  const mammoth = await import("mammoth");
  const buf = await file.arrayBuffer();
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer: buf });
  const doc = new DOMParser().parseFromString(html, "text/html");
  const tables = Array.from(doc.querySelectorAll("table"));
  const out: SheetTable[] = [];
  tables.forEach((t, i) => {
    const table = Array.from(t.querySelectorAll("tr")).map((tr) =>
      Array.from(tr.querySelectorAll("th,td")).map((td) => td.textContent ?? ""),
    );
    const cleaned = clean(table);
    if (cleaned.length > 1) out.push({ name: `Table ${i + 1}`, table: cleaned });
  });
  return out;
}

/** Detects the file type by extension and returns every usable table it holds. */
export async function readTabularFile(file: File): Promise<SheetTable[]> {
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  if (ext === "xlsx" || ext === "xls" || ext === "xlsm") return readExcel(file);
  if (ext === "docx") return readDocx(file);
  if (ext === "csv" || ext === "txt") {
    const table = clean(parseCsv(await readText(file)));
    return table.length ? [{ name: "CSV", table }] : [];
  }
  throw new Error("Unsupported file type — upload a .csv, .xlsx or .docx file");
}
