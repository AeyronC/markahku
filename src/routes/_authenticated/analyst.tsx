import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarDays, Loader2, Lock, RefreshCw, Sparkles, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, FormSelect, PageHeader } from "@/components/mk/ui";
import { usePrefs, useT } from "@/lib/i18n";
import { useGradebook, useProfile } from "@/lib/gradebook";
import { buildAnalystSummary } from "@/lib/analyst-summary";
import { runAnalyst } from "@/lib/ai.functions";

export const Route = createFileRoute("/_authenticated/analyst")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Penganalisis AI · AI analyst — MarkahKu" },
      { name: "description", content: "AI analysis of your strongest and weakest subjects and a personalised study plan." },
      { property: "og:title", content: "AI analyst — MarkahKu" },
      { property: "og:description", content: "AI analysis of your results and a personalised study plan." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Analyst,
});

type Note = { subject: string; note: string };
type Analysis = {
  summary: string;
  strongest: Note[];
  weakest: Note[];
  trends: { subject: string; direction: "improving" | "flat" | "declining"; note: string }[];
  near_boundary: Note[];
  goal_gaps: Note[];
};
type Plan = { overview: string; days: { day: string; focus: { subject: string; task: string; minutes: number }[] }[]; tips: string[] };

function Analyst() {
  const t = useT();
  const { lang } = usePrefs();
  const qc = useQueryClient();
  const { data: book } = useGradebook();
  const { data: profile } = useProfile();
  const [form, setForm] = useState(1);
  const [tab, setTab] = useState<"analysis" | "study_plan">("analysis");
  const [busy, setBusy] = useState<string | null>(null);
  const run = useServerFn(runAnalyst);

  useEffect(() => {
    if (profile?.current_form) setForm(profile.current_form);
  }, [profile?.current_form]);

  const insights = useQuery({
    queryKey: ["insights", form],
    queryFn: async () => {
      const { data, error } = await supabase.from("ai_insights").select("*").eq("form", form).order("created_at", { ascending: false }).limit(10);
      if (error) throw error;
      return data;
    },
  });

  const latest = (kind: "analysis" | "study_plan") => insights.data?.find((i) => i.kind === kind);
  const formSessionIds = new Set(book?.sessions.filter((s) => s.form === form).map((s) => s.id) ?? []);
  const dataUsedAt = book?.marks.reduce<string | null>((latestDate, mark) => {
    if (!formSessionIds.has(mark.session_id) || !mark.updated_at) return latestDate;
    return !latestDate || Date.parse(mark.updated_at) > Date.parse(latestDate) ? mark.updated_at : latestDate;
  }, null) ?? null;
  const marksChangedSince = (item: { created_at: string }) => !!book?.marks.some(
    (mark) => formSessionIds.has(mark.session_id) && !!mark.updated_at && Date.parse(mark.updated_at) > Date.parse(item.created_at),
  );
  const hasData = book ? buildAnalystSummary(book, form, lang).exams.some((e) => e.counted > 0) : false;

  async function generate(kind: "analysis" | "study_plan") {
    if (!book) return;
    setBusy(kind);
    try {
      const res = await run({ data: { kind, form, language: lang, summary: buildAnalystSummary(book, form, lang) } });
      if (!res.ok) {
        toast.error(res.code === "cap" ? t("ai.capReached") : t("common.error"));
        return;
      }
      await qc.invalidateQueries({ queryKey: ["insights", form] });
    } catch (e) {
      console.error(e);
      toast.error(t("common.error"));
    } finally {
      setBusy(null);
    }
  }

  const fmtDate = (d: string) => new Date(d).toLocaleString(lang === "ms" ? "ms-MY" : "en-MY", { dateStyle: "medium", timeStyle: "short" });
  const fmtDataDate = (d: string) => new Date(d).toLocaleDateString(lang === "ms" ? "ms-MY" : "en-MY", { dateStyle: "medium" });

  return (
    <>
      <PageHeader title={t("ai.title")} sub={t("ai.sub")} actions={<FormSelect value={form} onChange={setForm} />} />
      <div className="glass mb-5 flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs text-muted-foreground">
        <Lock className="size-3.5 shrink-0 text-primary" /> {t("ai.privacy")}
      </div>
      {!book || insights.isLoading ? (
        <Skeleton className="h-80 rounded-2xl" />
      ) : !hasData ? (
        <EmptyState icon={<Sparkles />} title={t("ai.needData")} />
      ) : (
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList>
            <TabsTrigger value="analysis">{t("ai.analysis")}</TabsTrigger>
            <TabsTrigger value="study_plan">{t("ai.plan")}</TabsTrigger>
          </TabsList>
          {(["analysis", "study_plan"] as const).map((kind) => {
            const item = latest(kind);
            return (
              <TabsContent key={kind} value={kind} className="mt-4">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-sm text-muted-foreground">{item ? <>{t("ai.generatedOn", { d: fmtDate(item.created_at) })}{dataUsedAt && <span> · {t("ai.dataThrough", { d: fmtDataDate(dataUsedAt) })}</span>}</> : t("ai.empty")}</span>
                  <Button variant="hero" onClick={() => generate(kind)} disabled={!!busy || (!!item && !marksChangedSince(item))}>
                    {busy === kind ? <Loader2 className="animate-spin" /> : item ? <RefreshCw /> : <Sparkles />}
                    {busy === kind ? t("ai.generating") : item ? t("ai.regenerate") : t("ai.generate")}
                  </Button>
                  {item && !marksChangedSince(item) && <p className="w-full text-right text-xs text-muted-foreground">{t("ai.unchanged")}</p>}
                </div>
                {busy === kind && !item ? (
                  <Skeleton className="h-64 rounded-2xl" />
                ) : item ? (
                  kind === "analysis" ? (
                    <AnalysisView a={item.payload as Analysis} />
                  ) : (
                    <PlanView p={item.payload as Plan} />
                  )
                ) : null}
              </TabsContent>
            );
          })}
        </Tabs>
      )}
    </>
  );
}

