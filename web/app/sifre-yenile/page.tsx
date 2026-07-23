"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";

export default function SifreYenilePage() {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    async function prepareRecoverySession() {
      try {
        const supabase = getSupabaseClient();
        const code = new URLSearchParams(window.location.search).get("code");

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          window.history.replaceState(null, "", "/sifre-yenile");
        }

        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          setMessage("Yeni sifre belirlemek icin e-postadaki sifre yenileme baglantisini ac.");
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Sifre yenileme baglantisi dogrulanamadi.");
      } finally {
        setIsReady(true);
      }
    }

    prepareRecoverySession();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setMessage("");

    try {
      const supabase = getSupabaseClient();
      const { data } = await supabase.auth.getSession();

      if (!data.session) {
        setMessage("Oturum bulunamadi. E-postadaki sifre yenileme baglantisini tekrar ac.");
        return;
      }

      const { error } = await supabase.auth.updateUser({ password });

      setMessage(error ? error.message : "Sifren guncellendi. Giris yapabilirsin.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sifre guncellenemedi.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <section className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md flex-col justify-center">
        <Link href="/" className="text-sm font-semibold text-cyan-300">
          Ana sayfa
        </Link>
        <h1 className="mt-8 text-3xl font-bold">Sifre yenile</h1>
        <p className="mt-3 text-slate-300">
          E-postadaki baglantidan geldiysen yeni sifreni belirleyebilirsin.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="text-sm font-semibold text-slate-200">Yeni sifre</span>
            <input
              className="mt-2 h-12 w-full rounded-md border border-white/10 bg-white px-3 text-slate-950 outline-none ring-cyan-300 focus:ring-2"
              minLength={6}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>

          <button
            className="h-12 w-full rounded-md bg-cyan-400 px-4 font-bold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isLoading || !isReady}
            type="submit"
          >
            {isLoading ? "Kaydediliyor..." : "Sifremi kaydet"}
          </button>
        </form>

        {message && (
          <p className="mt-4 rounded-md border border-cyan-300/30 bg-cyan-300/10 p-3 text-sm text-cyan-50">
            {message}
          </p>
        )}
      </section>
    </main>
  );
}
