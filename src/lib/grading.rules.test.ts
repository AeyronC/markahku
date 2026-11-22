import { describe, expect, it } from "vitest";
import {
  cgpaPoints,
  changeVsPrevious,
  effectiveMark,
  examGoalProgress,
  examIndex,
  formatAverage,
  formatCgpa,
  formatDelta,
  isCounted,
  isValidMark,
  letterGrade,
  letterMin,
  nextLetterBoundary,
  normalizeEntry,
  parseMarkInput,
  rankPercentile,
  subjectGoalProgress,
  summarizeExam,
  yearlySubjectMean,
  yearlySummary,
  type ExamPoint,
  type MarkEntry,
} from "./grading";

// Helpers ---------------------------------------------------------------

const done = (mark: number): MarkEntry => ({ status: "completed", mark });
const pending = (): MarkEntry => ({ status: "pending", mark: null });
const exempted = (): MarkEntry => ({ status: "exempted", mark: null });
const absent = (): MarkEntry => ({ status: "absent", mark: 0 });

const pt = (
  form: number,
  exam: "sumatif_1" | "sumatif_2" | "uasa",
  average: number | null,
  cgpa: number | null,
) => ({ form, exam, average, cgpa }) as ExamPoint;

// Real report card from the original spreadsheet (Form 1, 11 subjects).
const SUMATIF_1 = [88, 86, 71, 86, 91, 79, 77, 74, 80, 90, 55].map(done);
// Sumatif 2: Bahasa Iban has no mark yet, so it is pending.
const SUMATIF_2 = [...[87, 80, 93, 74, 86, 75, 78, 74, 85, 90].map(done), pending()];

// Letter grade (KSSM) ---------------------------------------------------

describe("letterGrade (KSSM scale)", () => {
  const cases: [number, string][] = [
    [0, "F"],
    [19, "F"],
    [20, "E"],
    [34, "E"],
    [35, "D"],
    [49, "D"],
    [50, "C"],
    [65, "C"],
    [66, "B"],
    [81, "B"],
    [82, "A"],
    [100, "A"],
  ];
  it.each(cases)("mark %i -> %s", (mark, letter) => {
    expect(letterGrade(mark)).toBe(letter);
  });

  it("matches the original sheet: 80 is a B and 82 is an A", () => {
    expect(letterGrade(80)).toBe("B");
    expect(letterGrade(82)).toBe("A");
    expect(letterGrade(55)).toBe("C");
    expect(letterGrade(71)).toBe("B");
  });
});

describe("letterMin", () => {
  it("returns the lowest mark of each letter", () => {
    expect(letterMin("A")).toBe(82);
    expect(letterMin("B")).toBe(66);
    expect(letterMin("C")).toBe(50);
    expect(letterMin("D")).toBe(35);
    expect(letterMin("E")).toBe(20);
  });
});

describe("nextLetterBoundary", () => {
  it("says how many marks are needed for the next letter", () => {
    expect(nextLetterBoundary(70)).toEqual({ letter: "A", marksNeeded: 12 });
    expect(nextLetterBoundary(60)).toEqual({ letter: "B", marksNeeded: 6 });
    expect(nextLetterBoundary(10)).toEqual({ letter: "E", marksNeeded: 10 });
  });
  it("returns null when already an A", () => {
    expect(nextLetterBoundary(82)).toBeNull();
    expect(nextLetterBoundary(100)).toBeNull();
  });
});

// CGPA points -----------------------------------------------------------

describe("cgpaPoints (A+ to G table)", () => {
  const cases: [number, number][] = [
    [100, 4.0],
    [90, 4.0],
    [89, 3.75],
    [80, 3.75],
    [79, 3.5],
    [70, 3.5],
    [69, 3.25],
    [65, 3.25],
    [64, 3.0],
    [60, 3.0],
    [59, 2.75],
    [55, 2.75],
    [54, 2.5],
    [50, 2.5],
    [49, 2.25],
    [45, 2.25],
    [44, 2.0],
    [40, 2.0],
    [39, 1.75],
    [1, 1.75],
    [0, 0],
  ];
  it.each(cases)("mark %i -> %f points", (mark, points) => {
    expect(cgpaPoints(mark)).toBe(points);
  });

  it("is a separate scale from the letter grade (80 is a B but 3.75 points)", () => {
    expect(letterGrade(80)).toBe("B");
    expect(cgpaPoints(80)).toBe(3.75);
  });
});

// Validation and entries -----------------------------------------------

