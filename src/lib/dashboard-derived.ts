import { EXAM_TYPES, effectiveMark, examIndex, nextLetterBoundary, summarizeExam, type ExamSummary, type ExamType } from "./grading";
import { entriesForSession, markFor, sessionFor, subjectName, subjectsForForm, type Gradebook, type Session } from "./gradebook";
import type { Lang } from "./i18n-dict";

/** Counted marks for one exam, in the student's subject order. */
function countedMarks(book: Gradebook, form: number, exam: ExamType, lang: Lang) {
  const sid = sessionFor(book, form, exam)?.id;
  return subjectsForForm(book, form, true)
    .map((s) => {
      const e = markFor(book, sid, s.id);
      const mark = e ? effectiveMark(e) : null;
      return { name: subjectName(s, lang), mark };
    })
    .filter((x): x is { name: string; mark: number } => x.mark != null);
}

/** Highest and lowest counted subject. No separate lowest with fewer than 2 subjects. */
export function subjectHighlights(book: Gradebook, form: number, exam: ExamType, lang: Lang) {
  const list = countedMarks(book, form, exam, lang);
  if (!list.length) return { best: null, worst: null };
  const best = list.reduce((a, b) => (b.mark > a.mark ? b : a));
  const worst = list.length > 1 ? list.reduce((a, b) => (b.mark < a.mark ? b : a)) : null;
  return { best, worst };
}

/** Subjects within 3 marks of the next letter grade, closest first. */
export function focusAreas(book: Gradebook, form: number, exam: ExamType, lang: Lang) {
  return countedMarks(book, form, exam, lang)
    .map((s) => ({ ...s, next: nextLetterBoundary(s.mark, form) }))
    .filter((s) => s.next && s.next.marksNeeded <= 3)
    .map((s) => ({ name: s.name, mark: s.mark, letter: s.next!.letter, marksNeeded: s.next!.marksNeeded }))
    .sort((a, b) => a.marksNeeded - b.marksNeeded);
}

/** One row per active subject with its counted mark in each exam of the Form. */
export function subjectSeries(book: Gradebook, form: number, lang: Lang, short: (name: string) => string) {
  const sids = EXAM_TYPES.map((e) => sessionFor(book, form, e)?.id);
  return subjectsForForm(book, form)
    .map((s) => {
      const row: { name: string; full: string } & Partial<Record<ExamType, number | null>> = {
        name: short(subjectName(s, lang)),
        full: subjectName(s, lang),
      };
      EXAM_TYPES.forEach((e, i) => {
        const entry = markFor(book, sids[i], s.id);
        row[e] = entry ? effectiveMark(entry) : null;
      });
      return row;
    })
    .filter((r) => EXAM_TYPES.some((e) => r[e] != null));
}

/** Exams that have at least one counted mark, newest first. */
export function examHistory(book: Gradebook): (ExamSummary & { session: Session })[] {
  return book.sessions
    .map((session) => ({ session, ...summarizeExam(entriesForSession(book, session.id)) }))
    .filter((r) => r.counted > 0)
    .sort((a, b) => examIndex(b.session.form, b.session.exam) - examIndex(a.session.form, a.session.exam));
}

export interface StudyTask {
  id: string;
  day: string;
  subject: string;
  task: string;
  minutes: number;
}

/** First 3 tasks from a saved AI study plan. */
export function studyTasksFromPlan(insightId: string, payload: unknown, limit = 3): StudyTask[] {
  const days = (payload as { days?: unknown } | null)?.days;
  if (!Array.isArray(days)) return [];
  const out: StudyTask[] = [];
  for (const d of days as { day?: unknown; focus?: unknown }[]) {
    if (!Array.isArray(d?.focus)) continue;
    for (const f of d.focus as { subject?: unknown; task?: unknown; minutes?: unknown }[]) {
      if (out.length >= limit) return out;
      if (typeof f?.task !== "string") continue;
      out.push({
        id: `${insightId}:${out.length}`,
        day: typeof d.day === "string" ? d.day : "",
        subject: typeof f.subject === "string" ? f.subject : "",
        task: f.task,
        minutes: typeof f.minutes === "number" ? f.minutes : 0,
      });
    }
  }
  return out;
}
