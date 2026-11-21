import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, ImageIcon, Loader2, Trash2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ExamSelect, FormSelect, GradeBadge, PageHeader } from "@/components/mk/ui";
import { usePrefs, useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { EXAM_TYPES, MARK_STATUSES, effectiveMark, normalizeEntry, parseMarkInput, type ExamType, type MarkStatus } from "@/lib/grading";
import {
  addCustomSubject,
  currentUserId,
  ensureFormSubjects,
  ensureSession,
  gradebookQuery,
  markFor,
  saveMarks,
  sessionFor,
  subjectName,
  subjectsForForm,
  useGradebook,
  useProfile,
  type Gradebook,
} from "@/lib/gradebook";
import { NONE, guessMapping, matchSubject, sheetToRows, type SheetMapping } from "@/lib/import-match";
import { ocrMarks } from "@/lib/ai.functions";

export const Route = createFileRoute("/_authenticated/import")({
  head: () => ({
    meta: [
      { title: "Import keputusan · Import results — MarkahKu" },
      { name: "description", content: "Import past results from Excel, CSV or a photo of your report card, then review before saving." },
      { property: "og:title", content: "Import results — MarkahKu" },
      { property: "og:description", content: "Import past results from Excel, CSV or a photo, then review before saving." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ImportWizard,
});

type Kind = "sheet" | "image";
type Row = {
  key: string;
  form: number;
  exam: ExamType;
  raw: string;
  subjectId: string; // id | "__new" | "__skip"
  input: string;
  status: MarkStatus;
  uncertain: boolean;
};
type DupChoice = "keep" | "replace" | "skip";

const MAX_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

async function downscale(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const scale = Math.min(1, 2000 / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function ImportWizard() {
  const t = useT();
  const { lang } = usePrefs();
  const qc = useQueryClient();
  const { data: book } = useGradebook();
  const { data: profile } = useProfile();
  const ocr = useServerFn(ocrMarks);
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<number>(profile?.current_form ?? 1);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [defaultExam, setDefaultExam] = useState<ExamType>("sumatif_1");
  const [file, setFile] = useState<File | null>(null);
  const [kind, setKind] = useState<Kind | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [sheet, setSheet] = useState<{ header: string[]; rows: unknown[][] } | null>(null);
  const [mapping, setMapping] = useState<SheetMapping | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [dups, setDups] = useState<Record<string, DupChoice>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);

  useEffect(() => {
    if (profile?.current_form && step === 1) setForm(profile.current_form);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.current_form]);

  const steps = [t("imp.s1"), t("imp.s2"), t("imp.s3"), t("imp.s4"), t("imp.s5")];

  async function onFile(f: File) {
    if (f.size > MAX_BYTES) { toast.error(t("imp.tooBig")); return; }
    const name = f.name.toLowerCase();
    const isSheet = name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".csv");
    const isImage = IMAGE_TYPES.includes(f.type);
    if (!isSheet && !isImage) { toast.error(t("imp.badType")); return; }
    setFile(f);
    if (isSheet) {
      setBusy("read");
      try {
        const XLSX = await import("xlsx");
        const wb = XLSX.read(await f.arrayBuffer(), { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]!]!;
        const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: false, defval: "" });
        const [header = [], ...body] = aoa;
        const h = header.map((x) => String(x ?? ""));
        setSheet({ header: h, rows: body });
        setMapping(guessMapping(h));
        setKind("sheet");
        setStep(3);
      } catch (e) {
        console.error(e);
        toast.error(t("common.error"));
      } finally {
        setBusy(null);
      }
      return;
    }
    setKind("image");
    setPreview(URL.createObjectURL(f));
    setStep(3);
    setBusy("ocr");
    try {
      const dataUrl = await downscale(f);
      const names = book ? subjectsForForm(book, form, true).map((s) => subjectName(s, lang)) : [];
      const res = await ocr({ data: { image: dataUrl, form, subjects: names } });
      if (!res.ok) {
        toast.error(res.code === "cap" ? t("imp.capReached") : t("common.error"));
        setStep(2);
        return;
      }
      if (!res.data.length) {
        toast.error(t("imp.nothing"));
        setStep(2);
        return;
      }
      await buildRows(
        res.data.map((r) => ({
          form,
          exam: r.exam ?? defaultExam,
          subject: r.subject,
          mark: r.absent ? 0 : r.mark,
          status: r.absent ? ("absent" as const) : r.mark == null ? ("pending" as const) : ("completed" as const),
          invalid: false,
          uncertain: r.confidence === "low" || (r.mark == null && !r.absent),
        })),
      );
    } catch (e) {
      console.error(e);
      toast.error(t("common.error"));
      setStep(2);
    } finally {
      setBusy(null);
    }
  }

  async function buildRows(parsed: { form: number; exam: ExamType; subject: string; mark: number | null; status: MarkStatus; invalid: boolean; uncertain?: boolean }[]) {
    // Make sure every Form in the file has a subject list to match against.
    const forms = [...new Set(parsed.map((p) => p.form))];
    for (const f of forms) await ensureFormSubjects(f);
    await qc.invalidateQueries({ queryKey: ["gradebook"] });
    const fresh = await qc.fetchQuery(gradebookQuery);
    setRows(
      parsed.map((p, i) => {
        const cands = subjectsForForm(fresh, p.form, true).map((s) => ({
          id: s.id,
          names: [s.custom_name ?? "", s.subject_catalog?.name_ms ?? "", s.subject_catalog?.name_en ?? ""].filter(Boolean),
        }));
        const id = matchSubject(p.subject, cands);
        return {
          key: `${i}`,
          form: p.form,
          exam: p.exam,
          raw: p.subject,
          subjectId: id ?? "__new",
          input: p.mark != null ? String(p.mark) : "",
          status: p.status,
          uncertain: !!p.uncertain || p.invalid || !id,
        };
      }),
    );
  }

  async function mappingNext() {
    if (!sheet || !mapping) return;
    const parsed = sheetToRows(sheet.rows, mapping, form, defaultExam);
    if (!parsed.length) { toast.error(t("imp.nothing")); return; }
    setBusy("read");
    try {
      await buildRows(parsed);
      setStep(4);
    } finally {
      setBusy(null);
    }
  }

  const validRows = rows.filter((r) => r.subjectId !== "__skip");
  const rowEntry = (r: Row) => {
    const p = parseMarkInput(r.input);
    return p.ok ? normalizeEntry(p.value, r.status === "completed" ? undefined : r.status) : null;
  };
  const hasInvalid = validRows.some((r) => !rowEntry(r));

  const duplicates = useMemo(() => {
    if (!book) return [];
    return validRows
      .filter((r) => r.subjectId !== "__new")
      .map((r) => ({ row: r, existing: markFor(book, sessionFor(book, r.form, r.exam)?.id, r.subjectId) }))
      .filter((d) => d.existing && (d.existing.status !== "pending" || d.existing.mark != null));
  }, [book, validRows]);

  const toSave = validRows.filter((r) => {
    const d = duplicates.find((x) => x.row.key === r.key);
    return !d || (dups[r.key] ?? "keep") === "replace";
  });

  async function save() {
    if (!book || !file) return;
    setBusy("save");
    try {
      const uid = await currentUserId();
      const yr = Number(year) || null;
      // Create any new subjects first.
      const newIds = new Map<string, string>();
      for (const r of toSave.filter((x) => x.subjectId === "__new")) {
        const k = `${r.form}|${r.raw.toLowerCase()}`;
        if (!newIds.has(k)) newIds.set(k, (await addCustomSubject(r.form, r.raw)).id);
      }
      const groups = new Map<string, Row[]>();
      for (const r of toSave) {
        const k = `${r.form}|${r.exam}`;
        groups.set(k, [...(groups.get(k) ?? []), r]);
      }
      const sessions = new Map<string, string>();
      for (const k of groups.keys()) {
        const [f, e] = k.split("|");
        sessions.set(k, (await ensureSession(Number(f), e as ExamType, yr)).id);
      }
      // Keep the original privately, linked to each exam it fed.
      const firstSession = [...sessions.values()][0];
      const fileIds = new Map<string, string>();
      if (firstSession) {
        const ext = (file.name.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5);
        const path = `${uid}/${firstSession}/${crypto.randomUUID()}.${ext}`;
        const up = await supabase.storage.from("mark-sources").upload(path, file, { contentType: file.type || undefined });
        if (up.error) throw up.error;
        for (const [k, sid] of sessions) {
          const { data, error } = await supabase
            .from("source_files")
            .insert({ user_id: uid, session_id: sid, storage_path: path, mime_type: file.type || null })
            .select("id")
            .single();
          if (error) throw error;
          fileIds.set(k, data.id);
        }
      }
      let n = 0;
      for (const [k, list] of groups) {
        const sid = sessions.get(k)!;
        const seen = new Set<string>();
        const writes = list
          .map((r) => {
            const e = rowEntry(r)!;
            const id = r.subjectId === "__new" ? newIds.get(`${r.form}|${r.raw.toLowerCase()}`)! : r.subjectId;
            return { user_subject_id: id, status: e.status, mark: e.mark, source: kind === "image" ? ("ocr" as const) : ("import" as const), source_file_id: fileIds.get(k) ?? null };
          })
          .reverse()
          .filter((w) => (seen.has(w.user_subject_id) ? false : (seen.add(w.user_subject_id), true)));
        await saveMarks(sid, writes);
        n += writes.length;
      }
      await qc.invalidateQueries({ queryKey: ["gradebook"] });
      setDone(n);
      toast.success(t("imp.done", { n }));
    } catch (e) {
      console.error(e);
      toast.error(t("common.error"));
    } finally {
      setBusy(null);
    }
  }

  function reset() {
    setStep(1);
    setFile(null);
    setKind(null);
    setPreview(null);
    setSheet(null);
    setMapping(null);
    setRows([]);
    setDups({});
    setDone(null);
  }

  const update = (key: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  return (
    <>
      <PageHeader title={t("imp.title")} sub={t("imp.sub")} />
      <ol className="mb-6 flex gap-2 overflow-x-auto pb-1">
        {steps.map((s, i) => (
          <li
            key={s}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium",
              i + 1 === step ? "bg-primary text-primary-foreground" : i + 1 < step ? "bg-accent text-accent-foreground" : "glass text-muted-foreground",
            )}
          >
            <span className="font-mono">{i + 1}</span> {s}
          </li>
        ))}
      </ol>

      {done != null ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
            <CheckCircle2 className="size-12 text-success" />
            <div className="font-display text-xl font-semibold">{t("imp.done", { n: done })}</div>
            <div className="flex gap-2">
              <Button asChild variant="hero">
                <Link to="/dashboard">{t("nav.dashboard")}</Link>
              </Button>
              <Button variant="outline" onClick={reset}>
                {t("nav.import")}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {step === 1 && (
            <Card>
              <CardContent className="grid gap-4 p-6 sm:grid-cols-3">
                <div>
                  <Label>{t("common.form")}</Label>
                  <FormSelect className="mt-1.5 w-full" value={form} onChange={setForm} />
                </div>
                <div>
                  <Label htmlFor="yr">{t("common.year")}</Label>
                  <Input id="yr" inputMode="numeric" className="mt-1.5 font-mono" value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))} />
                </div>
                <div>
                  <Label>{t("imp.defaultExam")}</Label>
                  <ExamSelect className="mt-1.5 w-full" value={defaultExam} onChange={setDefaultExam} />
                </div>
                <div className="sm:col-span-3 flex justify-end">
                  <Button variant="hero" onClick={() => setStep(2)}>
                    {t("common.next")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 2 && (
            <Card>
              <CardContent className="p-6">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={!!busy}
                  className="flex w-full flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-border px-6 py-14 text-center transition-colors hover:border-primary hover:bg-accent/40"
                >
                  {busy ? <Loader2 className="size-8 animate-spin text-primary" /> : <Upload className="size-8 text-primary" />}
                  <span className="font-display text-lg font-semibold">{t("imp.drop")}</span>
                  <span className="text-sm text-muted-foreground">{t("imp.types")}</span>
                  <span className="mt-2 flex gap-3 text-muted-foreground">
                    <FileSpreadsheet className="size-5" /> <ImageIcon className="size-5" />
                  </span>
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  className="hidden"
                  accept=".xlsx,.xls,.csv,image/jpeg,image/png,image/webp"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) void onFile(f);
                  }}
                />
                <div className="mt-4 flex justify-start">
                  <Button variant="ghost" onClick={() => setStep(1)}>
                    {t("common.back")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 3 && kind === "image" && (
            <Card>
              <CardContent className="grid gap-6 p-6 md:grid-cols-2">
                {preview && <img src={preview} alt={t("imp.original")} className="max-h-[480px] w-full rounded-xl object-contain" />}
                <div className="flex flex-col justify-center gap-4">
                  {busy === "ocr" ? (
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <Loader2 className="size-5 animate-spin text-primary" /> {t("imp.reading")}
                    </div>
                  ) : (
                    <>
                      <div className="font-display text-lg font-semibold">{t("imp.rows", { n: rows.length })}</div>
                      <p className="text-sm text-muted-foreground">{t("imp.reviewHint")}</p>
                      <Button variant="hero" onClick={() => setStep(4)} disabled={!rows.length}>
                        {t("common.next")}
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {step === 3 && kind === "sheet" && sheet && mapping && (
            <Card>
              <CardContent className="space-y-5 p-6">
                <h3 className="font-semibold">{t("imp.mapCols")}</h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <ColSelect label={t("imp.colSubject")} header={sheet.header} value={mapping.subject} onChange={(v) => setMapping({ ...mapping, subject: v })} allowNone={false} />
                  <ColSelect label={t("imp.colMark")} header={sheet.header} value={mapping.mark} onChange={(v) => setMapping({ ...mapping, mark: v })} />
                  <ColSelect label={t("imp.colExam")} header={sheet.header} value={mapping.exam} onChange={(v) => setMapping({ ...mapping, exam: v })} />
                  <ColSelect label={t("imp.colForm")} header={sheet.header} value={mapping.form} onChange={(v) => setMapping({ ...mapping, form: v })} />
                  <ColSelect label={t("imp.colStatus")} header={sheet.header} value={mapping.status} onChange={(v) => setMapping({ ...mapping, status: v })} />
                  {EXAM_TYPES.map((e) => (
                    <ColSelect
                      key={e}
                      label={`${t("imp.colMark")} · ${t(`exam.${e}`)}`}
                      header={sheet.header}
                      value={mapping.perExam[e]}
                      onChange={(v) => setMapping({ ...mapping, perExam: { ...mapping.perExam, [e]: v } })}
                    />
                  ))}
                </div>
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted text-xs text-muted-foreground">
                      <tr>
                        {sheet.header.map((h, i) => (
                          <th key={i} className="px-3 py-2 text-left font-medium">
                            {h || `#${i + 1}`}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {sheet.rows.slice(0, 8).map((r, i) => (
                        <tr key={i}>
                          {sheet.header.map((_, j) => (
                            <td key={j} className="px-3 py-1.5 font-mono text-xs">
                              {String(r[j] ?? "")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-between">
                  <Button variant="ghost" onClick={() => setStep(2)}>
                    {t("common.back")}
                  </Button>
                  <Button variant="hero" onClick={mappingNext} disabled={mapping.subject === NONE || !!busy}>
                    {busy && <Loader2 className="animate-spin" />}
                    {t("common.next")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 4 && book && (
            <div className={cn("grid gap-6", preview && "lg:grid-cols-[1fr_340px]")}>
              <Card>
                <CardContent className="p-4 md:p-6">
                  <p className="mb-4 text-sm text-muted-foreground">{t("imp.reviewHint")}</p>
                  <div className="space-y-2">
                    {rows.map((r) => (
                      <ReviewRow key={r.key} row={r} book={book} onChange={(p) => update(r.key, p)} />
                    ))}
                  </div>
                  <div className="mt-5 flex justify-between">
                    <Button variant="ghost" onClick={() => setStep(kind === "sheet" ? 3 : 2)}>
                      {t("common.back")}
                    </Button>
                    <Button variant="hero" disabled={hasInvalid || validRows.length === 0} onClick={() => setStep(5)}>
                      {t("common.next")}
                    </Button>
                  </div>
                  {hasInvalid && <p className="mt-2 text-right text-sm text-destructive">{t("exams.invalid")}</p>}
                </CardContent>
              </Card>
              {preview && (
                <div className="lg:sticky lg:top-6 lg:self-start">
                  <img src={preview} alt={t("imp.original")} className="glass w-full rounded-2xl object-contain p-2" />
                </div>
              )}
            </div>
          )}

          {step === 5 && book && (
            <Card>
              <CardContent className="space-y-5 p-6">
                {duplicates.length > 0 && (
                  <div className="rounded-2xl border border-warning/50 p-4">
                    <div className="mb-1 flex items-center gap-2 font-semibold text-warning">
                      <AlertTriangle className="size-4" /> {t("imp.duplicates")}
                    </div>
                    <p className="mb-3 text-sm text-muted-foreground">{t("imp.dupHint")}</p>
                    <div className="divide-y divide-border">
                      {duplicates.map(({ row, existing }) => {
                        const subj = book.subjects.find((s) => s.id === row.subjectId);
                        const ne = rowEntry(row);
                        const om = existing ? effectiveMark(existing) : null;
                        const nm = ne ? effectiveMark(ne) : null;
                        return (
                          <div key={row.key} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <div className="font-medium">{subjectName(subj, lang)}</div>
                              <div className="text-xs text-muted-foreground">
                                {t(`exam.${row.exam}`)} · {t("common.formN", { n: row.form })}
                              </div>
                            </div>
                            <div className="flex items-center gap-4 font-mono text-sm tabular">
                              <span className="text-muted-foreground">
                                {t("imp.existing")}: {om ?? t(`status.${existing!.status}`)} <GradeBadge mark={om} className="ml-1" />
                              </span>
                              <span>
                                {t("imp.new")}: {nm ?? t(`status.${ne?.status ?? "pending"}`)} <GradeBadge mark={nm} className="ml-1" />
                              </span>
                            </div>
                            <Select value={dups[row.key] ?? "keep"} onValueChange={(v) => setDups({ ...dups, [row.key]: v as DupChoice })}>
                              <SelectTrigger className="w-44">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="keep">{t("imp.keep")}</SelectItem>
                                <SelectItem value="replace">{t("imp.replace")}</SelectItem>
                                <SelectItem value="skip">{t("imp.skip")}</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="font-display text-lg font-semibold">{t("imp.summary", { n: toSave.length })}</div>
                <div className="flex justify-between">
                  <Button variant="ghost" onClick={() => setStep(4)}>
                    {t("common.back")}
                  </Button>
                  <Button variant="hero" onClick={save} disabled={busy === "save" || toSave.length === 0}>
                    {busy === "save" && <Loader2 className="animate-spin" />}
                    {t("imp.save")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </>
  );
}

function ColSelect({ label, header, value, onChange, allowNone = true }: { label: string; header: string[]; value: number; onChange: (v: number) => void; allowNone?: boolean }) {
  const t = useT();
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
        <SelectTrigger className="mt-1">
          <SelectValue placeholder={t("imp.notInFile")} />
        </SelectTrigger>
        <SelectContent>
          {allowNone && <SelectItem value={String(NONE)}>{t("imp.notInFile")}</SelectItem>}
          {header.map((h, i) => (
            <SelectItem key={i} value={String(i)}>
              {h || `#${i + 1}`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function ReviewRow({ row, book, onChange }: { row: Row; book: Gradebook; onChange: (p: Partial<Row>) => void }) {
  const t = useT();
  const { lang } = usePrefs();
  const subjects = subjectsForForm(book, row.form, true);
  const p = parseMarkInput(row.input);
  const entry = p.ok ? normalizeEntry(p.value, row.status === "completed" ? undefined : row.status) : null;
  const m = entry ? effectiveMark(entry) : null;
  const skipped = row.subjectId === "__skip";
  return (
    <div
      className={cn(
        "grid grid-cols-2 items-center gap-2 rounded-xl border p-3 md:grid-cols-[1.4fr_1.6fr_130px_80px_140px_32px]",
        row.uncertain && !skipped ? "border-warning/60 bg-warning/5" : "border-border",
        skipped && "opacity-50",
      )}
    >
      <div className="col-span-2 min-w-0 md:col-span-1">
        <div className="truncate text-sm font-medium" title={row.raw}>
          {row.raw}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {t("common.formN", { n: row.form })}
          {row.uncertain && !skipped && (
            <span className="inline-flex items-center gap-1 text-warning">
              <AlertTriangle className="size-3" /> {t("imp.uncertain")}
            </span>
          )}
        </div>
      </div>
      <Select value={row.subjectId} onValueChange={(v) => onChange({ subjectId: v, uncertain: false })}>
        <SelectTrigger className="col-span-2 md:col-span-1" aria-label={t("common.subject")}>
          <SelectValue placeholder={t("imp.unmatched")} />
        </SelectTrigger>
        <SelectContent>
          {subjects.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {subjectName(s, lang)}
            </SelectItem>
          ))}
          <SelectItem value="__new">+ {t("imp.newSubject")}: {row.raw}</SelectItem>
          <SelectItem value="__skip">{t("imp.skipRow")}</SelectItem>
        </SelectContent>
      </Select>
      <Select value={row.exam} onValueChange={(v) => onChange({ exam: v as ExamType })}>
        <SelectTrigger aria-label={t("common.exam")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {EXAM_TYPES.map((e) => (
            <SelectItem key={e} value={e}>
              {t(`exam.${e}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex items-center gap-2">
        <Input
          inputMode="numeric"
          aria-label={t("common.mark")}
          value={row.input}
          disabled={row.status === "absent" || row.status === "exempted"}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "").slice(0, 3);
            onChange({ input: v, status: v ? "completed" : "pending" });
          }}
          className={cn("w-16 text-center font-mono", !p.ok && "border-destructive")}
          placeholder="—"
        />
        <GradeBadge mark={m} />
      </div>
      <Select
        value={row.status}
        onValueChange={(v) => {
          const s = v as MarkStatus;
          onChange({ status: s, input: s === "absent" ? "0" : s === "completed" ? row.input : "" });
        }}
      >
        <SelectTrigger aria-label={t("common.status")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MARK_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {t(`status.${s}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button variant="ghost" size="icon" aria-label={t("imp.skipRow")} onClick={() => onChange({ subjectId: skipped ? "__new" : "__skip" })}>
        <Trash2 />
      </Button>
    </div>
  );
}
