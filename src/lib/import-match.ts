import { parseMarkInput, type ExamType, type MarkStatus } from "./grading";
import { parseExam, parseStatus } from "./export";

export function norm(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Common short forms on Malaysian report cards → a canonical Malay catalogue name. */
const ALIASES: Record<string, string> = {
  bm: "bahasa melayu",
  "b melayu": "bahasa melayu",
  "malay": "bahasa melayu",
  "malay language": "bahasa melayu",
  bi: "bahasa inggeris",
  "b inggeris": "bahasa inggeris",
  english: "bahasa inggeris",
  "english language": "bahasa inggeris",
  mt: "matematik",
  mm: "matematik",
  math: "matematik",
  maths: "matematik",
  mathematics: "matematik",
  sc: "sains",
  sn: "sains",
  science: "sains",
  sej: "sejarah",
  sj: "sejarah",
  history: "sejarah",
  geo: "geografi",
  gg: "geografi",
  geography: "geografi",
  psv: "pendidikan seni visual",
  seni: "pendidikan seni visual",
  "visual arts": "pendidikan seni visual",
  pjk: "pendidikan jasmani dan kesihatan",
  pj: "pendidikan jasmani dan kesihatan",
  ask: "asas sains komputer",
  "computer science": "asas sains komputer",
  pm: "pendidikan moral",
  moral: "pendidikan moral",
  pi: "pendidikan islam",
  "p islam": "pendidikan islam",
  "islamic education": "pendidikan islam",
  "add math": "matematik tambahan",
  addmath: "matematik tambahan",
  addmaths: "matematik tambahan",
  "add maths": "matematik tambahan",
  "additional mathematics": "matematik tambahan",
  "additional math": "matematik tambahan",
  "mt tambahan": "matematik tambahan",
  fizik: "fizik",
  physics: "fizik",
  phy: "fizik",
  kimia: "kimia",
  chemistry: "kimia",
  chem: "kimia",
  biologi: "biologi",
  biology: "biologi",
  bio: "biologi",
  "prinsip perakaunan": "prinsip perakaunan",
  "prinsip akaun": "prinsip perakaunan",
  akaun: "prinsip perakaunan",
  accounting: "prinsip perakaunan",
  "principles of accounting": "prinsip perakaunan",
  pa: "prinsip perakaunan",
  perniagaan: "perniagaan",
  business: "perniagaan",
  "business studies": "perniagaan",
  ekonomi: "ekonomi",
  economics: "ekonomi",
  economy: "ekonomi",
  eko: "ekonomi",
  "tasawwur islam": "tasawwur islam",
  tasawwur: "tasawwur islam",
  "sains komputer": "sains komputer",
  sk: "sains komputer",
};

export interface MatchCandidate {
  id: string;
  names: string[];
}

export function matchSubject(raw: string, candidates: MatchCandidate[]): string | null {
  const n = norm(raw);
  if (!n) return null;
  const target = ALIASES[n] ?? n;
  const byName = (pred: (name: string) => boolean) => candidates.find((c) => c.names.some((x) => pred(norm(x))))?.id ?? null;
  return (
    byName((x) => x === target || x === n) ??
    byName((x) => ALIASES[x] === target) ??
    (target.length >= 4 ? byName((x) => x.includes(target) || target.includes(x)) : null)
  );
}

export interface SheetMapping {
  subject: number;
  mark: number;
  exam: number;
  form: number;
  status: number;
  perExam: Record<ExamType, number>;
}

export const NONE = -1;

export function guessMapping(header: string[]): SheetMapping {
  const h = header.map((x) => norm(String(x ?? "")));
  const find = (...keys: string[]) => h.findIndex((x) => keys.some((k) => x === k || x.startsWith(k)));
  const perExam: Record<ExamType, number> = { sumatif_1: NONE, sumatif_2: NONE, uasa: NONE };
  h.forEach((x, i) => {
    if (!x || x === "exam" || x === "peperiksaan") return;
    const e = parseExam(x);
    if (e && perExam[e] === NONE) perExam[e] = i;
  });
  return {
    subject: find("subject", "subjek", "mata pelajaran", "matapelajaran"),
    mark: find("mark", "markah", "marks", "score"),
    exam: find("exam", "peperiksaan", "ujian"),
    form: find("form", "tingkatan"),
    status: find("status"),
    perExam,
  };
}

export interface ParsedSheetRow {
  form: number;
  exam: ExamType;
  subject: string;
  mark: number | null;
  status: MarkStatus;
  invalid: boolean;
}

function cellToEntry(cell: unknown, statusCell: unknown): { mark: number | null; status: MarkStatus; invalid: boolean } | null {
  const explicit = parseStatus(statusCell);
  const raw = String(cell ?? "").trim();
  const asStatus = parseStatus(raw);
  if (asStatus && asStatus !== "completed") return { mark: asStatus === "absent" ? 0 : null, status: asStatus, invalid: false };
  if (!raw) return explicit && explicit !== "completed" ? { mark: explicit === "absent" ? 0 : null, status: explicit, invalid: false } : null;
  const numeric = raw.replace(/\.0+$/, "");
  const p = parseMarkInput(numeric);
  if (!p.ok) return { mark: null, status: "completed", invalid: true };
  if (explicit === "absent") return { mark: 0, status: "absent", invalid: false };
  if (explicit === "exempted" || explicit === "pending") return { mark: null, status: explicit, invalid: false };
  return p.value == null ? null : { mark: p.value, status: "completed", invalid: false };
}

/** Turn spreadsheet rows into mark rows using the chosen columns. Blank cells are skipped. */
export function sheetToRows(rows: unknown[][], map: SheetMapping, defaultForm: number, defaultExam: ExamType): ParsedSheetRow[] {
  const out: ParsedSheetRow[] = [];
  const wide = Object.values(map.perExam).some((i) => i !== NONE);
  for (const r of rows) {
    const subject = String(r[map.subject] ?? "").trim();
    if (!subject || map.subject === NONE) continue;
    const f = map.form !== NONE ? Number(String(r[map.form] ?? "").replace(/\D/g, "")) : NaN;
    const form = f >= 1 && f <= 5 ? f : defaultForm;
    const statusCell = map.status !== NONE ? r[map.status] : undefined;
    if (wide) {
      for (const [exam, col] of Object.entries(map.perExam) as [ExamType, number][]) {
        if (col === NONE) continue;
        const e = cellToEntry(r[col], undefined);
        if (e) out.push({ form, exam, subject, ...e });
      }
    } else {
      if (map.mark === NONE) continue;
      const exam = (map.exam !== NONE ? parseExam(r[map.exam]) : null) ?? defaultExam;
      const e = cellToEntry(r[map.mark], statusCell);
      if (e) out.push({ form, exam, subject, ...e });
    }
  }
  return out;
}
