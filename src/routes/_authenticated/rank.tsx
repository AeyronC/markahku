import { createFileRoute, Link } from "@tanstack/react-router";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, PageHeader } from "@/components/mk/ui";
import { useT } from "@/lib/i18n";
import { examIndex, rankPercentile, rankTopPercent } from "@/lib/grading";
import { useGradebook } from "@/lib/gradebook";
import { EXAM_LABEL } from "@/lib/export";

export const Route = createFileRoute("/_authenticated/rank")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Kedudukan · Rank — MarkahKu" },
      { name: "description", content: "Track your class or form position after every exam." },
      { property: "og:title", content: "Rank — MarkahKu" },
      { property: "og:description", content: "Track your class or form position after every exam." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RankPage,
});

function RankPage() {
  const t = useT();
  const { data: book } = useGradebook();
  if (!book) return <Skeleton className="h-96 rounded-2xl" />;

  const sessions = [...book.sessions].sort((a, b) => examIndex(a.form, a.exam) - examIndex(b.form, b.exam));
  const ranked = sessions.filter((s) => s.rank_position);
  const data = ranked.map((s) => ({
    name: `F${s.form} ${EXAM_LABEL[s.exam]}`,
    position: s.rank_position,
    total: s.rank_total,
    pct: s.rank_total ? rankPercentile(s.rank_position!, s.rank_total) : null,
  }));

  return (
    <>
      <PageHeader title={t("rank.title")} sub={t("rank.sub")} />
      {ranked.length === 0 ? (
        <EmptyState
          icon={<Trophy />}
          title={t("rank.empty")}
          action={
            <Link to="/exams" className="text-sm font-medium text-primary hover:underline">
              {t("nav.exams")} →
            </Link>
          }
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-12">
          <Card className="lg:col-span-8">
            <CardHeader>
              <CardTitle>{t("rank.position")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data} margin={{ top: 10, right: 12, left: -10, bottom: 0 }}>
                    <CartesianGrid stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis reversed allowDecimals={false} domain={[1, "dataMax"]} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--popover-foreground)" }}
                      formatter={(v: number, _n, item) => {
                        const p = item.payload as { total: number | null };
                        return [`${v}${p.total ? ` / ${p.total}` : ""}`, t("rank.position")];
                      }}
                    />
                    <Line type="monotone" dataKey="position" stroke="var(--primary)" strokeWidth={3} dot={{ r: 4, fill: "var(--primary)", strokeWidth: 0 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          <Card className="lg:col-span-4">
            <CardContent className="divide-y divide-border p-4">
              {ranked.map((s) => {
                const top = s.rank_total ? rankTopPercent(s.rank_position!, s.rank_total) : null;
                return (
                  <Link key={s.id} to="/exams/$id" params={{ id: s.id }} className="flex items-center justify-between px-2 py-3 hover:text-primary">
                    <div>
                      <div className="font-medium">{t(`exam.${s.exam}`)}</div>
                      <div className="text-xs text-muted-foreground">{t("common.formN", { n: s.form })}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-semibold tabular">
                        {s.rank_position}
                        {s.rank_total ? <span className="text-muted-foreground"> / {s.rank_total}</span> : null}
                      </div>
                      {top != null && <div className="text-xs text-primary">{t("rank.percentile", { p: top })}</div>}
                    </div>
                  </Link>
                );
              })}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
