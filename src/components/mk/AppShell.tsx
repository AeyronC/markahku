import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  CalendarRange,
  ClipboardList,
  Goal,
  LayoutDashboard,
  LogOut,
  Menu,
  PlusCircle,
  Settings,
  Shield,
  Sparkles,
  Trophy,
  Upload,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { usePrefs, useT } from "@/lib/i18n";
import type { DictKey } from "@/lib/i18n-dict";
import { updateProfile, useProfile } from "@/lib/gradebook";
import { LangToggle, Logo } from "./ui";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

type AppPath =
  | "/dashboard"
  | "/exams"
  | "/quick-add"
  | "/import"
  | "/yearly"
  | "/goals"
  | "/rank"
  | "/analyst"
  | "/settings"
  | "/privacy";
type NavItem = { to: AppPath; label: DictKey; icon: typeof LayoutDashboard };

const NAV: NavItem[] = [
  { to: "/dashboard", label: "nav.dashboard", icon: LayoutDashboard },
  { to: "/exams", label: "nav.exams", icon: ClipboardList },
  { to: "/quick-add", label: "nav.quickAdd", icon: PlusCircle },
  { to: "/import", label: "nav.import", icon: Upload },
  { to: "/yearly", label: "nav.yearly", icon: CalendarRange },
  { to: "/goals", label: "nav.goals", icon: Goal },
  { to: "/rank", label: "nav.rank", icon: Trophy },
  { to: "/analyst", label: "nav.analyst", icon: Sparkles },
  { to: "/settings", label: "nav.settings", icon: Settings },
];

const TABS: AppPath[] = ["/dashboard", "/exams", "/import", "/analyst"];

export function AppShell() {
  const t = useT();
  const { setLang, setTheme } = usePrefs();
  const location = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: profile } = useProfile();
  const synced = useRef(false);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    if (profile && !synced.current) {
      synced.current = true;
      setLang(profile.language === "en" ? "en" : "ms");
      setTheme(profile.theme === "light" ? "light" : "dark");
    }
  }, [profile, setLang, setTheme]);

  const onLang = (l: "ms" | "en") => {
    updateProfile({ language: l }).then(() => qc.invalidateQueries({ queryKey: ["profile"] }));
  };

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  if (location.pathname.startsWith("/onboarding")) {
    return (
      <div className="min-h-screen">
        <Outlet />
      </div>
    );
  }

  const isActive = (to: AppPath) => location.pathname === to || location.pathname.startsWith(to + "/");

  return (
    <div className="min-h-screen md:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar p-4 backdrop-blur-xl md:flex">
        <Link to="/dashboard" className="mb-8 px-2 pt-1">
          <Logo />
        </Link>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                isActive(n.to)
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              )}
            >
              <n.icon className="size-4" />
              {t(n.label)}
            </Link>
          ))}
        </nav>
        <div className="mt-4 space-y-3 border-t border-sidebar-border pt-4">
          <div className="flex items-center justify-between px-2">
            <LangToggle onChange={onLang} />
            <Link to="/privacy" className="text-xs text-muted-foreground hover:text-foreground">
              <Shield className="mr-1 inline size-3" />
              {t("nav.privacy")}
            </Link>
          </div>
          <button
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
          >
            <LogOut className="size-4" />
            {t("nav.signOut")}
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="glass-strong sticky top-0 z-30 flex items-center justify-between rounded-none border-x-0 border-t-0 px-4 py-3 md:hidden">
        <Link to="/dashboard">
          <Logo />
        </Link>
        <LangToggle onChange={onLang} />
      </header>

      <main className="min-w-0 flex-1 px-4 pb-28 pt-6 md:px-8 md:pb-12 md:pt-8 lg:px-10">
        <div className="mx-auto max-w-6xl animate-rise">
          <Outlet />
        </div>
      </main>

      {/* Mobile tab bar */}
      <nav className="glass-strong fixed inset-x-3 bottom-3 z-40 flex justify-around rounded-2xl px-2 py-1.5 md:hidden">
        {TABS.map((to) => {
          const n = NAV.find((x) => x.to === to)!;
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-medium",
                isActive(to) ? "text-primary" : "text-muted-foreground",
              )}
            >
              <n.icon className="size-5" />
              {t(n.label)}
            </Link>
          );
        })}
        <button
          onClick={() => setMoreOpen(true)}
          className="flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-medium text-muted-foreground"
        >
          <Menu className="size-5" />
          {t("nav.more")}
        </button>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="glass-strong rounded-t-3xl border-x-0 border-b-0">
          <SheetHeader>
            <SheetTitle>{t("nav.more")}</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-3 gap-2 p-4 pt-0">
            {[...NAV.filter((n) => !TABS.includes(n.to)), { to: "/privacy" as AppPath, label: "nav.privacy" as DictKey, icon: Shield } satisfies NavItem].map((n) => (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setMoreOpen(false)}
                className="glass flex flex-col items-center gap-1.5 rounded-xl p-3 text-xs font-medium"
              >
                <n.icon className="size-5 text-primary" />
                {t(n.label)}
              </Link>
            ))}
            <button onClick={signOut} className="glass flex flex-col items-center gap-1.5 rounded-xl p-3 text-xs font-medium">
              <LogOut className="size-5 text-muted-foreground" />
              {t("nav.signOut")}
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

