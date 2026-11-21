import { describe, expect, it } from "vitest";
import {
  cgpaPoints,
  changeVsPrevious,
  examGoalProgress,
  formatAverage,
  letterGrade,
  normalizeEntry,
  parseMarkInput,
  subjectGoalProgress,
  summarizeExam,
  yearlySubjectMean,
  yearlySummary,
} from "./grading";

describe("letter grade (KSSM)", () => {
  it.each([
    [100, "A"], [82, "A"], [81, "B"], [66, "B"], [65, "C"], [50, "C"],
    [49, "D"], [35, "D"], [34, "E"], [20, "E"], [19, "F"], [0, "F"],
  ])("%i → %s", (m, l) => expect(letterGrade(m)).toBe(l));
});

describe("CGPA points", () => {
  it.each([
    [90, 4], [100, 4], [89, 3.75], [80, 3.75], [79, 3.5], [70, 3.5], [69, 3.25], [65, 3.25],
    [64, 3], [60, 3], [59, 2.75], [55, 2.75], [54, 2.5], [50, 2.5], [49, 2.25], [45, 2.25],
    [44, 2], [40, 2], [39, 1.75], [1, 1.75], [0, 0],
  ])("%i → %d", (m, p) => expect(cgpaPoints(m)).toBe(p));

  it("80 is a B letter but 3.75 points", () => {
    expect(letterGrade(80)).toBe("B");
    expect(cgpaPoints(80)).toBe(3.75);
  });
});

describe("entry rules", () => {
  it("blank mark defaults to pending", () => {
    expect(normalizeEntry(null)).toEqual({ status: "pending", mark: null });
  });
  it("absent forces mark 0", () => {
    expect(normalizeEntry(75, "absent")).toEqual({ status: "absent", mark: 0 });
  });
  it("exempted and pending clear the mark", () => {
    expect(normalizeEntry(75, "exempted").mark).toBeNull();
    expect(normalizeEntry(75, "pending").mark).toBeNull();
  });
  it("only whole numbers 0-100 are valid", () => {
    expect(parseMarkInput("")).toEqual({ ok: true, value: null });
    expect(parseMarkInput("100")).toEqual({ ok: true, value: 100 });
    expect(parseMarkInput("101").ok).toBe(false);
    expect(parseMarkInput("75.5").ok).toBe(false);
    expect(parseMarkInput("-1").ok).toBe(false);
  });
});

describe("exam summary", () => {
  it("pending is not counted and gives no false F", () => {
    const s = summarizeExam([
      { status: "completed", mark: 80 },
      { status: "completed", mark: 80 },
      { status: "pending", mark: null },
    ]);
    expect(s.counted).toBe(2);
    expect(s.pending).toBe(1);
    expect(s.total).toBe(160);
    expect(s.average).toBe(80);
    expect(s.cgpa).toBe(3.75);
  });
  it("exempted is not counted", () => {
    const s = summarizeExam([{ status: "completed", mark: 90 }, { status: "exempted", mark: null }]);
    expect(s.counted).toBe(1);
    expect(s.average).toBe(90);
  });
  it("absent counts as 0 marks and 0.00 points", () => {
    const s = summarizeExam([{ status: "completed", mark: 90 }, { status: "absent", mark: 0 }]);
    expect(s.counted).toBe(2);
    expect(s.average).toBe(45);
    expect(s.cgpa).toBe(2);
  });
  it("nothing counted shows a dash, not an error", () => {
    const s = summarizeExam([{ status: "pending", mark: null }]);
    expect(s.average).toBeNull();
    expect(s.cgpa).toBeNull();
    expect(formatAverage(s.average)).toBe("—");
  });
  it("average rounds to 2 decimals stored and 1 shown", () => {
    const s = summarizeExam([
      { status: "completed", mark: 80 },
      { status: "completed", mark: 81 },
      { status: "completed", mark: 81 },
    ]);
    expect(s.average).toBe(80.67);
    expect(formatAverage(s.average)).toBe("80.7");
  });
});

describe("change vs previous exam", () => {
  it("compares with own previous exam across Forms", () => {
    const pts = [
      { form: 1, exam: "uasa" as const, average: 70, cgpa: 3.5 },
      { form: 2, exam: "sumatif_1" as const, average: 75, cgpa: 3.25 },
    ];
    const d = changeVsPrevious(pts, 2, "sumatif_1");
    expect(d.average).toBe(5);
    expect(d.cgpa).toBe(-0.25);
  });
  it("no previous exam gives no change", () => {
    expect(changeVsPrevious([{ form: 1, exam: "sumatif_1", average: 70, cgpa: 3.5 }], 1, "sumatif_1").average).toBeNull();
  });
});

describe("yearly", () => {
  it("subject mean uses counted marks only", () => {
    expect(yearlySubjectMean([{ status: "completed", mark: 80 }, { status: "pending", mark: null }, { status: "completed", mark: 90 }])).toBe(85);
  });
  it("yearly average is equal-weight mean of exam averages that exist", () => {
    const y = yearlySummary([
      { total: 0, average: 70, cgpa: 3, counted: 1, pending: 0, exempted: 0, absent: 0 },
      { total: 0, average: 80, cgpa: 3.5, counted: 1, pending: 0, exempted: 0, absent: 0 },
      { total: 0, average: null, cgpa: null, counted: 0, pending: 1, exempted: 0, absent: 0 },
    ]);
    expect(y.average).toBe(75);
    expect(y.cgpa).toBe(3.25);
  });
});

describe("goals", () => {
  it("subject goal compares to the lower bound of the target band", () => {
    expect(subjectGoalProgress(78, "A")).toMatchObject({ gap: 4, met: false });
    expect(subjectGoalProgress(82, "A").met).toBe(true);
  });
  it("exam goal progress is capped at 100% with the gap shown", () => {
    expect(examGoalProgress(76.8, 80)).toMatchObject({ gap: 3.2, met: false });
    expect(examGoalProgress(90, 80).progress).toBe(1);
  });
});

describe("rank", async () => {
  const { rankTopPercent, rankPercentile } = await import("./grading");
  it("12 of 240 is top 5%", () => expect(rankTopPercent(12, 240)).toBe(5));
  it("percentile of 1st of 240 is 100", () => expect(rankPercentile(1, 240)).toBe(100));
  it("position beyond total is invalid", () => expect(rankTopPercent(241, 240)).toBeNull());
});
