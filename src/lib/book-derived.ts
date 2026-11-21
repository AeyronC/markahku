import {
  EXAM_TYPES,
  changeVsPrevious,
  effectiveMark,
  examIndex,
  summarizeExam,
  type ExamPoint,
  type ExamSummary,
  type ExamType,
} from "./grading";
import { entriesForSession, markFor, sessionFor, type Gradebook } from "./gradebook";

export function examSummary(book: Gradebook, form: number, exam: ExamType): ExamSummary {
  const s = sessionFor(book, form, exam);
  return summarizeExam(entriesForSession(book, s?.id));
}

export function allExamPoints(book: Gradebook): (ExamPoint & { idx: number })[] {
  return book.sessions
    .map((s) => {
      const sum = summarizeExam(entriesForSession(book, s.id));
      return { form: s.form, exam: s.exam, average: sum.average, cgpa: sum.cgpa, idx: examIndex(s.form, s.exam) };
    })
    .sort((a, b) => a.idx - b.idx);
}

export function examChange(book: Gradebook, form: number, exam: ExamType) {
  return changeVsPrevious(allExamPoints(book), form, exam);
}

/** Latest counted mark for a subject in its Form (UASA → S2 → S1). */
export function latestCountedMark(book: Gradebook, form: number, subjectId: string): number | null {
  for (const exam of [...EXAM_TYPES].reverse()) {
    const e = markFor(book, sessionFor(book, form, exam)?.id, subjectId);
    const m = e ? effectiveMark(e) : null;
    if (m != null) return m;
  }
  return null;
}

/** The most recent exam that has any counted marks, or null. */
export function latestExamWithData(book: Gradebook): { form: number; exam: ExamType } | null {
  const pts = allExamPoints(book).filter((p) => p.average != null);
  const last = pts[pts.length - 1];
  return last ? { form: last.form, exam: last.exam } : null;
}