function NoteCard({ title, items, tone }: { title: string; items: Note[]; tone?: "good" | "bad" }) {
  if (!items?.length) return null;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className={tone === "good" ? "text-success" : tone === "bad" ? "text-warning" : undefined}>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((n, i) => (
          <div key={i}>
            <div className="font-medium">{n.subject}</div>
            <p className="text-sm text-muted-foreground">{n.note}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function AnalysisView({ a }: { a: Analysis }) {
  const t = useT();
  const icon = { improving: TrendingUp, flat: Minus, declining: TrendingDown };
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-6 text-base leading-relaxed">{a.summary}</CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <NoteCard title={t("ai.strongest")} items={a.strongest} tone="good" />
        <NoteCard title={t("ai.weakest")} items={a.weakest} tone="bad" />
        <NoteCard title={t("ai.nearBoundary")} items={a.near_boundary} />
        <NoteCard title={t("ai.goalGaps")} items={a.goal_gaps} />
      </div>
      {a.trends?.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>{t("ai.trends")}</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            {a.trends.map((tr, i) => {
              const Icon = icon[tr.direction] ?? Minus;
              return (
                <div key={i} className="flex items-start gap-3 py-2.5">
                  <Icon className={tr.direction === "improving" ? "mt-0.5 size-4 shrink-0 text-success" : tr.direction === "declining" ? "mt-0.5 size-4 shrink-0 text-destructive" : "mt-0.5 size-4 shrink-0 text-muted-foreground"} />
                  <div>
                    <div className="font-medium">
                      {tr.subject} <span className="text-xs font-normal text-muted-foreground">· {t(`ai.${tr.direction}`)}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{tr.note}</p>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PlanView({ p }: { p: Plan }) {
  const t = useT();
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-6 text-base leading-relaxed">{p.overview}</CardContent>
      </Card>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {p.days?.map((d, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="mb-2 flex items-center gap-2 font-display font-semibold">
                <CalendarDays className="size-4 text-primary" /> {d.day}
              </div>
              <ul className="space-y-2">
                {d.focus.map((f, j) => (
                  <li key={j} className="rounded-lg bg-muted px-3 py-2 text-sm">
                    <div className="flex justify-between gap-2 font-medium">
                      <span>{f.subject}</span>
                      <span className="shrink-0 font-mono text-xs text-muted-foreground">{t("ai.minutes", { n: f.minutes })}</span>
                    </div>
                    <p className="text-muted-foreground">{f.task}</p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
      {p.tips?.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>{t("ai.tips")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
              {p.tips.map((tip, i) => (
                <li key={i}>{tip}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
