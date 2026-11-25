import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
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
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-sidebar-border bg-sidebar px-3 pb-4 pt-6 md:flex">
        <Link to="/dashboard" className="mb-7 flex min-h-10 items-center px-3" aria-label="MarkahKu">
          <Logo />
        </Link>
        <div className="mb-3 px-3 text-xs font-medium text-muted-foreground">{t("nav.main")}</div>
        <nav aria-label={t("nav.main")} className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
          {NAV.filter((item) => item.to !== "/settings").map((item) => (
            <Link key={item.to} to={item.to} aria-current={isActive(item.to) ? "page" : undefined}
              className={cn("group flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive(item.to) ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:bg-muted hover:text-sidebar-foreground")}
            >
              <item.icon className={cn("size-[18px] shrink-0", isActive(item.to) && "text-primary")} />
              <span className="min-w-0 flex-1">{t(item.label)}</span>
              {isActive(item.to) && <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-primary" />}
            </Link>
          ))}
        </nav>
        <div className="mt-5 space-y-1 border-t border-sidebar-border pt-3">
          <Link to="/settings" aria-current={isActive("/settings") ? "page" : undefined} className={cn("flex min-h-10 items-center gap-3 rounded-md px-3 text-sm transition-colors", isActive("/settings") ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
            <Settings className="size-[18px]" />{t("nav.settings")}
          </Link>
          <Link to="/privacy" aria-current={isActive("/privacy") ? "page" : undefined} className="flex min-h-10 items-center gap-3 rounded-md px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground">
            <Shield className="size-[18px]" />{t("nav.privacy")}
          </Link>
          <Button type="button" variant="ghost" onClick={() => setSignOutOpen(true)} className="min-h-10 w-full justify-start gap-3 px-3 font-normal text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
            <LogOut className="size-[18px]" />{t("nav.signOut")}
          </Button>
        </div>
        <Link to="/settings" className="mt-4 block rounded-md border border-sidebar-border bg-muted/30 p-3 transition-colors hover:bg-muted">
          <StudentBadge profile={profile} compact />
        </Link>
      </aside>

      <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between gap-3 border-b border-border bg-background/95 px-4 pt-[env(safe-area-inset-top)] md:px-8 lg:px-10">
        <div className="flex min-w-0 items-center gap-3">
          <Button type="button" variant="ghost" size="icon" className="shrink-0 md:hidden" onClick={() => setMoreOpen(true)} aria-label={t("nav.main")} aria-expanded={moreOpen}><Menu /></Button>
          <Link to="/dashboard" className="md:hidden"><Logo /></Link>
          <div className="hidden min-w-0 items-center gap-2 text-sm md:flex">
            <span className="text-muted-foreground">MarkahKu</span><span aria-hidden="true" className="text-muted-foreground/50">/</span>
            <span className="truncate font-medium">{t(NAV.find((item) => isActive(item.to))?.label ?? "nav.dashboard")}</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <LangToggle onChange={onLang} />
          <Button type="button" variant="ghost" size="icon" className="size-9" aria-label={`${t("common.theme")}: ${themeLabel}`} title={`${t("common.theme")}: ${themeLabel}`} onClick={() => onTheme(theme === "dark" ? "light" : "dark")}>
            {theme === "dark" ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
          </Button>
        </div>
      </header>

      <main className="min-w-0 px-4 pb-[calc(6.75rem+env(safe-area-inset-bottom))] pt-5 md:px-8 md:pb-12 md:pt-8 lg:px-10">
        <div className="mx-auto max-w-7xl animate-rise">
          <Outlet />
        </div>
      </main>

      <nav aria-label={t("nav.main")} className="fixed inset-x-0 bottom-0 z-40 flex min-h-16 items-stretch border-t border-border bg-sidebar px-2 pb-[env(safe-area-inset-bottom)] md:hidden">
        {TABS.map((to) => {
          const item = NAV.find((entry) => entry.to === to);
          if (!item) return null;
          const active = isActive(to);
          return (
            <Link key={to} to={to} aria-current={active ? "page" : undefined} className={cn("relative flex min-h-16 min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-[10px] font-medium transition-colors", active ? "text-primary" : "text-muted-foreground hover:text-foreground")}>
              {active && <span aria-hidden="true" className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-primary" />}
              <item.icon className="size-5 shrink-0" /><span className="max-w-full truncate">{t(item.label)}</span>
            </Link>
          );
        })}
        <Button type="button" variant="ghost" onClick={() => setMoreOpen(true)} className="h-auto min-h-16 min-w-0 flex-1 flex-col gap-1 rounded-none px-1 py-2 text-[10px] font-medium text-muted-foreground" aria-expanded={moreOpen}>
          <Menu className="size-5" /><span>{t("nav.more")}</span>
        </Button>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="left" className="flex w-[min(20rem,88vw)] flex-col gap-0 border-sidebar-border bg-sidebar p-0">
          <SheetHeader className="border-b border-sidebar-border px-5 pb-5 pt-6 text-left">
            <Logo /><SheetTitle className="mt-3 text-sm font-medium text-muted-foreground">{t("nav.main")}</SheetTitle>
          </SheetHeader>
          <nav aria-label={t("nav.more")} className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3">
            {[...NAV, { to: "/privacy" as AppPath, label: "nav.privacy" as DictKey, icon: Shield } satisfies NavItem].map((item) => (
              <Link key={item.to} to={item.to} onClick={() => setMoreOpen(false)} aria-current={isActive(item.to) ? "page" : undefined}
                className={cn("flex min-h-11 items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium", isActive(item.to) ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/75 hover:bg-muted hover:text-foreground")}>
                <item.icon className="size-[18px] shrink-0" /><span className="min-w-0 flex-1">{t(item.label)}</span>
                {isActive(item.to) && <ArrowUpRight aria-hidden="true" className="size-4 text-primary" />}
              </Link>
            ))}
          </nav>
          <div className="space-y-3 border-t border-sidebar-border p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <StudentBadge profile={profile} compact />
            <Button type="button" variant="ghost" className="w-full justify-start gap-3 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" onClick={() => { setMoreOpen(false); setSignOutOpen(true); }}>
              <LogOut />{t("nav.signOut")}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={signOutOpen} onOpenChange={setSignOutOpen}>
        <AlertDialogContent className="rounded-lg">
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
    <div className={cn("flex min-w-0 items-center gap-3", compact && "gap-2.5")}>
      <Avatar className="size-9 shrink-0 rounded-md">
        <AvatarFallback className="rounded-md bg-primary/15 font-display text-xs font-semibold text-primary">{initials}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{name}</div>
        <div className="mt-0.5 flex min-w-0 items-center gap-2">
          <span className="shrink-0 text-[10px] font-medium text-muted-foreground">
            {t("common.formN", { n: form })}
          </span>
          {school && <span className="truncate text-xs text-muted-foreground">{school}</span>}
        </div>
      </div>
    </div>
  );
}