describe("isValidMark", () => {
  it("accepts whole numbers from 0 to 100", () => {
    expect(isValidMark(0)).toBe(true);
    expect(isValidMark(100)).toBe(true);
    expect(isValidMark(57)).toBe(true);
  });
  it("rejects out-of-range and non-integer marks", () => {
    expect(isValidMark(-1)).toBe(false);
    expect(isValidMark(101)).toBe(false);
    expect(isValidMark(50.5)).toBe(false);
    expect(isValidMark(Number.NaN)).toBe(false);
  });
});

describe("parseMarkInput", () => {
  it("parses a valid number", () => {
    expect(parseMarkInput("85")).toEqual({ ok: true, value: 85 });
    expect(parseMarkInput(85)).toEqual({ ok: true, value: 85 });
    expect(parseMarkInput("0")).toEqual({ ok: true, value: 0 });
    expect(parseMarkInput("100")).toEqual({ ok: true, value: 100 });
  });
  it("treats blank input as no mark (saves as pending)", () => {
    expect(parseMarkInput("")).toEqual({ ok: true, value: null });
    expect(parseMarkInput(null)).toEqual({ ok: true, value: null });
    expect(parseMarkInput(undefined)).toEqual({ ok: true, value: null });
  });
  it("rejects bad input", () => {
    expect(parseMarkInput("101").ok).toBe(false);
    expect(parseMarkInput("abc").ok).toBe(false);
    expect(parseMarkInput("-5").ok).toBe(false);
  });
});

describe("normalizeEntry", () => {
  it("forces absent to mark 0", () => {
    expect(normalizeEntry(55, "absent")).toEqual({ status: "absent", mark: 0 });
    expect(normalizeEntry(null, "absent")).toEqual({ status: "absent", mark: 0 });
  });
  it("clears the mark for exempted and pending", () => {
    expect(normalizeEntry(70, "exempted")).toEqual({ status: "exempted", mark: null });
    expect(normalizeEntry(70, "pending")).toEqual({ status: "pending", mark: null });
  });
  it("a blank mark with no status becomes pending", () => {
    expect(normalizeEntry(null)).toEqual({ status: "pending", mark: null });
  });
  it("a real mark becomes completed", () => {
    expect(normalizeEntry(88)).toEqual({ status: "completed", mark: 88 });
    expect(normalizeEntry(0)).toEqual({ status: "completed", mark: 0 });
  });
});

describe("isCounted / effectiveMark", () => {
  it("counts completed and absent, not pending or exempted", () => {
    expect(isCounted("completed")).toBe(true);
    expect(isCounted("absent")).toBe(true);
    expect(isCounted("pending")).toBe(false);
    expect(isCounted("exempted")).toBe(false);
  });
  it("gives the mark used in calculations", () => {
    expect(effectiveMark(done(75))).toBe(75);
    expect(effectiveMark(done(0))).toBe(0);
    expect(effectiveMark(absent())).toBe(0);
    expect(effectiveMark({ status: "absent", mark: 55 })).toBe(0);
    expect(effectiveMark(pending())).toBeNull();
    expect(effectiveMark(exempted())).toBeNull();
    expect(effectiveMark({ status: "completed", mark: null })).toBeNull();
  });
});

// Exam summary ----------------------------------------------------------

describe("summarizeExam", () => {
  it("fixes the sheet's Sumatif 1 average (was 55, real value is about 79.7)", () => {
    const s = summarizeExam(SUMATIF_1);
    expect(s.total).toBe(877);
    expect(s.counted).toBe(11);
    expect(s.pending).toBe(0);
    expect(s.average).toBe(79.73);
    expect(s.cgpa).toBe(3.61);
  });

  it("leaves a pending subject out of the average and CGPA (Sumatif 2)", () => {
    const s = summarizeExam(SUMATIF_2);
    expect(s.total).toBe(822);
    expect(s.counted).toBe(10);
    expect(s.pending).toBe(1);
    expect(s.average).toBe(82.2);
    expect(s.cgpa).toBe(3.7);
  });

  it("counts absent as 0 marks and 0 points", () => {
    const s = summarizeExam([done(80), absent()]);
    expect(s.total).toBe(80);
    expect(s.counted).toBe(2);
    expect(s.absent).toBe(1);
    expect(s.average).toBe(40);
    expect(s.cgpa).toBeCloseTo(1.88, 2);
  });

  it("leaves exempted subjects out and counts them separately", () => {
    const s = summarizeExam([done(90), exempted()]);
    expect(s.counted).toBe(1);
    expect(s.exempted).toBe(1);
    expect(s.average).toBe(90);
    expect(s.cgpa).toBe(4);
  });

  it("returns null (never NaN) when nothing is counted", () => {
    const s = summarizeExam([pending(), pending()]);
    expect(s.total).toBe(0);
    expect(s.counted).toBe(0);
    expect(s.pending).toBe(2);
    expect(s.average).toBeNull();
    expect(s.cgpa).toBeNull();

    const empty = summarizeExam([]);
    expect(empty.average).toBeNull();
    expect(empty.cgpa).toBeNull();
  });

  it("mixes all four statuses: absent is 0, pending and exempted are left out", () => {
    const s = summarizeExam([done(90), done(70), absent(), pending(), exempted()]);
    expect(s.counted).toBe(3);
    expect(s.pending).toBe(1);
    expect(s.exempted).toBe(1);
    expect(s.absent).toBe(1);
    expect(s.total).toBe(160);
    expect(s.average).toBe(53.33);
    // (4.00 + 3.50 + 0.00) / 3
    expect(s.cgpa).toBe(2.5);
  });

  it("treats a completed entry with no mark as pending", () => {
    const s = summarizeExam([{ status: "completed", mark: null }, done(60)]);
    expect(s.pending).toBe(1);
    expect(s.counted).toBe(1);
    expect(s.average).toBe(60);
  });
});

