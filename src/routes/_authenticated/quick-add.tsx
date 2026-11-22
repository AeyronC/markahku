import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { ExamSelect, FormSelect, GradeBadge, PageHeader } from "@/components/mk/ui";
import { usePrefs, useT } from "@/lib/i18n";
import { MARK_STATUSES, cgpaPoints, effectiveMark, normalizeEntry, parseMarkInput, type ExamType, type MarkStatus } from "@/lib/grading";
import { ensureFormSubjects, ensureSession, saveMarks, subjectName, subjectsForForm, useGradebook, useProfile } from "@/lib/gradebook";

export const Route = createFileRoute("/_authenticated/quick-add")({
  head: () => ({
    meta: [
      { title: "Tambah pantas · Quick add — MarkahKu" },
      { name: "description", content: "Add one subject mark at a time for any exam." },
      { property: "og:title", content: "Quick add — MarkahKu" },
      { property: "og:description", content: "Add one subject mark at a time for any exam." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: QuickAdd,
});

function QuickAdd() {
  const t = useT();
  const { lang } = usePrefs();
  const qc = useQueryClient();
  const { data: book } = useGradebook();
  const { data: profile } = useProfile();
  const [form, setForm] = useState<number>(1);
  const [exam, setExam] = useState<ExamType>("sumatif_1");
  const [subjectId, setSubjectId] = useState("");
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<MarkStatus>("completed");
  const [busy, setBusy] = useState(false);
  const [recent, setRecent] = useState<{ key: string; name: string; exam: ExamType; mark: number | null; status: MarkStatus }[]>([]);

  useEffect(() => {
    if (profile?.current_form) setForm(profile.current_form);
  }, [profile?.current_form]);

  const subjects = book ? subjectsForForm(book, form) : [];
  useEffect(() => {
    if (!subjects.find((s) => s.id === subjectId)) setSubjectId(subjects[0]?.id ?? "");
  }, [subjects, subjectId]);

  const parsed = parseMarkInput(input);
  const entry = parsed.ok ? normalizeEntry(parsed.value, status === "completed" ? undefined : status) : null;
  const m = entry ? effectiveMark(entry) : null;

  async function save() {
    if (!subjectId || !entry) {
      toast.error(t("exams.invalid"));
      return;
    }
    setBusy(true);
    try {
      const session = await ensureSession(form, exam);
      await saveMarks(session.id, [{ user_subject_id: subjectId, status: entry.status, mark: entry.mark }]);
      await qc.invalidateQueries({ queryKey: ["gradebook"] });
      const subj = subjects.find((s) => s.id === subjectId);
      setRecent((r) => [{ key: crypto.randomUUID(), name: subjectName(subj, lang), exam, mark: entry.mark, status: entry.status }, ...r].slice(0, 8));
      toast.success(t("common.saved"));
      setInput("");
      setStatus("completed");
      const idx = subjects.findIndex((s) => s.id === subjectId);
      const next = subjects[idx + 1];
      if (next) setSubjectId(next.id);
    } catch (e) {
      console.error(e);
      toast.error(t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title={t("qa.title")} sub={t("qa.sub")} />
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardContent className="space-y-5 p-6">
            <div className="flex flex-wrap gap-3">
              <FormSelect value={form} onChange={setForm} />
              <ExamSelect value={exam} onChange={setExam} />
            </div>
            {subjects.length === 0 ? (
              <Button variant="hero" onClick={() => ensureFormSubjects(form).then(() => qc.invalidateQueries({ queryKey: ["gradebook"] }))}>
                {t("exams.setupSubjects", { n: form })}
              </Button>
            ) : (
              <form
                className="space-y-5"
                onSubmit={(e) => {
                  e.preventDefault();
                  void save();
                }}
              >
                <div>
                  <Label>{t("common.subject")}</Label>
                  <Select value={subjectId} onValueChange={setSubjectId}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {subjects.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {subjectName(s, lang)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="qa-mark">{t("common.mark")}</Label>
                    <Input
                      id="qa-mark"
                      inputMode="numeric"
                      autoFocus
                      className="mt-1.5 h-12 text-center font-mono text-xl tabular"
                      value={input}
                      disabled={status === "absent" || status === "exempted"}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, "").slice(0, 3);
                        setInput(v);
                        if (v && status === "pending") setStatus("completed");
                      }}
                      placeholder="—"
                    />
                  </div>
                  <div>
                    <Label>{t("common.status")}</Label>
                    <Select
                      value={status}
                      onValueChange={(v) => {
                        const s = v as MarkStatus;
                        setStatus(s);
                        if (s === "absent") setInput("0");
                        if (s === "exempted" || s === "pending") setInput("");
                      }}
                    >
                      <SelectTrigger className="mt-1.5 h-12">
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
                  </div>
                </div>
                {!parsed.ok && <p className="text-sm text-destructive">{t("exams.invalid")}</p>}
                <div className="flex items-center justify-between rounded-xl bg-muted px-4 py-3">
                  <span className="text-sm text-muted-foreground">
                    {t("grade.letter")} · {t("grade.points")}
                  </span>
                  <span className="flex items-center gap-3 font-mono tabular">
                    <GradeBadge mark={m} form={form} />
                    {m != null ? cgpaPoints(m).toFixed(2) : "—"}
                  </span>
                </div>
                <Button type="submit" variant="hero" className="w-full" disabled={busy || !parsed.ok}>
                  {busy && <Loader2 className="animate-spin" />}
                  {t("qa.saveNext")}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <h3 className="mb-3 font-semibold">{t("qa.recent")}</h3>
            {recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("common.none")}</p>
            ) : (
              <ul className="divide-y divide-border">
                {recent.map((r) => (
                  <li key={r.key} className="flex items-center justify-between py-2.5 text-sm">
                    <span className="flex items-center gap-2">
                      <Check className="size-4 text-success" />
                      {r.name} <span className="text-muted-foreground">· {t(`exam.${r.exam}`)}</span>
                    </span>
                    <span className="flex items-center gap-2 font-mono tabular">
                      {r.mark ?? t(`status.${r.status}`)}
                      <GradeBadge mark={r.status === "completed" || r.status === "absent" ? (r.mark ?? 0) : null} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
