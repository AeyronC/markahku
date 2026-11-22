import {
  EXAM_TYPES,
  cgpaPoints,
  effectiveMark,
  formatAverage,
  formatCgpa,
  letterGrade,
  summarizeExam,
  yearlySubjectMean,
  yearlySummary,
  type ExamType,
  type MarkStatus,
} from "./grading";
import { entriesForSession, markFor, sessionFor, subjectName, subjectsForForm, type Gradebook } from "./gradebook";
import { allExamPoints } from "./book-derived";
import { translate, type Lang } from "./i18n-dict";

export const EXAM_LABEL: Record<ExamType, string> = {
  sumatif_1: "Sumatif 1",
  sumatif_2: "Sumatif 2",
  uasa: "UASA",
};

/** Parse an exam name typed in a spreadsheet or read from a photo. */
export function parseExam(raw: unknown): ExamType | null {
  const s = String(raw ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  if (!s) return null;
  if (s === "sumatif_1" || s === "sumatif_2" || s === "uasa") return s;
  if (s.includes("uasa") || s.includes("akhir") || s.includes("final") || s.includes("pat") || s.includes("end of")) return "uasa";
  if (/(sumatif|sum|s|summative|ujian)\s*-?\s*2\b/.test(s) || s === "2") return "sumatif_2";
  if (/(sumatif|sum|s|summative|ujian)\s*-?\s*1\b/.test(s) || s === "1") return "sumatif_1";
  return null;
}

export function parseStatus(raw: unknown): MarkStatus | null {
  const s = String(raw ?? "").toLowerCase().trim();
  if (!s) return null;
  if (["completed", "selesai", "done"].includes(s)) return "completed";
  if (["pending", "belum ada", "belum", "-"].includes(s)) return "pending";
  if (["exempted", "exempt", "dikecualikan", "kecuali"].includes(s)) return "exempted";
  if (["absent", "tidak hadir", "th", "th", "ab"].includes(s)) return "absent";
  return null;
}

const MARKS_HEADER = ["Form", "Exam", "Subject", "Mark", "Status", "Academic year"];

const STATUS_LABEL: Record<MarkStatus, string> = {
  completed: "Completed",
  pending: "Pending",
  exempted: "Exempted",
  absent: "Absent",
};

export function marksTable(book: Gradebook, lang: Lang) {
  const header = [...MARKS_HEADER];
  const rows: (string | number)[][] = [];
  const sessions = [...book.sessions].sort((a, b) => a.form - b.form || EXAM_TYPES.indexOf(a.exam) - EXAM_TYPES.indexOf(b.exam));
  for (const s of sessions) {
    for (const m of book.marks.filter((x) => x.session_id === s.id)) {
      const subj = book.subjects.find((x) => x.id === m.user_subject_id);
      rows.push([s.form, EXAM_LABEL[s.exam], subjectName(subj, lang), m.mark ?? "", STATUS_LABEL[m.status], s.academic_year ?? ""]);
    }
  }
  return { header, rows };
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadMarksTemplate() {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.aoa_to_sheet([MARKS_HEADER]);
  const csv = XLSX.utils.sheet_to_csv(ws);
  download(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }), "markahku-template.csv");
}

export async function exportMarks(book: Gradebook, lang: Lang, kind: "xlsx" | "csv") {
  const XLSX = await import("xlsx");
  const { header, rows } = marksTable(book, lang);
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  if (kind === "csv") {
    const csv = XLSX.utils.sheet_to_csv(ws);
    download(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }), "markahku-marks.csv");
    return;
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Marks");
  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  download(new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), "markahku-marks.xlsx");
}

export function downloadJson(data: unknown, filename: string) {
  download(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), filename);
}

type Doc = import("jspdf").jsPDF;

function drawTrend(doc: Doc, x: number, y: number, w: number, h: number, values: { label: string; v: number | null }[], title: string) {
  doc.setFontSize(11);
  doc.setTextColor(20, 33, 61);
  doc.text(title, x, y - 4);
  doc.setDrawColor(210, 218, 230);
  doc.rect(x, y, w, h);
  const pts = values.filter((p) => p.v != null);
  if (!pts.length) return;
  const n = values.length;
  const px = (i: number) => x + 10 + (n === 1 ? (w - 20) / 2 : (i * (w - 20)) / (n - 1));
  const py = (v: number) => y + h - 8 - (v / 100) * (h - 16);
  doc.setFontSize(7);
  doc.setTextColor(110, 120, 140);
  for (const g of [0, 50, 100]) {
    doc.setDrawColor(235, 239, 245);
    doc.line(x + 4, py(g), x + w - 4, py(g));
    doc.text(String(g), x + 1, py(g) + 2);
  }
  doc.setDrawColor(14, 165, 183);
  doc.setLineWidth(0.8);
  let prev: [number, number] | null = null;
  values.forEach((p, i) => {
    if (p.v == null) return;
    const cur: [number, number] = [px(i), py(p.v)];
    if (prev) doc.line(prev[0], prev[1], cur[0], cur[1]);
    doc.setFillColor(14, 165, 183);
    doc.circle(cur[0], cur[1], 1.2, "F");
    doc.setTextColor(20, 33, 61);
    doc.text(formatAverage(p.v), cur[0] - 3, cur[1] - 3);
    prev = cur;
  });
  doc.setLineWidth(0.2);
  doc.setTextColor(110, 120, 140);
  values.forEach((p, i) => doc.text(p.label, px(i) - 6, y + h + 5));
}