// Order of exams and change vs previous --------------------------------

describe("examIndex", () => {
  it("orders exams across Forms: F1 S1, F1 S2, F1 UASA, F2 S1 ...", () => {
    expect(examIndex(1, "sumatif_1")).toBe(0);
    expect(examIndex(1, "sumatif_2")).toBe(1);
    expect(examIndex(1, "uasa")).toBe(2);
    expect(examIndex(2, "sumatif_1")).toBe(3);
    expect(examIndex(5, "uasa")).toBe(14);
  });
});

describe("changeVsPrevious", () => {
  const points = [
    pt(1, "sumatif_1", 70, 3.5),
    pt(1, "sumatif_2", 75, 3.5),
    pt(1, "uasa", 80, 3.75),
    pt(2, "sumatif_1", 78, 3.5),
  ];

  it("compares with the student's own previous exam", () => {
    const c = changeVsPrevious(points, 1, "sumatif_2");
    expect(c.average).toBe(5);
    expect(c.cgpa).toBe(0);
  });

  it("crosses Forms: Form 2 Sumatif 1 is compared with Form 1 UASA", () => {
    const c = changeVsPrevious(points, 2, "sumatif_1");
    expect(c.average).toBe(-2);
    expect(c.cgpa).toBe(-0.25);
    expect(c.previous?.exam).toBe("uasa");
    expect(c.previous?.form).toBe(1);
  });

  it("does not depend on the order of the input list", () => {
    const shuffled = [points[3]!, points[1]!, points[0]!, points[2]!];
    expect(changeVsPrevious(shuffled, 2, "sumatif_1").average).toBe(-2);
  });

  it("has no change for the first exam", () => {
    const c = changeVsPrevious(points, 1, "sumatif_1");
    expect(c.average).toBeNull();
    expect(c.cgpa).toBeNull();
    expect(c.previous).toBeNull();
  });

  it("skips earlier exams that have no average", () => {
    const gap = [pt(1, "sumatif_1", 70, 3.5), pt(1, "sumatif_2", null, null), pt(1, "uasa", 80, 3.75)];
    const c = changeVsPrevious(gap, 1, "uasa");
    expect(c.average).toBe(10);
    expect(c.previous?.exam).toBe("sumatif_1");
  });

  it("has no change when the current exam has no average", () => {
    const none = [pt(1, "sumatif_1", 70, 3.5), pt(1, "sumatif_2", null, null)];
    expect(changeVsPrevious(none, 1, "sumatif_2").average).toBeNull();
  });
});

// Yearly ----------------------------------------------------------------

describe("yearlySubjectMean", () => {
  it("averages only the counted marks across exams", () => {
    expect(yearlySubjectMean([done(80), done(90), undefined])).toBe(85);
    expect(yearlySubjectMean([done(80), pending(), done(60)])).toBe(70);
    expect(yearlySubjectMean([done(80), absent(), done(70)])).toBe(50);
  });
  it("is null when nothing is counted", () => {
    expect(yearlySubjectMean([pending(), undefined, exempted()])).toBeNull();
    expect(yearlySubjectMean([])).toBeNull();
  });
});

