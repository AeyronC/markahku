import { EXAM_TYPES, type ExamType } from "./grading";

/**
 * Exam dates for the dashboard countdown ("Estimate with edit").
 * Schools set their own dates, so we start from rough term estimates and the
 * student can save their school's real date, which is then shown as confirmed.
 */

/** Rough term estimates (month is 1-based). */
export const ESTIMATED_MONTH_DAY: Record<ExamType, { month: number; day: number }> = {
  sumatif_1: { month: 3, day: 16 },
  sumatif_2: { month: 7, day: 13 },
  uasa: { month: 10, day: 19 },
};

/** Saved dates: key `${form}:${exam}` → ISO date (yyyy-mm-dd). */
export type SavedExamDates = Record<string, string>;

export const examDateKey = (form: number, exam: ExamType) => `${form}:${exam}`;

const pad = (n: number) => String(n).padStart(2, "0");

export function estimatedExamDate(exam: ExamType, year: number): string {
  const { month, day } = ESTIMATED_MONTH_DAY[exam];
  return `${year}-${pad(month)}-${pad(day)}`;
}

const toUtc = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1);
};

/** Whole days from `today` to `date`, never below 0. */
export function daysUntil(today: string, date: string): number {
  return Math.max(0, Math.round((toUtc(date) - toUtc(today)) / 86_400_000));
}

/** Today's local date as yyyy-mm-dd. */
export function localToday(now = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export interface UpcomingExam {
  form: number;
  exam: ExamType;
  date: string;
  estimated: boolean;
  daysLeft: number;
}

export function dateFor(form: number, exam: ExamType, year: number, saved: SavedExamDates) {
  const own = saved[examDateKey(form, exam)];
  return own ? { date: own, estimated: false } : { date: estimatedExamDate(exam, year), estimated: true };
}

/**
 * The next exam still to come: the current Form's exams this year, then the
 * next Form's exams next year. Exams that already have marks are skipped.
 */
export function nextExam({
  today,
  currentForm,
  saved,
  withMarks = new Set<string>(),
}: {
  today: string;
  currentForm: number;
  saved: SavedExamDates;
  withMarks?: Set<string>;
}): UpcomingExam | null {
  const year = Number(today.slice(0, 4));
  const candidates: { form: number; exam: ExamType; year: number }[] = EXAM_TYPES.map((exam) => ({ form: currentForm, exam, year }));
  if (currentForm < 5) candidates.push(...EXAM_TYPES.map((exam) => ({ form: currentForm + 1, exam, year: year + 1 })));

  const upcoming = candidates
    .filter((c) => !withMarks.has(examDateKey(c.form, c.exam)))
    .map((c) => ({ form: c.form, exam: c.exam, ...dateFor(c.form, c.exam, c.year, saved) }))
    .filter((c) => c.date >= today)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const first = upcoming[0];
  return first ? { ...first, daysLeft: daysUntil(today, first.date) } : null;
}

/* ---------- browser storage (per signed-in student) ---------- */

const storageKey = (userId: string) => `mk-exam-dates:${userId}`;

export function loadSavedExamDates(userId: string): SavedExamDates {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    const parsed = raw ? (JSON.parse(raw) as unknown) : {};
    if (!parsed || typeof parsed !== "object") return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(
        (e): e is [string, string] => typeof e[1] === "string" && /^\d{4}-\d{2}-\d{2}$/.test(e[1]),
      ),
    );
  } catch {
    return {};
  }
}

export function saveExamDate(userId: string, form: number, exam: ExamType, date: string | null): SavedExamDates {
  const next = { ...loadSavedExamDates(userId) };
  if (date) next[examDateKey(form, exam)] = date;
  else delete next[examDateKey(form, exam)];
  localStorage.setItem(storageKey(userId), JSON.stringify(next));
  return next;
}
