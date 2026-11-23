import { describe, expect, it } from "vitest";
import type { Gradebook } from "./gradebook";
import { focusAreas, studyTasksFromPlan, subjectHighlights } from "./dashboard-derived";

function book(marks: Record<string, { status: "completed" | "pending" | "absent" | "exempted"; mark: number | null }>): Gradebook {
  const names = Object.keys(marks);
  return {
    subjects: names.map((n, i) => ({ id: n, form: 1, custom_name: n, subject_catalog: null, is_active: true, sort_order: i })) as unknown as Gradebook["subjects"],
    sessions: [{ id: "s1", form: 1, exam: "sumatif_1" }] as unknown as Gradebook["sessions"],
    marks: names.map((n) => ({ session_id: "s1", user_subject_id: n, ...marks[n] })) as unknown as Gradebook["marks"],
    goals: [],
  };
}

describe("dashboard subject highlights", () => {
  it("names the highest and lowest counted subject, ignoring pending", () => {
    const b = book({
      Matematik: { status: "completed", mark: 92 },
      Sejarah: { status: "completed", mark: 68 },
      Sains: { status: "pending", mark: null },
    });
    const h = subjectHighlights(b, 1, "sumatif_1", "ms");
    expect(h.best).toEqual({ name: "Matematik", mark: 92 });
    expect(h.worst).toEqual({ name: "Sejarah", mark: 68 });
  });

  it("absent counts as 0, so it is the lowest subject", () => {
    const b = book({ BM: { status: "completed", mark: 70 }, BI: { status: "absent", mark: null } });
    expect(subjectHighlights(b, 1, "sumatif_1", "ms").worst).toEqual({ name: "BI", mark: 0 });
  });

  it("with only one counted subject there is no separate lowest", () => {
    const b = book({ BM: { status: "completed", mark: 70 } });
    expect(subjectHighlights(b, 1, "sumatif_1", "ms").worst).toBeNull();
  });
});

describe("dashboard focus areas", () => {
  it("lists subjects within 3 marks of the next grade, closest first", () => {
    const b = book({
      // Form 1 scale: A from 85, B from 70
      BM: { status: "completed", mark: 83 }, // 2 to A
      BI: { status: "completed", mark: 68 }, // 2 to B
      Sains: { status: "completed", mark: 82 }, // 3 to A
      Sejarah: { status: "completed", mark: 64 }, // 6 to B — not close
    });
    const f = focusAreas(b, 1, "sumatif_1", "ms");
    expect(f.map((x) => [x.name, x.marksNeeded, x.letter])).toEqual([
      ["BM", 2, "A"],
      ["BI", 2, "B"],
      ["Sains", 3, "A"],
    ]);
  });
});

describe("study tasks from a saved plan", () => {
  it("takes the first 3 tasks across the plan's days", () => {
    const tasks = studyTasksFromPlan("p1", {
      days: [
        { day: "Isnin", focus: [{ subject: "BM", task: "Karangan", minutes: 30 }] },
        { day: "Selasa", focus: [{ subject: "Sains", task: "Bab 3", minutes: 45 }, { subject: "Sejarah", task: "Nota", minutes: 20 }, { subject: "BI", task: "Essay", minutes: 30 }] },
      ],
    });
    expect(tasks.map((t) => t.id)).toEqual(["p1:0", "p1:1", "p1:2"]);
    expect(tasks[2]).toMatchObject({ subject: "Sejarah", task: "Nota", minutes: 20, day: "Selasa" });
  });

  it("returns nothing for a missing or malformed plan", () => {
    expect(studyTasksFromPlan("p1", null)).toEqual([]);
    expect(studyTasksFromPlan("p1", { days: "x" })).toEqual([]);
  });
});
