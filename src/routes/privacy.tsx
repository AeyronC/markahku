import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { usePrefs } from "@/lib/i18n";
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

const CONTENT = {
  ms: {
    title: "Privasi",
    intro: "MarkahKu dibina untuk pelajar. Ini cara kami menjaga data anda, dalam bahasa yang mudah.",
    items: [
      ["Apa yang disimpan", "Nama paparan, sekolah dan kelas (jika anda isi), Tingkatan, subjek, markah, kedudukan, sasaran dan hasil AI anda."],
      ["Siapa boleh lihat", "Hanya anda. Tiada guru, ibu bapa, rakan atau pentadbir boleh melihat markah anda. Tiada pautan kongsi atau papan pendahulu."],
      ["Fail asal", "Gambar, tangkapan skrin, PDF dan fail Excel/CSV yang anda import disimpan secara peribadi supaya anda boleh lihat semula. Hanya anda boleh membukanya."],
      ["AI", "Apabila anda minta analisis, pelan belajar atau bacaan gambar/PDF, hanya markah, subjek, sasaran dan Tingkatan dihantar ke penyedia AI. Nama, e-mel dan sekolah anda tidak dihantar. Gambar kad laporan dan halaman PDF yang dirender dihantar untuk dibaca, jadi elakkan dokumen yang menunjukkan maklumat peribadi lain."],
      ["Tiada penjejak", "Tiada iklan, analitik atau penjejak pihak ketiga."],
      ["Padam semuanya", "Pergi ke Tetapan → Padam akaun dan semua data saya. Semua markah, fail dan akaun anda dipadam serta-merta. Anda juga boleh muat turun semua data anda dahulu."],
      ["Untuk pelajar bawah 18 tahun", "Bincang dengan ibu bapa atau guru sebelum menggunakan aplikasi ini. Akaun Google untuk bawah umur tertakluk kepada peraturan Google dan PDPA Malaysia."],
    ],
  },
  en: {
    title: "Privacy",
    intro: "MarkahKu is built for students. Here's how your data is handled, in plain language.",
    items: [
      ["What's stored", "Your display name, school and class (if you fill them in), Form, subjects, marks, ranks, goals and AI results."],
      ["Who can see it", "Only you. No teachers, parents, friends or admins can see your marks. There are no share links or leaderboards."],
      ["Original files", "Photos, screenshots, PDFs and Excel/CSV files you import are kept privately so you can look at them again. Only you can open them."],
      ["AI", "When you ask for an analysis, a study plan or an image/PDF read, only your marks, subjects, goals and Form go to the AI provider. Your name, email and school are never sent. Report card photos and rendered PDF pages are sent to be read, so avoid documents that show other personal details."],
      ["No trackers", "No ads, analytics or third-party trackers."],
      ["Delete everything", "Go to Settings → Delete my account and all data. All your marks, files and your account are removed right away. You can download all your data first."],
      ["If you're under 18", "Talk to a parent or teacher before using the app. Google accounts for minors follow Google's rules and Malaysia's PDPA."],
    ],
  },
};

function Privacy() {
  const { lang } = usePrefs();
  const c = CONTENT[lang];
  return (
    <div className="min-h-screen px-5 py-6 md:px-10">
      <header className="mx-auto flex max-w-3xl items-center justify-between">
        <Link to="/" aria-label="MarkahKu">
          <Logo />
        </Link>
        <LangToggle />
      </header>
      <main className="mx-auto mt-10 max-w-3xl animate-rise">
        <Link to="/dashboard" className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> MarkahKu
        </Link>
        <h1 className="text-3xl font-semibold md:text-4xl">{c.title}</h1>
        <p className="mt-3 text-muted-foreground">{c.intro}</p>
        <div className="mt-8 space-y-3">
          {c.items.map(([h, b]) => (
            <section key={h} className="glass rounded-2xl p-5">
              <h2 className="font-display text-base font-semibold">{h}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{b}</p>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
