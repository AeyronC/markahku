import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { translate, type DictKey, type Lang } from "./i18n-dict";

export type Theme = "dark" | "light";

interface PrefsCtx {
  lang: Lang;
  theme: Theme;
  setLang: (l: Lang) => void;
  setTheme: (t: Theme) => void;
  t: (key: DictKey, vars?: Record<string, string | number>) => string;
}

const Ctx = createContext<PrefsCtx | null>(null);

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("ms");
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    const l = localStorage.getItem("mk-lang");
    const th = localStorage.getItem("mk-theme");
    if (l === "en" || l === "ms") setLangState(l);
    if (th === "light" || th === "dark") setThemeState(th);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("light", theme === "light");
    document.documentElement.lang = lang === "ms" ? "ms" : "en";
  }, [theme, lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    localStorage.setItem("mk-lang", l);
  }, []);
  const setTheme = useCallback((th: Theme) => {
    setThemeState(th);
    localStorage.setItem("mk-theme", th);
  }, []);

  const t = useCallback(
    (key: DictKey, vars?: Record<string, string | number>) => translate(lang, key, vars),
    [lang],
  );

  const value = useMemo(() => ({ lang, theme, setLang, setTheme, t }), [lang, theme, setLang, setTheme, t]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePrefs() {
  const c = useContext(Ctx);
  if (!c) throw new Error("usePrefs must be used inside PrefsProvider");
  return c;
}

export function useT() {
  return usePrefs().t;
}
