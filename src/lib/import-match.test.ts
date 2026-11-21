import { describe, expect, it } from "vitest";
import { guessMapping, matchSubject, sheetToRows } from "./import-match";

const subjects = [
  { id: "bm", names: ["Bahasa Melayu", "Malay Language"] },
  { id: "bi", names: ["Bahasa Inggeris", "English"] },
  { id: "mt", names: ["Matematik", "Mathematics"] },
  { id: "iban", names: ["Bahasa Iban"] },
];

describe("subject matching", () => {
  it("matches short forms", () => {
    expect(matchSubject("BM", subjects)).toBe("bm");
    expect(matchSubject("Maths", subjects)).toBe("mt");
    expect(matchSubject("english", subjects)).toBe("bi");
  });
  it("matches custom subjects by name", () => expect(matchSubject("bahasa iban", subjects)).toBe("iban"));
  it("leaves unknown subjects unmatched", () => expect(matchSubject("Kimia", subjects)).toBeNull());
});

describe("sheet import", () => {
  it("re-imports the export layout", () => {
    const header = ["Form", "Exam", "Subject", "Mark", "Status", "Academic year"];
    const map = guessMapping(header);
    const rows = sheetToRows(
      [
        [2, "Sumatif 1", "Matematik", 80, "Completed", 2026],
        [2, "UASA", "English", "", "Pending", 2026],
        [2, "Sumatif 2", "Sains", 0, "Absent", 2026],
      ],
      map,
      1,
      "sumatif_1",
    );
    expect(rows).toEqual([
      { form: 2, exam: "sumatif_1", subject: "Matematik", mark: 80, status: "completed", invalid: false },
      { form: 2, exam: "uasa", subject: "English", mark: null, status: "pending", invalid: false },
      { form: 2, exam: "sumatif_2", subject: "Sains", mark: 0, status: "absent", invalid: false },
    ]);
  });
  it("reads a class sheet with one column per exam and skips blanks", () => {
    const map = guessMapping(["Subjek", "Sumatif 1", "Sumatif 2", "UASA"]);
    const rows = sheetToRows([["BM", 84, "", "TH"]], map, 1, "sumatif_1");
    expect(rows).toEqual([
      { form: 1, exam: "sumatif_1", subject: "BM", mark: 84, status: "completed", invalid: false },
      { form: 1, exam: "uasa", subject: "BM", mark: 0, status: "absent", invalid: false },
    ]);
  });
  it("flags marks outside 0-100", () => {
    const map = guessMapping(["Subject", "Mark"]);
    expect(sheetToRows([["BM", 120]], map, 1, "uasa")[0]?.invalid).toBe(true);
  });
});
