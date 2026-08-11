import { describe, it, expect } from "vitest";
import {
  buildSemesterBlocks,
  classifyCgpa,
  gradePointFromTotal,
  resolveGradePoint,
  resolveUnits,
  type PublishedResultRow,
} from "@/lib/gpa-calc";

type RowInput = {
  code?: string;
  units?: number | string | null;
  gp?: number | null;
  grade?: string | null;
  total?: number | null;
  status_code?: string | null;
  semId: string;
  type: "first" | "second";
  session: string;
  start: string;
};

const row = (r: RowInput): PublishedResultRow => ({
  ca_score: 30,
  exam_score: 50,
  total_score: r.total === undefined ? 80 : r.total,
  grade: r.grade === undefined ? "A" : r.grade,
  grade_point: r.gp === undefined ? 5 : r.gp,
  status_code: r.status_code ?? "OK",
  offering: {
    course: {
      code: r.code ?? "CRS 101",
      title: "Course",
      credit_units: r.units === undefined ? 2 : (r.units as number),
    },
    semester: {
      id: r.semId,
      type: r.type,
      session: { name: r.session, start_date: r.start },
    },
  },
});

/** Independent reference implementation of the transcript formula. */
const referenceGpa = (rows: Array<{ units: number; gp: number }>) => {
  const u = rows.reduce((a, b) => a + b.units, 0);
  const p = rows.reduce((a, b) => a + b.units * b.gp, 0);
  return u > 0 ? Math.round((p / u) * 100) / 100 : 0;
};

describe("grade point helpers", () => {
  it("maps totals to the 5-point NCE scale", () => {
    expect(gradePointFromTotal(100)).toBe(5);
    expect(gradePointFromTotal(70)).toBe(5);
    expect(gradePointFromTotal(69)).toBe(4);
    expect(gradePointFromTotal(50)).toBe(3);
    expect(gradePointFromTotal(45)).toBe(2);
    expect(gradePointFromTotal(40)).toBe(1);
    expect(gradePointFromTotal(39)).toBe(0);
    expect(gradePointFromTotal(null)).toBeNull();
  });

  it("prefers stored grade point, then letter grade, then total", () => {
    expect(resolveGradePoint(3, "A", 90)).toBe(3);
    expect(resolveGradePoint(null, "B", 90)).toBe(4);
    expect(resolveGradePoint(null, null, 55)).toBe(3);
    expect(resolveGradePoint(null, null, null)).toBeNull();
    expect(resolveGradePoint(0, null, 90)).toBe(0);
  });

  it("treats missing or non-positive credit units as unknown", () => {
    expect(resolveUnits(3)).toBe(3);
    expect(resolveUnits("2")).toBe(2);
    expect(resolveUnits(0)).toBeNull();
    expect(resolveUnits(-1)).toBeNull();
    expect(resolveUnits(null)).toBeNull();
    expect(resolveUnits("abc")).toBeNull();
  });
});