describe("yearlySummary", () => {
  it("is the equal-weight mean of the exams that have data", () => {
    const one = yearlySummary([summarizeExam(SUMATIF_1)]);
    expect(one.average).toBeCloseTo(79.73, 2);

    const two = yearlySummary([summarizeExam(SUMATIF_1), summarizeExam(SUMATIF_2), summarizeExam([])]);
    expect(two.average).toBeCloseTo((79.73 + 82.2) / 2, 2);
    expect(two.cgpa).toBeCloseTo((3.61 + 3.7) / 2, 2);
  });
  it("weights all three exams equally", () => {
    const three = yearlySummary([
      summarizeExam([done(70)]),
      summarizeExam([done(80)]),
      summarizeExam([done(90)]),
    ]);
    expect(three.average).toBe(80);
    // (3.50 + 3.75 + 4.00) / 3 = 3.75
    expect(three.cgpa).toBe(3.75);
  });
  it("is null when no exam has data", () => {
    const none = yearlySummary([summarizeExam([]), summarizeExam([pending()])]);
    expect(none.average).toBeNull();
    expect(none.cgpa).toBeNull();
  });
});

// Goals -----------------------------------------------------------------

describe("subjectGoalProgress", () => {
  it("is met when the latest mark reaches the target letter", () => {
    const g = subjectGoalProgress(70, "B");
    expect(g.met).toBe(true);
    expect(g.progress).toBe(1);
    expect(g.gap).toBe(0);
  });
  it("shows the gap in marks when below the target", () => {
    const g = subjectGoalProgress(60, "B");
    expect(g.met).toBe(false);
    expect(g.gap).toBe(6);
    expect(g.progress).toBeCloseTo(60 / 66, 5);
  });
  it("is exactly met at the lower bound", () => {
    expect(subjectGoalProgress(82, "A").met).toBe(true);
    expect(subjectGoalProgress(81, "A").met).toBe(false);
  });
  it("has no progress when there is no mark yet", () => {
    expect(subjectGoalProgress(null, "A")).toEqual({ progress: 0, gap: null, met: false });
  });
});

describe("examGoalProgress", () => {
  it("shows progress and the gap below target", () => {
    const g = examGoalProgress(80, 90);
    expect(g.met).toBe(false);
    expect(g.gap).toBe(10);
    expect(g.progress).toBeCloseTo(80 / 90, 5);
  });
  it("is capped at 100% when the target is beaten", () => {
    const g = examGoalProgress(95, 90);
    expect(g.met).toBe(true);
    expect(g.progress).toBe(1);
    expect(g.gap).toBe(0);
  });
  it("works for a CGPA target", () => {
    const g = examGoalProgress(3.5, 3.75);
    expect(g.gap).toBe(0.25);
    expect(g.met).toBe(false);
  });
  it("has no progress without data or with a zero target", () => {
    expect(examGoalProgress(null, 90)).toEqual({ progress: 0, gap: null, met: false });
    expect(examGoalProgress(80, 0)).toEqual({ progress: 0, gap: null, met: false });
  });
});

// Rank ------------------------------------------------------------------

describe("rankPercentile", () => {
  it("is 100 for first place", () => {
    expect(rankPercentile(1, 240)).toBe(100);
  });
  it("is above zero for last place", () => {
    expect(rankPercentile(240, 240)).toBe(0.4);
  });
  it("rounds to one decimal", () => {
    expect(rankPercentile(12, 240)).toBe(95.4);
  });
  it("returns null for impossible ranks", () => {
    expect(rankPercentile(0, 240)).toBeNull();
    expect(rankPercentile(241, 240)).toBeNull();
    expect(rankPercentile(5, 0)).toBeNull();
  });
});

// Display formatting ---------------------------------------------------

describe("formatters", () => {
  it("formatAverage uses one decimal and a dash for no data", () => {
    expect(formatAverage(79.727)).toBe("79.7");
    expect(formatAverage(80)).toBe("80.0");
    expect(formatAverage(null)).toBe("—");
    expect(formatAverage(undefined)).toBe("—");
  });
  it("formatCgpa uses two decimals and a dash for no data", () => {
    expect(formatCgpa(3.6136)).toBe("3.61");
    expect(formatCgpa(4)).toBe("4.00");
    expect(formatCgpa(null)).toBe("—");
  });
  it("formatDelta shows a sign", () => {
    expect(formatDelta(2.34)).toBe("+2.3");
    expect(formatDelta(-2)).toBe("-2.0");
    expect(formatDelta(0)).toBe("0.0");
    expect(formatDelta(0.5, 2)).toBe("+0.50");
    expect(formatDelta(null)).toBe("—");
  });
});
