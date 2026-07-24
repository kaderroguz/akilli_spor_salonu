"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";

type DashboardLayoutProps = {
  accent: "cyan" | "emerald" | "blue";
  children: React.ReactNode;
  sidebar?: React.ReactNode;
  subtitle: string;
  title: string;
};

const accentClasses = {
  cyan: {
    link: "text-cyan-300",
    button: "bg-cyan-400 text-slate-950 hover:bg-cyan-300",
    main: "bg-[#07111f]",
    sidebar: "bg-slate-900/55",
  },
  emerald: {
    link: "text-emerald-300",
    button: "bg-emerald-400 text-emerald-950 hover:bg-emerald-300",
    main: "bg-[#101816]",
    sidebar: "bg-emerald-950/35",
  },
  blue: {
    link: "text-blue-300",
    button: "bg-blue-400 text-blue-950 hover:bg-blue-300",
    main: "bg-[#0b1220]",
    sidebar: "bg-blue-950/35",
  },
};

export function DashboardLayout({
  accent,
  children,
  sidebar,
  subtitle,
  title,
}: DashboardLayoutProps) {
  const router = useRouter();
  const colors = accentClasses[accent];
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  async function signOut() {
    const supabase = getSupabaseClient();
    await supabase.auth.signOut();
    router.push("/");
  }

  if (sidebar) {
    return (
      <main className={`relative min-h-screen w-full max-w-full overflow-x-hidden text-white ${colors.main}`}>
        {accent === "cyan" ? (
          <>
            <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(8,47,73,0.92)_0%,rgba(14,116,144,0.72)_34%,rgba(15,23,42,0.86)_68%,rgba(20,83,45,0.72)_100%)]" />
            <div className="absolute left-0 top-0 h-full w-2/5 bg-cyan-300/10 [clip-path:polygon(0_0,70%_0,100%_100%,0_100%)]" />
            <div className="absolute bottom-0 right-0 h-2/3 w-1/2 bg-emerald-300/10 [clip-path:polygon(28%_0,100%_22%,100%_100%,0_100%)]" />
          </>
        ) : null}
        {accent === "emerald" ? (
          <>
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(6,78,59,0.86)_0%,rgba(15,23,42,0.9)_46%,rgba(20,83,45,0.72)_100%)]" />
            <div className="absolute left-[280px] top-0 h-full w-px bg-emerald-200/15" />
            <div className="absolute right-0 top-16 h-48 w-1/3 bg-emerald-300/10 [clip-path:polygon(20%_0,100%_0,100%_100%,0_68%)]" />
          </>
        ) : null}
        {accent === "blue" ? (
          <>
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(30,64,175,0.55)_0%,rgba(15,23,42,0.92)_42%,rgba(30,41,59,0.86)_100%)]" />
            <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(147,197,253,0.08)_1px,transparent_1px),linear-gradient(300deg,rgba(96,165,250,0.06)_1px,transparent_1px)] bg-[size:96px_96px]" />
            <div className="absolute left-[280px] top-0 h-full w-px bg-blue-200/14" />
            <div className="absolute right-0 top-0 h-56 w-2/5 bg-blue-300/8 [clip-path:polygon(18%_0,100%_0,100%_72%,0_100%)]" />
          </>
        ) : null}
        <div className="relative grid min-h-screen w-full max-w-full min-w-0 bg-white/[0.03] lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className={`hidden border-b border-white/10 ${colors.sidebar} p-4 backdrop-blur lg:block lg:border-b-0 lg:border-r lg:p-6`}>
            <Link href="/" className={`block text-2xl font-extrabold leading-tight sm:text-3xl ${colors.link}`}>
              Akıllı Spor Salonu
            </Link>
            <div className="mt-5 lg:mt-6">{sidebar}</div>
          </aside>

          <div className="w-full max-w-full min-w-0 px-3 py-4 sm:px-6 sm:py-8 lg:px-8">
            <div className="mx-auto w-full max-w-7xl min-w-0">
              <div className="mb-4 flex items-center justify-between gap-3 lg:hidden">
                <Link href="/" className={`min-w-0 truncate whitespace-nowrap text-lg font-extrabold leading-tight min-[380px]:text-xl ${colors.link}`}>
                  Akıllı Spor Salonu
                </Link>
                <button
                  aria-expanded={isMenuOpen}
                  aria-label="Menüyü aç"
                  className="grid size-11 place-items-center rounded-md border border-white/15 bg-white/[0.06] text-xl font-black text-white"
                  onClick={() => setIsMenuOpen(true)}
                  type="button"
                >
                  ☰
                </button>
              </div>

              {isMenuOpen ? (
                <div className="fixed inset-0 z-50 lg:hidden">
                  <button
                    aria-label="Menüyü kapat"
                    className="absolute inset-0 bg-slate-950/70"
                    onClick={() => setIsMenuOpen(false)}
                    type="button"
                  />
                  <aside className={`relative h-full w-[min(82vw,320px)] border-r border-white/10 ${colors.sidebar} p-5 shadow-2xl backdrop-blur-xl`}>
                    <div className="flex items-start justify-between gap-3">
                      <Link href="/" className={`block text-2xl font-extrabold leading-tight ${colors.link}`}>
                        Akıllı Spor Salonu
                      </Link>
                      <button
                        aria-label="Menüyü kapat"
                        className="grid size-10 place-items-center rounded-md border border-white/15 bg-white/[0.06] text-lg font-black text-white"
                        onClick={() => setIsMenuOpen(false)}
                        type="button"
                      >
                        ×
                      </button>
                    </div>
                    <div className="mt-6" onClick={() => setIsMenuOpen(false)}>{sidebar}</div>
                  </aside>
                </div>
              ) : null}

              <nav className="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-white/10 bg-white/[0.04] p-4">
                <div className="min-w-0">
                  <p className={`text-sm font-extrabold uppercase tracking-[0.12em] sm:text-lg sm:tracking-[0.16em] ${colors.link}`}>
                    {subtitle}
                  </p>
                  <h1 className="mt-2 text-2xl font-bold leading-tight sm:text-3xl">{title}</h1>
                </div>
                <button
                  className={`shrink-0 self-start rounded-md px-4 py-2 text-sm font-bold transition ${colors.button}`}
                  onClick={signOut}
                  type="button"
                >
                  Çıkış yap
                </button>
              </nav>

              <section className="mt-5 min-w-0 sm:mt-6">{children}</section>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={`min-h-screen px-4 py-6 text-white sm:px-6 sm:py-8 ${colors.main}`}>
      <div className="mx-auto max-w-7xl min-w-0">
        <nav className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className={`text-xl font-extrabold leading-tight ${colors.link}`}>
            Akıllı Spor Salonu
          </Link>
          <button
            className={`rounded-md px-4 py-2 text-sm font-bold transition ${colors.button}`}
            onClick={signOut}
            type="button"
          >
            Çıkış yap
          </button>
        </nav>

        <header className="mt-6 rounded-lg border border-white/10 bg-white/[0.05] p-4 sm:mt-8 sm:p-6">
          <p className={`text-sm font-extrabold uppercase tracking-[0.12em] sm:text-lg sm:tracking-[0.16em] ${colors.link}`}>
            {subtitle}
          </p>
          <h1 className="mt-3 text-2xl font-bold leading-tight sm:text-3xl">{title}</h1>
        </header>

        <section className="mt-5 min-w-0 sm:mt-6">{children}</section>
      </div>
    </main>
  );
}
