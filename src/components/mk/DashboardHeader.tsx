import type { ReactNode } from "react";
import { MapPin } from "lucide-react";
import skylineNight from "@/assets/kl-skyline.webp.asset.json";
import { useT } from "@/lib/i18n";
import type { Profile } from "@/lib/gradebook";

const SKYLINE_ALT = "KLCC Petronas Twin Towers";

export function DashboardHeader({ profile, form, actions, filters }: {
  profile: Profile | null | undefined;
  form: number;
  actions: ReactNode;
  filters: ReactNode;
}) {
  const t = useT();
  const name = profile?.display_name?.trim();

  return (
    <section className="mb-7" aria-label={t("dash.title")}>
      <div className="dashboard-welcome relative isolate overflow-hidden border-b border-border pb-7 pt-2 sm:pb-8">
        {/* Night skyline (dark mode — default, hidden in .light) */}
        <img src={skylineNight.url} alt={SKYLINE_ALT} fetchPriority="high" className="dashboard-skyline dashboard-skyline--night pointer-events-none absolute inset-0 -z-20 h-full w-full object-cover object-right" />
        {/* Day skyline (light mode — hidden by default, shown in .light) */}
        <img src="/klcc-day.jpg" alt={SKYLINE_ALT} loading="lazy" className="dashboard-skyline dashboard-skyline--day pointer-events-none absolute inset-0 -z-20 h-full w-full object-cover object-right" />
        <div className="dashboard-skyline-shade pointer-events-none absolute inset-0 -z-10" />
        <div className="relative max-w-2xl">
          <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs font-medium text-muted-foreground">
            <span className="text-signal">{t("dash.title")}</span>
            <span aria-hidden="true">/</span>
            <span>{t("common.year")} {new Date().getFullYear()}</span>
          </div>
          <h1 className="max-w-xl break-words text-3xl font-semibold leading-snug sm:text-4xl">
            {name ? t("dash.welcome", { name }) : t("dash.welcomeNoName")}
          </h1>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
            <span className="inline-flex items-center gap-2 rounded-md border border-primary/20 bg-primary/10 px-2.5 py-1 font-medium text-primary">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
              {t("common.formN", { n: form })}
            </span>
            {profile?.school?.trim() && <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 text-muted-foreground"><MapPin className="size-3.5 shrink-0" /><span className="break-words">{profile.school}</span></span>}
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-2">{actions}</div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 pt-5">{filters}</div>
    </section>
  );
}