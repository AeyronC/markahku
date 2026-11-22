import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useT } from "@/lib/i18n";
import { formatAverage, formatCgpa } from "@/lib/grading";
import type { Gradebook } from "@/lib/gradebook";
import { allExamPoints } from "@/lib/book-derived";
import { EXAM_LABEL } from "@/lib/export";

export function TrendChart({ book, metric, form }: { book: Gradebook; metric: "average" | "cgpa"; form: number | null }) {
  const t = useT();
  const pts = allExamPoints(book)
    .filter((p) => (form == null || p.form === form) && p[metric] != null)
    .map((p) => ({
      name: form == null ? `F${p.form} ${short(p.exam)}` : EXAM_LABEL[p.exam],
      value: p[metric],
    }));
  if (pts.length === 0) return <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">{t("exams.noData")}</div>;
  const metricLabel = metric === "average" ? t("common.average") : t("common.cgpa");
  const values = pts.map((p) => `${p.name}: ${metric === "average" ? formatAverage(p.value) : formatCgpa(p.value)}`).join(", ");
  return (
    <div className="h-56 w-full" role="img" aria-label={t("dash.trendAccessible", { metric: metricLabel, values })}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={pts} margin={{ top: 10, right: 12, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id="mkLine" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="var(--primary)" />
              <stop offset="100%" stopColor="var(--primary-glow)" />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="name" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis
            domain={metric === "average" ? [0, 100] : [0, 4]}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--popover-foreground)" }}
            formatter={(v: number) => [metric === "average" ? formatAverage(v) : formatCgpa(v), metric === "average" ? t("common.average") : t("common.cgpa")]}
          />
          <Line type="monotone" dataKey="value" stroke="url(#mkLine)" strokeWidth={3} dot={{ r: 4, fill: "var(--primary)", strokeWidth: 0 }} activeDot={{ r: 6 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function short(e: string) {
  return e === "sumatif_1" ? "S1" : e === "sumatif_2" ? "S2" : "UASA";
}
