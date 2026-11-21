import {
  EXAM_TYPES,
  effectiveMark,
  letterGrade,
  letterMin,
  nextLetterBoundary,
  round2,
  type GoalLetter,
} from "./grading";
import { markFor, sessionFor, subjectName, subjectsForForm, type Gradebook } from "./gradebook";
import { examSummary } from "./book-derived";
import { EXAM_LABEL } from "./export";
import type { Lang } from "./i18n-dict";
import type { AnalystInput } from "./ai.functions";

/** Pre-computed numbers for the AI: marks, subjects, goals and Form only. */
export function buildAnalystSummary(book: Gradebook, form: number, lang: Lang): AnalystInput["summary"] {
  const exams = EXAM_TYPES.map((e) => {
    const s = examSummary(book, form, e);
    return { exam: EXAM_LABEL[e], average: s.average, cgpa: s.cgpa, counted: s.counted, pending: s.pending };
  });

  const subjects = subjectsForForm(book, form).map((s) => {
    const marks = EXAM_TYPES.map((e) => {
      const entry = markFor(book, sessionFor(book, form, e)?.id, s.id);
      const m = entry ? effectiveMark(entry) : null;
      return { exam: EXAM_LABEL[e], mark: m, grade: m != null ? letterGrade(m) : null };
    });
    const counted = marks.filter((m) => m.mark != null);
    const last = counted[counted.length - 1]?.mark ?? null;
    const prev = counted[counted.length - 2]?.mark ?? null;
    const change = last != null && prev != null ? last - prev : null;
    const trend = change == null ? "unknown" : change >= 3 ? "improving" : change <= -3 ? "declining" : "flat";
    const goal = book.goals.find((g) => g.scope === "subject" && g.form === form && g.user_subject_id === s.id);
    const target = (goal?.target_grade ?? null) as GoalLetter | null;
    return {
      subject: subjectName(s, lang),
      marks,
      trend: trend as "improving" | "flat" | "declining" | "unknown",
      change,
      nextGrade: last != null ? nextLetterBoundary(last) : null,
      goal: target,
      goalGap: target && last != null ? Math.max(0, letterMin(target) - last) : null,
    };
  });

  const examGoals = book.goals
    .filter((g) => g.scope === "exam" && g.form === form && g.exam)
    .map((g) => {
      const s = examSummary(book, form, g.exam!);
      return {
        exam: EXAM_LABEL[g.exam!],
        targetAverage: g.target_average != null ? round2(Number(g.target_average)) : null,
        targetCgpa: g.target_cgpa != null ? round2(Number(g.target_cgpa)) : null,
        currentAverage: s.average,
        currentCgpa: s.cgpa,
      };
    });

  return { exams, subjects, examGoals };
}
