import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormSelect, GradeBadge, PageHeader } from "@/components/mk/ui";
import { GoalBars } from "@/components/mk/GoalBars";
import { usePrefs, useT } from "@/lib/i18n";
import { EXAM_TYPES, LETTER_BANDS, type ExamType } from "@/lib/grading";
import { currentUserId, subjectName, subjectsForForm, useGradebook, useProfile, type Gradebook } from "@/lib/gradebook";
import { latestCountedMark } from "@/lib/book-derived";

export const Route = createFileRoute("/_authenticated/goals")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Sasaran · Goals — MarkahKu" },
      { name: "description", content: "Set target grades per subject and target average or CGPA per exam." },
      { property: "og:title", content: "Goals — MarkahKu" },
      { property: "og:description", content: "Set target grades per subject and target average or CGPA per exam." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Goals,
});

const GOAL_LETTERS = LETTER_BANDS.filter((b) => b.letter !== "F");

function Goals() {
  const t = useT();
  const { lang } = usePrefs();
  const qc = useQueryClient();
  const { data: book } = useGradebook();
  const { data: profile } = useProfile();
  const [form, setForm] = useState(1);
  useEffect(() => {
    if (profile?.current_form) setForm(profile.current_form);
  }, [profile?.current_form]);

  if (!book) return <Skeleton className="h-96 rounded-2xl" />;
  const subjects = subjectsForForm(book, form);
  const refresh = () => qc.invalidateQueries({ queryKey: ["gradebook"] });

  async function setSubjectGoal(subjectId: string, letter: string) {
    try {
      const existing = book!.goals.find((g) => g.scope === "subject" && g.form === form && g.user_subject_id === subjectId);
      if (letter === "none") {
        if (existing) await supabase.from("goals").delete().eq("id", existing.id).throwOnError();
      } else if (existing) {
        await supabase.from("goals").update({ target_grade: letter }).eq("id", existing.id).throwOnError();
      } else {
        const user_id = await currentUserId();
        await supabase.from("goals").insert({ user_id, scope: "subject", form, user_subject_id: subjectId, target_grade: letter }).throwOnError();
      }
      await refresh();
    } catch (e) {
      console.error(e);
      toast.error(t("common.error"));
    }
  }

  return (
    <>
      <PageHeader title={t("goals.title")} sub={t("goals.sub")} actions={<FormSelect value={form} onChange={setForm} />} />
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-6 lg:col-span-7">
          <Card>
            <CardHeader>
              <CardTitle>{t("goals.exam")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {EXAM_TYPES.map((e) => (
                <ExamGoalRow key={`${form}-${e}`} book={book} form={form} exam={e} onSaved={refresh} />
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("goals.subject")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-border">
                {subjects.map((s) => {
                  const g = book.goals.find((x) => x.scope === "subject" && x.form === form && x.user_subject_id === s.id);
                  const latest = latestCountedMark(book, form, s.id);
                  return (
                    <div key={s.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{subjectName(s, lang)}</div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          {t("goals.latest")}: <span className="font-mono">{latest ?? "—"}</span> <GradeBadge mark={latest} className="h-5 min-w-5 text-[10px]" />
                        </div>
                      </div>
                      <Select value={g?.target_grade ?? "none"} onValueChange={(v) => setSubjectGoal(s.id, v)}>
                        <SelectTrigger className="w-40" aria-label={t("goals.targetGrade")}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">{t("common.none")}</SelectItem>
                          {GOAL_LETTERS.map((b) => (
                            <SelectItem key={b.letter} value={b.letter}>
                              {b.letter} · {lang === "ms" ? b.ms : b.en} ({b.min}+)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
        <Card className="h-fit lg:col-span-5">
          <CardHeader>
            <CardTitle>{t("dash.goals")}</CardTitle>
          </CardHeader>
          <CardContent>
            <GoalBars book={book} form={form} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function ExamGoalRow({ book, form, exam, onSaved }: { book: Gradebook; form: number; exam: ExamType; onSaved: () => Promise<unknown> }) {
  const t = useT();
  const g = book.goals.find((x) => x.scope === "exam" && x.form === form && x.exam === exam);
  const [avg, setAvg] = useState(g?.target_average != null ? String(Number(g.target_average)) : "");
  const [cgpa, setCgpa] = useState(g?.target_cgpa != null ? String(Number(g.target_cgpa)) : "");
  const [busy, setBusy] = useState(false);

  async function save() {
    const a = avg.trim() === "" ? null : Number(avg);
    const c = cgpa.trim() === "" ? null : Number(cgpa);
    if ((a != null && (isNaN(a) || a < 0 || a > 100)) || (c != null && (isNaN(c) || c < 0 || c > 4))) {
      toast.error(t("common.error"));
      return;
    }
    setBusy(true);
    try {
      if (a == null && c == null) {
        if (g) await supabase.from("goals").delete().eq("id", g.id).throwOnError();
      } else if (g) {
        await supabase.from("goals").update({ target_average: a, target_cgpa: c }).eq("id", g.id).throwOnError();
      } else {
        const user_id = await currentUserId();
        await supabase.from("goals").insert({ user_id, scope: "exam", form, exam, target_average: a, target_cgpa: c }).throwOnError();
      }
      await onSaved();
      toast.success(t("common.saved"));
    } catch (e) {
      console.error(e);
      toast.error(t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-[1fr_1fr] items-end gap-3 rounded-xl border border-border p-3 sm:grid-cols-[120px_1fr_1fr_auto]">
      <div className="col-span-2 font-display font-semibold sm:col-span-1 sm:self-center">{t(`exam.${exam}`)}</div>
      <div>
        <Label className="text-xs">{t("goals.targetAvg")}</Label>
        <Input inputMode="decimal" className="mt-1 font-mono" value={avg} placeholder="80" onChange={(e) => setAvg(e.target.value.replace(/[^\d.]/g, "").slice(0, 5))} />
      </div>
      <div>
        <Label className="text-xs">{t("goals.targetCgpa")}</Label>
        <Input inputMode="decimal" className="mt-1 font-mono" value={cgpa} placeholder="3.50" onChange={(e) => setCgpa(e.target.value.replace(/[^\d.]/g, "").slice(0, 4))} />
      </div>
      <Button variant="outline" className="col-span-2 sm:col-span-1" onClick={save} disabled={busy}>
        {t("common.save")}
      </Button>
    </div>
  );
}
