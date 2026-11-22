import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Download, FileImage, Loader2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GradeBadge, PageHeader, Stat, EmptyState, deltaTone } from "@/components/mk/ui";
import { usePrefs, useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  MARK_STATUSES,
  cgpaPoints,
  effectiveMark,
  formatAverage,
  formatCgpa,
  formatDelta,
  normalizeEntry,
  parseMarkInput,
  summarizeExam,
  type MarkStatus,
} from "@/lib/grading";
import { ensureFormSubjects, saveMarks, subjectName, subjectsForForm, useGradebook } from "@/lib/gradebook";
import { examChange } from "@/lib/book-derived";
import { exportExamPdf } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/exams/$id")({
  head: () => ({
    meta: [
      { title: "Masukkan markah · Enter marks — MarkahKu" },
      { name: "description", content: "Enter every subject's mark for one exam, with live grade, points, total and average." },
      { property: "og:title", content: "Enter marks — MarkahKu" },
      { property: "og:description", content: "Enter every subject's mark for one exam, with live grade, points and average." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ExamEntry,
});

type Row = { subjectId: string; input: string; status: MarkStatus };

function ExamEntry() {
  const { id } = Route.useParams();
  const t = useT();
  const { lang } = usePrefs();
  const qc = useQueryClient();
  const { data: book, isLoading } = useGradebook();
  const session = book?.sessions.find((s) => s.id === id);
  const [rows, setRows] = useState<Row[]>([]);
  const [rankPos, setRankPos] = useState("");
  const [rankTotal, setRankTotal] = useState("");
  const [year, setYear] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const subjects = useMemo(() => {
    if (!book || !session) return [];
    return subjectsForForm(book, session.form, true).filter(
      (s) => s.is_active || book.marks.some((m) => m.session_id === session.id && m.user_subject_id === s.id),
    );
  }, [book, session]);

  useEffect(() => {
    if (!book || !session || dirty) return;
    setRows(
      subjects.map((s) => {
        const m = book.marks.find((x) => x.session_id === session.id && x.user_subject_id === s.id);
        return { subjectId: s.id, status: m?.status ?? "pending", input: m?.mark != null ? String(m.mark) : "" };
      }),
    );
    setRankPos(session.rank_position ? String(session.rank_position) : "");
    setRankTotal(session.rank_total ? String(session.rank_total) : "");
    setYear(session.academic_year ? String(session.academic_year) : "");
  }, [book, session, subjects, dirty]);

  const files = useQuery({
    queryKey: ["source_files", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("source_files").select("*").eq("session_id", id).order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const parsed = rows.map((r) => {
    const p = parseMarkInput(r.input);
    return { ...r, valid: p.ok, entry: p.ok ? normalizeEntry(p.value, r.status === "completed" ? undefined : r.status) : null };
  });
  const sum = summarizeExam(parsed.flatMap((p) => (p.entry ? [p.entry] : [])));
  const change = book && session ? examChange(book, session.form, session.exam) : null;
  const invalid = parsed.some((p) => !p.valid);

  function update(i: number, patch: Partial<Row>) {
    setDirty(true);
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }
  function onMark(i: number, v: string) {
    const clean = v.replace(/[^\d]/g, "").slice(0, 3);
    update(i, { input: clean, status: clean === "" ? "pending" : "completed" });
  }
  function onStatus(i: number, s: MarkStatus) {
    if (s === "absent") update(i, { status: s, input: "0" });
    else if (s === "exempted" || s === "pending") update(i, { status: s, input: "" });
    else update(i, { status: s });
  }

  async function save() {
    if (!session) return;
    if (invalid) {
      toast.error(t("exams.invalid"));
      return;
    }
    const pos = rankPos ? Number(rankPos) : null;
    const tot = rankTotal ? Number(rankTotal) : null;
    if (pos && tot && pos > tot) {
      toast.error(t("exams.rankInvalid"));
      return;
    }
    setSaving(true);
    try {
      await saveMarks(
        session.id,
        parsed.map((p) => ({ user_subject_id: p.subjectId, status: p.entry!.status, mark: p.entry!.mark })),
      );
      const yr = year ? Number(year) : null;
      const { error } = await supabase
        .from("exam_sessions")
        .update({ rank_position: pos || null, rank_total: tot || null, academic_year: yr && yr > 2000 && yr < 2100 ? yr : null })
        .eq("id", session.id);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["gradebook"] });
      setDirty(false);
      toast.success(t("common.saved"));
    } catch (e) {
      console.error(e);
      toast.error(t("common.error"));
    } finally {
      setSaving(false);
    }
  }

  async function viewOriginal(path: string) {
    const { data, error } = await supabase.storage.from("mark-sources").createSignedUrl(path, 300);
    if (error || !data) { toast.error(t("common.error")); return; }
    window.open(data.signedUrl, "_blank", "noopener");
  }

  async function setupSubjects() {
    if (!session) return;
    try {
      await ensureFormSubjects(session.form);
      await qc.invalidateQueries({ queryKey: ["gradebook"] });
    } catch {
      toast.error(t("common.error"));
    }
  }

  if (isLoading || !book) return <Skeleton className="h-96 rounded-2xl" />;
  if (!session)
    return (
      <EmptyState
        title="404"
        action={
          <Button asChild variant="outline">
            <Link to="/exams">{t("common.back")}</Link>
          </Button>
        }
      />
    );

  return (
    <>
      <Link to="/exams" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> {t("exams.title")}
      </Link>
      <PageHeader
        title={t("exams.entryTitle", { exam: t(`exam.${session.exam}`), form: session.form })}
        sub={t("exams.liveHint")}
        actions={
          <>
            <Button variant="outline" className="h-11" onClick={() => exportExamPdf(book, session.form, session.exam, lang)}>
              <Download /> {t("common.exportPdf")}
            </Button>
            <Button variant="hero" className="h-11" onClick={save} disabled={saving || invalid}>
              {saving && <Loader2 className="animate-spin" />}
              {saving ? t("common.saving") : t("common.save")}
            </Button>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={t("common.total")} value={sum.total} hint={t("dash.countedOf", { c: sum.counted, p: sum.pending })} />
        <Stat label={t("common.average")} value={formatAverage(sum.average)} hint={change?.average != null ? `${formatDelta(change.average)} ${t("dash.vsPrev")}` : undefined} tone={deltaTone(change?.average)} />
        <Stat label={t("common.cgpa")} value={formatCgpa(sum.cgpa)} hint={change?.cgpa != null ? formatDelta(change.cgpa, 2) : undefined} tone={deltaTone(change?.cgpa)} />
        <Stat label={t("common.counted")} value={`${sum.counted}/${rows.length}`} />
      </div>

      {subjects.length === 0 ? (
        <EmptyState
          title={t("exams.noSubjects")}
          action={<Button variant="hero" onClick={setupSubjects}>{t("exams.setupSubjects", { n: session.form })}</Button>}
        />
      ) : (
        <div className="glass overflow-hidden rounded-2xl">
          <div className="hidden grid-cols-[1fr_110px_160px_70px_70px] gap-3 border-b border-border px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground md:grid">
            <div>{t("common.subject")}</div>
            <div>{t("common.mark")}</div>
            <div>{t("common.status")}</div>
            <div className="text-center">{t("common.grade")}</div>
            <div className="text-right">{t("common.points")}</div>
          </div>
          <div className="divide-y divide-border">
            {parsed.map((p, i) => {
              const subj = subjects.find((s) => s.id === p.subjectId);
              const m = p.entry ? effectiveMark(p.entry) : null;
              return (
                <div key={p.subjectId} className="grid grid-cols-[minmax(0,1fr)_5rem] items-center gap-x-3 gap-y-2 px-3 py-3 md:grid-cols-[1fr_110px_160px_70px_70px] md:px-4">
                  <div className={cn("min-w-0 break-words font-medium", !subj?.is_active && "text-muted-foreground")}>{subjectName(subj, lang)}</div>
                  <div className="flex items-center gap-2 md:contents">
                    <Input
                      inputMode="numeric"
                      aria-label={`${t("common.mark")} ${subjectName(subj, lang)}`}
                      value={p.input}
                      disabled={p.status === "absent" || p.status === "exempted"}
                      onChange={(e) => onMark(i, e.target.value)}
                      placeholder="—"
                      className={cn("h-11 w-20 text-center font-mono tabular md:w-full", !p.valid && "border-destructive")}
                    />
                  </div>
                  <div className="col-span-2 flex items-center gap-3 md:col-span-1 md:contents">
                    <Select value={p.status} onValueChange={(v) => onStatus(i, v as MarkStatus)}>
                      <SelectTrigger className="h-11 flex-1 md:w-full" aria-label={t("common.status")}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MARK_STATUSES.map((s) => (
                          <SelectItem key={s} value={s} className="min-h-11">
                            {t(`status.${s}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex justify-center">
                      <GradeBadge mark={m} />
                    </div>
                    <div className="w-12 text-right font-mono text-sm tabular text-muted-foreground md:w-auto">
                      {m != null ? cgpaPoints(m).toFixed(2) : "—"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="glass rounded-2xl p-5">
          <h3 className="mb-3 font-semibold">{t("exams.rank")}</h3>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="pos">{t("exams.rankPos")}</Label>
              <Input id="pos" inputMode="numeric" className="mt-1.5 font-mono" value={rankPos} onChange={(e) => { setDirty(true); setRankPos(e.target.value.replace(/\D/g, "").slice(0, 5)); }} />
            </div>
            <div>
              <Label htmlFor="tot">{t("exams.rankTotal")}</Label>
              <Input id="tot" inputMode="numeric" className="mt-1.5 font-mono" value={rankTotal} onChange={(e) => { setDirty(true); setRankTotal(e.target.value.replace(/\D/g, "").slice(0, 5)); }} />
            </div>
            <div>
              <Label htmlFor="yr">{t("common.year")}</Label>
              <Input id="yr" inputMode="numeric" className="mt-1.5 font-mono" value={year} onChange={(e) => { setDirty(true); setYear(e.target.value.replace(/\D/g, "").slice(0, 4)); }} />
            </div>
          </div>
          {rankPos && rankTotal && Number(rankPos) > Number(rankTotal) && (
            <p className="mt-2 text-sm text-destructive">{t("exams.rankInvalid")}</p>
          )}
        </div>
        <div className="glass rounded-2xl p-5">
          <h3 className="mb-3 font-semibold">{t("exams.originals")}</h3>
          {files.data?.length ? (
            <div className="flex flex-wrap gap-2">
              {files.data.map((f, i) => (
                <Button key={f.id} variant="outline" size="sm" onClick={() => viewOriginal(f.storage_path)}>
                  <FileImage /> {t("exams.viewOriginal")} {files.data.length > 1 ? i + 1 : ""}
                </Button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("common.none")}</p>
          )}
        </div>
      </div>
    </>
  );
}
