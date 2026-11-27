import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { LineChart, Lock, ScanLine, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { GoogleButton } from "@/components/mk/GoogleButton";
import { GradeBadge, LangToggle, Logo } from "@/components/mk/ui";
import { useT } from "@/lib/i18n";
import { cgpaPoints, formatAverage, formatCgpa, summarizeExam } from "@/lib/grading";

export const Route = createFileRoute("/")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "MarkahKu — Jejak markah, gred & CGPA anda" },
      {
        name: "description",
        content: "Private bilingual grade tracker for Form 1–5 students: Sumatif 1, Sumatif 2 and UASA, correct averages, CGPA, goals and an AI study plan.",
      },
      { property: "og:title", content: "MarkahKu — Jejak markah, gred & CGPA anda" },
      {
        property: "og:description",
        content: "Record every exam, see your real average and CGPA, set goals and get a personalised study plan.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const SAMPLE = [
  { s: "Bahasa Melayu", m: 84 },
  { s: "English", m: 78 },
  { s: "Matematik", m: 91 },
  { s: "Sains", m: 69 },
  { s: "Sejarah", m: 74 },
  { s: "Bahasa Iban", m: null },
];

function Landing() {
  const t = useT();
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  const sum = summarizeExam(SAMPLE.map((r) => ({ status: r.m == null ? "pending" : "completed", mark: r.m })));

  return (
    <div className="min-h-screen px-5 py-6 md:px-10">
      <header className="mx-auto flex max-w-6xl items-center justify-between">
        <Logo />
        <LangToggle />
      </header>

      <main className="mx-auto mt-14 grid max-w-6xl items-center gap-12 md:mt-20 lg:grid-cols-[1.1fr_1fr]">
        <section className="animate-rise">
          <div className="glass mb-6 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium text-muted-foreground">
            <Lock className="size-3 text-primary" /> {t("login.private")}
          </div>
          <h1 className="text-4xl font-semibold leading-[1.08] md:text-6xl">
            <span className="text-gradient">{t("login.title")}</span>
          </h1>
          <p className="mt-5 max-w-xl text-base text-muted-foreground md:text-lg">{t("login.sub")}</p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <GoogleButton />
            <Link to="/privacy" className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
              {t("nav.privacy")}
            </Link>
          </div>
          <ul className="mt-10 grid max-w-lg gap-3 sm:grid-cols-3">
            {[
              { i: LineChart, k: "login.f1" as const },
              { i: ScanLine, k: "login.f2" as const },
              { i: Sparkles, k: "login.f3" as const },
            ].map(({ i: Icon, k }) => (
              <li key={k} className="glass flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm">
                <Icon className="size-4 shrink-0 text-primary" />
                {t(k)}
              </li>
            ))}
          </ul>
        </section>

        <section className="glass relative animate-rise rounded-3xl p-5 md:p-7" aria-hidden="true">
          <div className="bg-gradient-primary absolute -right-10 -top-10 size-40 rounded-full opacity-25 blur-3xl" />
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">{t("common.formN", { n: 2 })}</div>
              <div className="font-display text-lg font-semibold">Sumatif 1</div>
            </div>
            <div className="text-right">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">{t("common.cgpa")}</div>
              <div className="font-display text-2xl font-semibold text-primary tabular">{formatCgpa(sum.cgpa)}</div>
            </div>
          </div>
          <div className="divide-y divide-border">
            {SAMPLE.map((r) => (
              <div key={r.s} className="flex items-center justify-between py-2.5 text-sm">
                <span>{r.s}</span>
                <span className="flex items-center gap-3 font-mono tabular">
                  <span className="w-8 text-right">{r.m ?? "—"}</span>
                  <span className="w-10 text-right text-xs text-muted-foreground">{r.m != null ? cgpaPoints(r.m).toFixed(2) : ""}</span>
                  <GradeBadge mark={r.m} className="w-7" />
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-muted p-2.5">
              <div className="text-[11px] text-muted-foreground">{t("common.total")}</div>
              <div className="font-mono font-semibold tabular">{sum.total}</div>
            </div>
            <div className="rounded-xl bg-muted p-2.5">
              <div className="text-[11px] text-muted-foreground">{t("common.average")}</div>
              <div className="font-mono font-semibold tabular">{formatAverage(sum.average)}</div>
            </div>
            <div className="rounded-xl bg-muted p-2.5">
              <div className="text-[11px] text-muted-foreground">{t("common.counted")}</div>
              <div className="font-mono font-semibold tabular">
                {sum.counted}/{SAMPLE.length}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
