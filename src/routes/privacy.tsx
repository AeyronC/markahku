import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useT } from "@/lib/i18n";
import { LangToggle, Logo } from "@/components/mk/ui";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privasi · Privacy — MarkahKu" },
      { name: "description", content: "What MarkahKu stores, what goes to the AI, and how to delete everything." },
      { property: "og:title", content: "Privasi · Privacy — MarkahKu" },
      { property: "og:description", content: "What MarkahKu stores, what goes to the AI, and how to delete everything." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Privacy,
});

function Privacy() {
  const t = useT();
  const sections = [
    ["priv.storedTitle", "priv.storedBody"],
    ["priv.visibilityTitle", "priv.visibilityBody"],
    ["priv.filesTitle", "priv.filesBody"],
    ["priv.aiTitle", "priv.aiBody"],
    ["priv.trackersTitle", "priv.trackersBody"],
    ["priv.deleteTitle", "priv.deleteBody"],
    ["priv.minorsTitle", "priv.minorsBody"],
  ] as const;
  return (
    <div className="min-h-screen px-5 py-6 md:px-10">
      <header className="mx-auto flex max-w-3xl items-center justify-between">
        <Link to="/" aria-label={t("appName")}>
          <Logo />
        </Link>
        <LangToggle />
      </header>
      <main className="mx-auto mt-10 max-w-3xl animate-rise">
        <Link to="/dashboard" className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> {t("appName")}
        </Link>
        <h1 className="text-3xl font-semibold md:text-4xl">{t("priv.title")}</h1>
        <p className="mt-3 text-muted-foreground">{t("priv.intro")}</p>
        <div className="mt-8 space-y-3">
          {sections.map(([title, body]) => (
            <section key={title} className="glass rounded-2xl p-5">
              <h2 className="font-display text-base font-semibold">{t(title)}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{t(body)}</p>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
