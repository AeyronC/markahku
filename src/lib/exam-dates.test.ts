import { describe, expect, it } from "vitest";
import { daysUntil, estimatedExamDate, examDateKey, nextExam } from "./exam-dates";

describe("estimated exam dates (Estimate with edit)", () => {
  it("uses fixed term estimates for each exam in a given year", () => {
    expect(estimatedExamDate("sumatif_1", 2026)).toBe("2026-03-16");
    expect(estimatedExamDate("sumatif_2", 2026)).toBe("2026-07-13");
    expect(estimatedExamDate("uasa", 2026)).toBe("2026-10-19");
  });

  it("counts whole days until an exam, never negative", () => {
    expect(daysUntil("2026-03-01", "2026-03-16")).toBe(15);
    expect(daysUntil("2026-03-16", "2026-03-16")).toBe(0);
    expect(daysUntil("2026-03-20", "2026-03-16")).toBe(0);
  });
});

describe("next exam countdown", () => {
  it("picks the earliest exam of the current Form that has not happened yet", () => {
    const n = nextExam({ today: "2026-05-01", currentForm: 2, saved: {} });
    expect(n).toEqual({ form: 2, exam: "sumatif_2", date: "2026-07-13", estimated: true, daysLeft: 73 });
  });

  it("a date the student saved replaces the estimate and is marked confirmed", () => {
    const n = nextExam({ today: "2026-05-01", currentForm: 2, saved: { [examDateKey(2, "sumatif_2")]: "2026-06-02" } });
    expect(n).toMatchObject({ exam: "sumatif_2", date: "2026-06-02", estimated: false, daysLeft: 32 });
  });

  it("skips an exam that already has marks entered", () => {
    const n = nextExam({ today: "2026-05-01", currentForm: 2, saved: {}, withMarks: new Set([examDateKey(2, "sumatif_2")]) });
    expect(n).toMatchObject({ form: 2, exam: "uasa" });
  });

  it("after UASA it rolls to next Form's Sumatif 1 the following year", () => {
    const n = nextExam({ today: "2026-11-23", currentForm: 2, saved: {} });
    expect(n).toMatchObject({ form: 3, exam: "sumatif_1", date: "2027-03-16", estimated: true });
  });

  it("Form 5 has nothing after UASA", () => {
    expect(nextExam({ today: "2026-11-23", currentForm: 5, saved: {} })).toBeNull();
  });
});
