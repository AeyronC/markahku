/**
 * MarkahKu grading rules — the ONLY place calculations live.
 * Every page, export and the AI analyst summary use these functions.
 */

export type ExamType = "sumatif_1" | "sumatif_2" | "uasa";
export type MarkStatus = "completed" | "pending" | "exempted" | "absent";
export type Letter = "A" | "B" | "C" | "D" | "E" | "F";
export type GoalLetter = Exclude<Letter, "F">;

export const EXAM_TYPES: ExamType[] = ["sumatif_1", "sumatif_2", "uasa"];
export const FORMS = [1, 2, 3, 4, 5] as const;
export const MARK_STATUSES: MarkStatus[] = ["completed", "pending", "exempted", "absent"];

export interface LetterBand {
  letter: Letter;
  min: number;
  max: number;
  ms: string;
  en: string;
}

export const LETTER_BANDS: LetterBand[] = [
  { letter: "A", min: 82, max: 100, ms: "Cemerlang", en: "Excellent" },
  { letter: "B", min: 66, max: 81, ms: "Kepujian", en: "Commendable" },
  { letter: "C", min: 50, max: 65, ms: "Baik", en: "Good" },
  { letter: "D", min: 35, max: 49, ms: "Memuaskan", en: "Satisfactory" },
  { letter: "E", min: 20, max: 34, ms: "Mencapai Tahap Minimum", en: "Minimum Level Achieved" },
  { letter: "F", min: 0, max: 19, ms: "Belum Mencapai Tahap Minimum", en: "Minimum Level Not Achieved" },
];

export interface PointBand {
  min: number;
  max: number;
  points: number;
  label: string;
}

export const CGPA_BANDS: PointBand[] = [
  { min: 90, max: 100, points: 4.0, label: "A+" },
  { min: 80, max: 89, points: 3.75, label: "A" },
  { min: 70, max: 79, points: 3.5, label: "A-" },
  { min: 65, max: 69, points: 3.25, label: "B+" },
  { min: 60, max: 64, points: 3.0, label: "B" },
  { min: 55, max: 59, points: 2.75, label: "C+" },
  { min: 50, max: 54, points: 2.5, label: "C" },
  { min: 45, max: 49, points: 2.25, label: "D" },
  { min: 40, max: 44, points: 2.0, label: "E" },
  { min: 1, max: 39, points: 1.75, label: "G" },
  { min: 0, max: 0, points: 0, label: "—" },
];

export const CGPA_LABEL_NAMES: Record<string, { ms: string; en: string }> = {
  "A+": { ms: "Cemerlang Tertinggi", en: "Super Distinction" },
  A: { ms: "Cemerlang Tinggi", en: "High Distinction" },
  "A-": { ms: "Cemerlang", en: "Distinction" },
  "B+": { ms: "Kepujian Tertinggi", en: "Super Credit" },
  B: { ms: "Kepujian Tinggi", en: "High Credit" },
  "C+": { ms: "Kepujian Atas", en: "Upper Credit" },
  C: { ms: "Kepujian", en: "Credit" },
  D: { ms: "Lulus Atas", en: "Upper Pass" },
  E: { ms: "Lulus", en: "Pass" },
  G: { ms: "Gagal", en: "Fail" },
  "—": { ms: "Tidak hadir", en: "Absent" },
};

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export const round1 = (n: number) => Math.round((n + Number.EPSILON) * 10) / 10;

export function isValidMark(n: number) {
  return Number.isInteger(n) && n >= 0 && n <= 100;
}

export function letterBand(mark: number): LetterBand {
  const m = Math.round(mark);
  return LETTER_BANDS.find((b) => m >= b.min && m <= b.max) ?? LETTER_BANDS[LETTER_BANDS.length - 1]!;
}

export function letterGrade(mark: number): Letter {
  return letterBand(mark).letter;
}

export function pointBand(mark: number): PointBand {
  const m = Math.round(mark);
  return CGPA_BANDS.find((b) => m >= b.min && m <= b.max) ?? CGPA_BANDS[CGPA_BANDS.length - 1]!;
}

export function cgpaPoints(mark: number): number {
  return pointBand(mark).points;
}

/** Completed and Absent count towards averages and CGPA; Pending and Exempted do not. */
export function isCounted(status: MarkStatus) {
  return status === "completed" || status === "absent";
}

export interface MarkEntry {
  status: MarkStatus;
  mark: number | null;
}

/** The mark used for calculations, or null when the subject is not counted. */
export function effectiveMark(e: MarkEntry): number | null {
  if (e.status === "absent") return 0;
  if (e.status === "completed" && e.mark != null) return e.mark;
  return null;
}

export type ParsedMark = { ok: true; value: number | null } | { ok: false };

/** Parse a typed mark: blank → null, whole number 0–100 → value, anything else invalid. */
export function parseMarkInput(raw: string | number | null | undefined): ParsedMark {
  if (raw == null) return { ok: true, value: null };
  const s = String(raw).trim();
  if (s === "") return { ok: true, value: null };
  if (!/^\d{1,3}$/.test(s)) return { ok: false };
  const n = Number(s);
  return isValidMark(n) ? { ok: true, value: n } : { ok: false };
}

/**
 * Apply the entry rules: blank mark → Pending; Absent forces 0;
 * Exempted and Pending clear the mark; a number with no status → Completed.
 */
