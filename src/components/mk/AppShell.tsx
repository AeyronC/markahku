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
  Moon,
  PlusCircle,
  Settings,
  Shield,
  Sparkles,
  Sun,
  Trophy,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { usePrefs, useT } from "@/lib/i18n";
import type { DictKey } from "@/lib/i18n-dict";
import { updateProfile, useProfile, type Profile } from "@/lib/gradebook";
import { LangToggle, Logo } from "./ui";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  const { setLang, theme, setTheme } = usePrefs();
  const location = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: profile } = useProfile();
  const synced = useRef(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (profile && !synced.current) {
      synced.current = true;
      setLang(profile.language === "en" ? "en" : "ms");
      setTheme(profile.theme === "light" ? "light" : "dark");
    }
  }, [profile, setLang, setTheme]);

  const onLang = (language: "ms" | "en") => {
    void updateProfile({ language }).then(() => qc.invalidateQueries({ queryKey: ["profile"] })).catch(() => {
      toast.error(t("common.error"));
    });
  };

  const onTheme = (nextTheme: "dark" | "light") => {
    setTheme(nextTheme);
    void updateProfile({ theme: nextTheme }).then(() => qc.invalidateQueries({ queryKey: ["profile"] })).catch(() => {
      toast.error(t("common.error"));
    });
  };

  async function confirmSignOut() {
    setSigningOut(true);
    try {
      await qc.cancelQueries();
      qc.clear();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setSignOutOpen(false);
      navigate({ to: "/", replace: true });
    } catch {
      toast.error(t("common.error"));
    } finally {
      setSigningOut(false);
    }
  }

  if (location.pathname.startsWith("/onboarding")) {
    return (
      <div className="min-h-screen">
        <Outlet />
      </div>
    );
  }

  const isActive = (to: AppPath) => location.pathname === to || location.pathname.startsWith(to + "/");
  const themeLabel = theme === "dark" ? t("common.light") : t("common.dark");

  return (
    <div className="min-h-screen md:pl-60">
      <aside className="glass-strong fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-y-0 border-l-0 border-r border-sidebar-border bg-sidebar/80 p-4 backdrop-blur-2xl md:flex">
        <Link to="/dashboard" className="mb-8 px-2 pt-1">
          <Logo className="[&>div]:shadow-glow" />
        </Link>
        <div className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {t("nav.main")}
        </div>
        <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                isActive(item.to)
                  ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm ring-1 ring-white/10"
                  : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              )}
            >
              <item.icon className="size-4 shrink-0" />
              <span className="truncate">{t(item.label)}</span>
            </Link>
          ))}
        </nav>

        <div className="mt-4 space-y-3 border-t border-sidebar-border pt-4">
          <StudentBadge profile={profile} compact />
          <div className="flex items-center justify-between gap-2">
            <LangToggle onChange={onLang} />
            <Button
              type="button"
              variant="glass"
              size="icon"
              aria-label={`${t("common.theme")}: ${themeLabel}`}
              title={`${t("common.theme")}: ${themeLabel}`}
              onClick={() => onTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? <Sun /> : <Moon />}
            </Button>
          </div>
          <Link
            to="/privacy"
            className="flex min-h-10 items-center gap-2 rounded-xl px-3 text-xs text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
          >
            <Shield className="size-4" />
            {t("nav.privacy")}
          </Link>
          <button
            type="button"
            onClick={() => setSignOutOpen(true)}
            className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="size-4" />
            {t("nav.signOut")}
          </button>
        </div>
      </aside>

      <header className="glass-strong sticky top-0 z-30 flex flex-col gap-3 rounded-none border-x-0 border-t-0 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] md:flex-row md:items-center md:justify-between md:px-8 md:py-3">
        <div className="flex items-center justify-between gap-3">
          <Link to="/dashboard" className="md:hidden">
            <Logo className="[&>div]:shadow-glow" />
          </Link>
          <div className="hidden md:block">
            <StudentBadge profile={profile} />
          </div>
          <div className="flex items-center gap-2 md:ml-auto">
            <div className="md:hidden">
              <LangToggle onChange={onLang} />
            </div>
            <Button
              type="button"
              variant="glass"
              size="icon"
              className="md:hidden"
              aria-label={`${t("common.theme")}: ${themeLabel}`}
              title={`${t("common.theme")}: ${themeLabel}`}
              onClick={() => onTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? <Sun /> : <Moon />}
            </Button>
          </div>
        </div>
        <div className="md:hidden">
          <StudentBadge profile={profile} compact />
        </div>
        <div className="hidden items-center gap-3 md:flex">
          <LangToggle onChange={onLang} />
          <Button
            type="button"
            variant="glass"
            size="icon"
            aria-label={`${t("common.theme")}: ${themeLabel}`}
            title={`${t("common.theme")}: ${themeLabel}`}
            onClick={() => onTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? <Sun /> : <Moon />}
          </Button>
        </div>
      </header>

      <main className="min-w-0 px-4 pb-[calc(6.75rem+env(safe-area-inset-bottom))] pt-5 md:px-8 md:pb-12 md:pt-8 lg:px-10">
        <div className="mx-auto max-w-7xl animate-rise">
          <Outlet />
        </div>
      </main>

      <nav aria-label={t("nav.main")} className="glass-strong fixed bottom-[calc(0.75rem+env(safe-area-inset-bottom))] left-1/2 z-40 flex w-[calc(100%-1.5rem)] max-w-[30rem] -translate-x-1/2 justify-around rounded-full px-2 py-1.5 md:hidden">
        {TABS.map((to) => {
          const item = NAV.find((entry) => entry.to === to)!;
          const active = isActive(to);
          return (
            <Link
              key={to}
              to={to}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-full px-1 py-1.5 text-[10px] font-semibold transition-colors",
                active ? "bg-primary/15 text-primary" : "text-muted-foreground",
              )}
            >
              <item.icon className="size-5" />
              <span className="max-w-full truncate">{t(item.label)}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className="flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-full px-1 py-1.5 text-[10px] font-semibold text-muted-foreground transition-colors hover:bg-white/5"
          aria-expanded={moreOpen}
        >
          <Menu className="size-5" />
          <span>{t("nav.more")}</span>
        </button>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="glass-strong max-h-[88svh] overflow-y-auto rounded-t-[2rem] border-x-0 border-b-0 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <SheetHeader>
            <SheetTitle>{t("nav.more")}</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-3 gap-2 p-4 pt-0">
            {[...NAV.filter((item) => !TABS.includes(item.to)), { to: "/privacy" as AppPath, label: "nav.privacy" as DictKey, icon: Shield } satisfies NavItem].map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMoreOpen(false)}
                className="glass flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl p-3 text-xs font-medium transition-colors hover:bg-white/10"
              >
                <item.icon className="size-5 text-primary" />
                <span className="text-center">{t(item.label)}</span>
              </Link>
            ))}
            <button
              type="button"
              onClick={() => {
                setMoreOpen(false);
                setSignOutOpen(true);
              }}
              className="glass flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl p-3 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
            >
              <LogOut className="size-5" />
              {t("nav.signOut")}
            </button>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={signOutOpen} onOpenChange={setSignOutOpen}>
        <AlertDialogContent className="glass-strong rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("nav.signOutTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("nav.signOutHint")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={signingOut}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={signingOut}
              onClick={(event) => {
                event.preventDefault();
                void confirmSignOut();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {signingOut ? t("common.saving") : t("nav.signOut")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StudentBadge({ profile, compact = false }: { profile: Profile | null | undefined; compact?: boolean }) {
  const t = useT();
  const name = profile?.display_name?.trim() || t("nav.student");
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase() ?? "")
    .join("") || "MK";
  const form = profile?.current_form ?? 1;
  const school = profile?.school?.trim();

  return (
    <div className={cn("flex min-w-0 items-center gap-3", compact && "rounded-2xl border border-border/60 bg-muted/30 p-2.5")}>
      <Avatar className="size-10 ring-2 ring-primary/20">
        <AvatarFallback className="bg-gradient-primary font-display text-xs font-bold text-primary-foreground">{initials}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{name}</div>
        <div className="mt-0.5 flex min-w-0 items-center gap-2">
          <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
            {t("common.formN", { n: form })}
          </span>
          {school && <span className="truncate text-xs text-muted-foreground">{school}</span>}
        </div>
      </div>
    </div>
  );
}