async function newDoc() {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  return { doc, autoTable };
}

function header(doc: Doc, title: string, sub: string) {
  doc.setFillColor(11, 18, 32);
  doc.rect(0, 0, 210, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.text("MarkahKu", 14, 12);
  doc.setFontSize(10);
  doc.text(title, 14, 19);
  doc.setTextColor(170, 190, 210);
  doc.text(sub, 14, 24);
}

function kpis(doc: Doc, y: number, items: [string, string][]) {
  const w = (182 - (items.length - 1) * 3) / items.length;
  items.forEach(([label, value], i) => {
    const x = 14 + i * (w + 3);
    doc.setFillColor(242, 246, 250);
    doc.roundedRect(x, y, w, 16, 2, 2, "F");
    doc.setFontSize(7);
    doc.setTextColor(110, 120, 140);
    doc.text(label.toUpperCase(), x + 3, y + 5);
    doc.setFontSize(12);
    doc.setTextColor(20, 33, 61);
    doc.text(value, x + 3, y + 12);
  });
}

export async function exportExamPdf(book: Gradebook, form: number, exam: ExamType, lang: Lang) {
  const t = (k: Parameters<typeof translate>[1], v?: Record<string, string | number>) => translate(lang, k, v);
  const { doc, autoTable } = await newDoc();
  const session = sessionFor(book, form, exam);
  const sum = summarizeExam(entriesForSession(book, session?.id));
  header(doc, `${EXAM_LABEL[exam]} - ${t("common.formN", { n: form })}`, new Date().toLocaleDateString(lang === "ms" ? "ms-MY" : "en-MY"));
  kpis(doc, 34, [
    [t("common.total"), String(sum.total)],
    [t("common.average"), formatAverage(sum.average)],
    [t("common.cgpa"), formatCgpa(sum.cgpa)],
    [t("common.counted"), `${sum.counted} / ${sum.counted + sum.pending + sum.exempted}`],
    [t("common.rank"), session?.rank_position ? `${session.rank_position} / ${session.rank_total ?? "-"}` : "-"],
  ]);
  const subjects = subjectsForForm(book, form, true).filter((s) => s.is_active || markFor(book, session?.id, s.id));
  autoTable(doc, {
    startY: 56,
    head: [[t("common.subject"), t("common.mark"), t("common.grade"), t("common.points"), t("common.status")]],
    body: subjects.map((s) => {
      const e = markFor(book, session?.id, s.id);
      const m = e ? effectiveMark(e) : null;
      return [
        subjectName(s, lang),
        m ?? "-",
        m != null ? letterGrade(m) : "-",
        m != null ? cgpaPoints(m).toFixed(2) : "-",
        t(`status.${e?.status ?? "pending"}`),
      ];
    }),
    headStyles: { fillColor: [20, 33, 61] },
    styles: { fontSize: 9 },
  });
  const pts = allExamPoints(book).filter((p) => p.form === form);
  const endY = (doc as Doc & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 120;
  drawTrend(
    doc,
    14,
    endY + 14,
    182,
    50,
    EXAM_TYPES.map((e) => ({ label: EXAM_LABEL[e], v: pts.find((p) => p.exam === e)?.average ?? null })),
    `${t("dash.trend")} - ${t("common.average")}`,
  );
  doc.save(`markahku-f${form}-${exam}.pdf`);
}

export async function exportYearPdf(book: Gradebook, form: number, lang: Lang) {
  const t = (k: Parameters<typeof translate>[1], v?: Record<string, string | number>) => translate(lang, k, v);
  const { doc, autoTable } = await newDoc();
  const per = EXAM_TYPES.map((e) => summarizeExam(entriesForSession(book, sessionFor(book, form, e)?.id)));
  const y = yearlySummary(per);
  header(doc, `${t("yr.title")} - ${t("common.formN", { n: form })}`, new Date().toLocaleDateString(lang === "ms" ? "ms-MY" : "en-MY"));
  kpis(doc, 34, [
    [t("yr.yearAvg"), formatAverage(y.average)],
    [t("yr.yearCgpa"), formatCgpa(y.cgpa)],
    ...EXAM_TYPES.map((e, i) => [EXAM_LABEL[e], formatAverage(per[i]!.average)] as [string, string]),
  ]);
  const subjects = subjectsForForm(book, form, true);
  autoTable(doc, {
    startY: 56,
    head: [[t("common.subject"), ...EXAM_TYPES.map((e) => EXAM_LABEL[e]), t("common.mean"), t("common.grade")]],
    body: subjects.map((s) => {
      const entries = EXAM_TYPES.map((e) => markFor(book, sessionFor(book, form, e)?.id, s.id));
      const mean = yearlySubjectMean(entries);
      return [
        subjectName(s, lang),
        ...entries.map((e) => {
          const m = e ? effectiveMark(e) : null;
          return m != null ? `${m} (${letterGrade(m)})` : "-";
        }),
        mean != null ? formatAverage(mean) : "-",
        mean != null ? letterGrade(mean) : "-",
      ];
    }),
    headStyles: { fillColor: [20, 33, 61] },
    styles: { fontSize: 9 },
  });
  const endY = (doc as Doc & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 120;
  drawTrend(
    doc,
    14,
    endY + 14,
    182,
    50,
    EXAM_TYPES.map((e, i) => ({ label: EXAM_LABEL[e], v: per[i]!.average })),
    `${t("dash.trend")} - ${t("common.average")}`,
  );
  doc.save(`markahku-f${form}-year.pdf`);
}