export function normalizeEntry(mark: number | null, status?: MarkStatus): MarkEntry {
  if (status === "absent") return { status: "absent", mark: 0 };
  if (status === "exempted") return { status: "exempted", mark: null };
  if (status === "pending") return { status: "pending", mark: null };
  if (mark == null) return { status: "pending", mark: null };
  return { status: "completed", mark };
}

export interface ExamSummary {
  total: number;
  average: number | null;
  cgpa: number | null;
  counted: number;
  pending: number;
  exempted: number;
  absent: number;
}

export function summarizeExam(entries: MarkEntry[]): ExamSummary {
  let total = 0;
  let pts = 0;
  let counted = 0;
  let pending = 0;
  let exempted = 0;
  let absent = 0;
  for (const e of entries) {
    if (e.status === "pending" || (e.status === "completed" && e.mark == null)) pending++;
    if (e.status === "exempted") exempted++;
    if (e.status === "absent") absent++;
    const m = effectiveMark(e);
    if (m == null) continue;
    counted++;
    total += m;
    pts += cgpaPoints(m);
  }
  return {
    total,
    average: counted ? round2(total / counted) : null,
    cgpa: counted ? round2(pts / counted) : null,
    counted,
    pending,
    exempted,
    absent,
  };
}

/** Chronological position: F1 S1 = 0, F1 S2 = 1, F1 UASA = 2, F2 S1 = 3 … */
export function examIndex(form: number, exam: ExamType) {
  return (form - 1) * 3 + EXAM_TYPES.indexOf(exam);
}

export interface ExamPoint {
  form: number;
  exam: ExamType;
  average: number | null;
  cgpa: number | null;
}

/** Change vs the student's own previous exam that has a value. */
export function changeVsPrevious(points: ExamPoint[], form: number, exam: ExamType) {
  const idx = examIndex(form, exam);
  const current = points.find((p) => p.form === form && p.exam === exam);
  const prev = points
    .filter((p) => examIndex(p.form, p.exam) < idx && p.average != null)
    .sort((a, b) => examIndex(b.form, b.exam) - examIndex(a.form, a.exam))[0];
  if (!current || current.average == null || !prev) {
    return { average: null as number | null, cgpa: null as number | null, previous: prev ?? null };
  }
  return {
    average: round2(current.average - (prev.average ?? 0)),
    cgpa: current.cgpa != null && prev.cgpa != null ? round2(current.cgpa - prev.cgpa) : null,
    previous: prev,
  };
}

export function mean(values: (number | null | undefined)[]): number | null {
  const v = values.filter((x): x is number => typeof x === "number");
  return v.length ? round2(v.reduce((a, b) => a + b, 0) / v.length) : null;
}

/** Yearly per-subject value: mean of counted marks across the three exams. */
export function yearlySubjectMean(entries: (MarkEntry | undefined)[]): number | null {
  return mean(entries.map((e) => (e ? effectiveMark(e) : null)));
}

/** Yearly average / CGPA: equal-weight mean of the per-exam values that exist. */
export function yearlySummary(perExam: ExamSummary[]) {
  return {
    average: mean(perExam.map((s) => s.average)),
    cgpa: mean(perExam.map((s) => s.cgpa)),
  };
}

export function letterMin(letter: Letter) {
  return LETTER_BANDS.find((b) => b.letter === letter)!.min;
}

/** Subject goal: latest counted mark vs the lower bound of the target band. */
export function subjectGoalProgress(latest: number | null, target: GoalLetter) {
  const min = letterMin(target);
  if (latest == null) return { progress: 0, gap: null as number | null, met: false };
  return {
    progress: Math.min(1, latest / min),
    gap: Math.max(0, min - latest),
    met: latest >= min,
  };
}

/** Exam goal: current ÷ target, capped at 100%, with the gap. */
export function examGoalProgress(current: number | null, target: number) {
  if (current == null || target <= 0) return { progress: 0, gap: null as number | null, met: false };
  return {
    progress: Math.min(1, current / target),
    gap: round2(Math.max(0, target - current)),
    met: current >= target,
  };
}

/** Marks needed to reach the next letter grade (null when already A). */
export function nextLetterBoundary(mark: number) {
  const band = letterBand(mark);
  const i = LETTER_BANDS.indexOf(band);
  if (i <= 0) return null;
  const next = LETTER_BANDS[i - 1]!;
  return { letter: next.letter, marksNeeded: next.min - mark };
}

/** Rank percentile: share of the cohort at or below this position (1 of 240 → 100). */
export function rankPercentile(position: number, total: number) {
  if (!total || position < 1 || position > total) return null;
  return round1(((total - position + 1) / total) * 100);
}

export function formatAverage(n: number | null | undefined) {
  return n == null ? "—" : round1(n).toFixed(1);
}

export function formatCgpa(n: number | null | undefined) {
  return n == null ? "—" : round2(n).toFixed(2);
}

export function formatDelta(n: number | null | undefined, digits = 1) {
  if (n == null) return "—";
  const r = digits === 1 ? round1(n) : round2(n);
  return `${r > 0 ? "+" : ""}${r.toFixed(digits)}`;
}

/** "Top X%": position as a share of the cohort (12 of 240 → 5). */
export function rankTopPercent(position: number, total: number) {
  if (!total || position < 1 || position > total) return null;
  return Math.max(1, Math.round((position / total) * 100));
}