describe("buildSemesterBlocks", () => {
  it("computes per-semester GPA matching the transcript formula", () => {
    const { semesters, cgpa } = buildSemesterBlocks([
      row({ semId: "s1", type: "first", session: "2021/2022", start: "2021-09-01", units: 3, gp: 5 }),
      row({ semId: "s1", type: "first", session: "2021/2022", start: "2021-09-01", units: 2, gp: 3 }),
    ]);
    expect(semesters).toHaveLength(1);
    expect(semesters[0].tcu).toBe(5);
    expect(semesters[0].tgp).toBe(21);
    expect(semesters[0].gpa).toBe(referenceGpa([{ units: 3, gp: 5 }, { units: 2, gp: 3 }]));
    expect(cgpa).toBe(4.2);
  });

  it("orders first before second semester and accumulates a running CGPA", () => {
    const { semesters, cgpa, cumUnits, cumPoints } = buildSemesterBlocks([
      row({ semId: "s2", type: "second", session: "2021/2022", start: "2021-09-01", units: 2, gp: 3 }),
      row({ semId: "s1", type: "first", session: "2021/2022", start: "2021-09-01", units: 2, gp: 5 }),
    ]);
    expect(semesters.map((s) => s.semester_type)).toEqual(["first", "second"]);
    expect(semesters[0].running_cgpa).toBe(5);
    expect(semesters[1].running_cgpa).toBe(4);
    expect(cumUnits).toBe(4);
    expect(cumPoints).toBe(16);
    expect(cgpa).toBe(referenceGpa([{ units: 2, gp: 5 }, { units: 2, gp: 3 }]));
  });

  it("orders mixed sessions chronologically by session start date", () => {
    const { semesters, cgpa } = buildSemesterBlocks([
      row({ semId: "b2", type: "second", session: "2022/2023", start: "2022-09-01", units: 3, gp: 4 }),
      row({ semId: "a1", type: "first", session: "2021/2022", start: "2021-09-01", units: 2, gp: 5 }),
      row({ semId: "b1", type: "first", session: "2022/2023", start: "2022-09-01", units: 2, gp: 2 }),
      row({ semId: "a2", type: "second", session: "2021/2022", start: "2021-09-01", units: 3, gp: 3 }),
    ]);
    expect(semesters.map((s) => `${s.session_name}:${s.semester_type}`)).toEqual([
      "2021/2022:first",
      "2021/2022:second",
      "2022/2023:first",
      "2022/2023:second",
    ]);
    expect(semesters[semesters.length - 1].running_cgpa).toBe(cgpa);
    expect(cgpa).toBe(
      referenceGpa([
        { units: 2, gp: 5 },
        { units: 3, gp: 3 },
        { units: 2, gp: 2 },
        { units: 3, gp: 4 },
      ]),
    );
  });

  it("keeps rows with missing units/grade point visible but out of the GPA", () => {
    const { semesters, cgpa } = buildSemesterBlocks([
      row({ semId: "s1", type: "first", session: "2021/2022", start: "2021-09-01", units: 2, gp: 5 }),
      row({ code: "BAD 101", semId: "s1", type: "first", session: "2021/2022", start: "2021-09-01", units: null, gp: null, grade: null, total: null }),
    ]);
    expect(semesters[0].rows).toHaveLength(2);
    expect(semesters[0].rows.find((r) => r.code === "BAD 101")?.excluded).toBe(true);
    expect(semesters[0].excluded_count).toBe(1);
    expect(semesters[0].tcu).toBe(2);
    expect(semesters[0].gpa).toBe(5);
    expect(cgpa).toBe(5);
  });

  it("recovers a grade point from the total score when it is missing", () => {
    const { semesters } = buildSemesterBlocks([
      row({ semId: "s1", type: "first", session: "2021/2022", start: "2021-09-01", units: 2, gp: null, grade: null, total: 64 }),
    ]);
    expect(semesters[0].rows[0].grade_point).toBe(4);
    expect(semesters[0].rows[0].excluded).toBe(false);
    expect(semesters[0].gpa).toBe(4);
  });

  it("excludes non-OK status rows (carry-over/withheld) from GPA totals", () => {
    const { semesters } = buildSemesterBlocks([
      row({ semId: "s1", type: "first", session: "2021/2022", start: "2021-09-01", units: 2, gp: 5 }),
      row({ semId: "s1", type: "first", session: "2021/2022", start: "2021-09-01", units: 2, gp: 0, status_code: "WITHHELD" }),
    ]);
    expect(semesters[0].tcu).toBe(2);
    expect(semesters[0].excluded_count).toBe(0);
  });

  it("returns zeroed totals for an empty result set", () => {
    expect(buildSemesterBlocks([])).toEqual({ semesters: [], cumUnits: 0, cumPoints: 0, cgpa: 0 });
  });

  it("classifies CGPA into NCE tiers", () => {
    expect(classifyCgpa(4.6)).toBe("Distinction");
    expect(classifyCgpa(3.5)).toBe("Upper Credit");
    expect(classifyCgpa(2.5)).toBe("Lower Credit");
    expect(classifyCgpa(1.5)).toBe("Merit");
    expect(classifyCgpa(1)).toBe("Pass");
    expect(classifyCgpa(0.9)).toBe("Fail");
  });
});
