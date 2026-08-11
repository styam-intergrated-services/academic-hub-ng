// Shared GPA/CGPA computation from published results.
// Single source of truth used by both getTranscript and getMyResults.

export type PublishedResultRow = {
  ca_score?: number | null;
  exam_score?: number | null;
  total_score?: number | null;
  grade?: string | null;
  grade_point?: number | null;
  status_code?: string | null;
  offering: {
    course: { code: string; title: string; credit_units: number | string };
    semester: {
      id: string;
      type: string;
      session?: { name?: string | null; start_date?: string | null } | null;
    };
  };
};

export type SemesterBlock = {
  semester_id: string;
  session_name: string;
  semester_type: string;
  order_key: string;
  rows: Array<{
    code: string;
    title: string;
    units: number;
    ca: number | null;
    exam: number | null;
    total: number | null;
    grade: string | null;
    grade_point: number;
    status_code: string;
    /** true when units or grade point could not be determined — row is shown but excluded from GPA */
    excluded: boolean;
  }>;
  tcu: number;
  tgp: number;
  gpa: number;
  running_cgpa: number;
  /** count of rows excluded from GPA because of missing data */
  excluded_count: number;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** 5-point NCE scale used college-wide: A 70-100=5, B 60-69=4, C 50-59=3, D 45-49=2, E 40-44=1, F<40=0 */
export function gradePointFromTotal(total: number | null | undefined): number | null {
  if (total === null || total === undefined || !Number.isFinite(Number(total))) return null;
  const t = Number(total);
  if (t >= 70) return 5;
  if (t >= 60) return 4;
  if (t >= 50) return 3;
  if (t >= 45) return 2;
  if (t >= 40) return 1;
  return 0;
}

const GRADE_LETTER_POINTS: Record<string, number> = { A: 5, B: 4, C: 3, D: 2, E: 1, F: 0 };

/** Best-effort grade point: stored value -> letter grade -> total score. Null when undeterminable. */
export function resolveGradePoint(
  gradePoint: number | null | undefined,
  grade: string | null | undefined,
  total: number | null | undefined,
): number | null {
  const gp = Number(gradePoint);
  if (gradePoint !== null && gradePoint !== undefined && Number.isFinite(gp)) return gp;
  const letter = (grade ?? "").trim().toUpperCase().charAt(0);
  if (letter in GRADE_LETTER_POINTS) return GRADE_LETTER_POINTS[letter];
  return gradePointFromTotal(total);
}

/** Credit units fallback: invalid/missing/negative units are treated as unknown (null). */
export function resolveUnits(units: number | string | null | undefined): number | null {
  const n = Number(units);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/**
 * Groups published results by semester, computes each semester's GPA
 * (Σ units×grade_point / Σ units) and a running CGPA ordered chronologically
 * by session start_date then semester type (first before second).
 */
export function buildSemesterBlocks(results: PublishedResultRow[]): {
  semesters: SemesterBlock[];
  cumUnits: number;
  cumPoints: number;
  cgpa: number;
} {
  const byId = new Map<string, SemesterBlock>();
  for (const r of results ?? []) {
    const sem = r.offering.semester;
    const key = sem.id;
    if (!byId.has(key)) {
      byId.set(key, {
        semester_id: key,
        session_name: sem.session?.name ?? "",
        semester_type: sem.type,
        order_key: `${sem.session?.start_date ?? sem.session?.name ?? ""}-${sem.type}`,
        rows: [],
        tcu: 0,
        tgp: 0,
        gpa: 0,
        running_cgpa: 0,
        excluded_count: 0,
      });
    }
    const block = byId.get(key)!;
    const resolvedUnits = resolveUnits(r.offering.course.credit_units);
    const resolvedGp = resolveGradePoint(r.grade_point, r.grade, r.total_score);
    const statusCode = r.status_code ?? "OK";
    const excluded = statusCode !== "OK" || resolvedUnits === null || resolvedGp === null;
    block.rows.push({
      code: r.offering.course.code,
      title: r.offering.course.title,
      units: resolvedUnits ?? 0,
      ca: r.ca_score ?? null,
      exam: r.exam_score ?? null,
      total: r.total_score ?? null,
      grade: r.grade ?? null,
      grade_point: resolvedGp ?? 0,
      status_code: statusCode,
      excluded,
    });
    if (!excluded) {
      block.tcu += resolvedUnits!;
      block.tgp += resolvedUnits! * resolvedGp!;
    } else if (statusCode === "OK") {
      block.excluded_count += 1;
    }
  }

  const ordered = Array.from(byId.values())
    .map((b) => ({ ...b, gpa: b.tcu > 0 ? round2(b.tgp / b.tcu) : 0 }))
    .sort((a, b) => (a.order_key < b.order_key ? -1 : 1));

  let cumUnits = 0;
  let cumPoints = 0;
  const semesters = ordered.map((s) => {
    cumUnits += s.tcu;
    cumPoints += s.tgp;
    return { ...s, running_cgpa: cumUnits > 0 ? round2(cumPoints / cumUnits) : 0 };
  });

  return {
    semesters,
    cumUnits,
    cumPoints: round2(cumPoints),
    cgpa: cumUnits > 0 ? round2(cumPoints / cumUnits) : 0,
  };
}

export function classifyCgpa(cgpa: number): string {
  return cgpa >= 4.5 ? "Distinction"
    : cgpa >= 3.5 ? "Upper Credit"
    : cgpa >= 2.5 ? "Lower Credit"
    : cgpa >= 1.5 ? "Merit"
    : cgpa >= 1.0 ? "Pass" : "Fail";
}
