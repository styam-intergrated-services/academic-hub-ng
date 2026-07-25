// Shared matric → synthetic email translator. Client and server use the same rule.
// e.g. "AKCOE/2022/0001" -> "akcoe-2022-0001@students.akcoe.internal"
export const STUDENT_INTERNAL_DOMAIN = "students.akcoe.internal";

export function matricToSyntheticEmail(matric: string): string {
  const slug = matric
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug}@${STUDENT_INTERNAL_DOMAIN}`;
}

export function normalizeMatric(input: string): string {
  return input.trim().toUpperCase();
}
