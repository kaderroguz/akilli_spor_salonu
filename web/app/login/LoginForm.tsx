"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase/client";

type Role = "sporcu" | "hoca" | "admin";
type Mode = "giris" | "kayit";

type Profile = {
  id: string;
  ad_soyad: string | null;
  rol: string | null;
};

const roleHints: Record<Role, string> = {
  sporcu: "Antrenmanlarını Takip Etmek ve Programlarını Görmek İçin Akıllı Spor Salonu Hesabına Giriş Yap",
  hoca: "Sporcularını Takip Etmek ve Program Atamak İçin Akıllı Spor Salonu Hesabına Giriş Yap",
  admin: "Kullanıcı Rolleri ve Başvuruları Yönetmek İçin Akıllı Spor Salonu Hesabına Giriş Yap",
};

function normalizeRole(value: string | null): Role {
  if (value === "hoca" || value === "admin") {
    return value;
  }

  return "sporcu";
}

function isRole(value: string | null | undefined): value is Role {
  return value === "sporcu" || value === "hoca" || value === "admin";
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedRole, setSelectedRole] = useState<Role>(() => normalizeRole(searchParams.get("role")));
  const [mode, setMode] = useState<Mode>("giris");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setMessage("");

    try {
      const supabase = getSupabaseClient();

      if (mode === "kayit") {
        if (selectedRole === "admin") {
          setMessage("Yönetici hesabı uygulama içinden oluşturulamaz.");
          return;
        }

        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              ad_soyad: name.trim(),
              hesap_turu: selectedRole,
            },
          },
        });

        if (error) {
          throw error;
        }

        setMessage(
          selectedRole === "hoca"
            ? "Hoca adaylığı oluşturuldu. Yönetici onayından sonra giriş yapabilirsin."
            : "Sporcu hesabı oluşturuldu. E-posta onayı gerekiyorsa gelen bağlantıyı onayla.",
        );
        setMode("giris");
        return;
      }

      const normalizedEmail = email.trim().toLowerCase();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (error) {
        throw error;
      }

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, ad_soyad, rol")
        .eq("id", data.user.id)
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      let profile = profileData as Profile | null;

      if (!profile && selectedRole === "sporcu") {
        const { data: createdProfile, error: createProfileError } = await supabase
          .from("profiles")
          .insert({
            id: data.user.id,
            ad_soyad: String(data.user.user_metadata?.ad_soyad || "Sporcu"),
            email: data.user.email || normalizedEmail,
            rol: "sporcu",
          })
          .select("id, ad_soyad, rol")
          .single();

        if (createProfileError) {
          throw createProfileError;
        }

        profile = createdProfile as Profile;
      }

      if (!profile || !isRole(profile.rol)) {
        await supabase.auth.signOut();
        setMessage(
          "Giris basarili ama bu hesaba ait panel yetkisi bulunamadi. Hoca/admin hesabiysa yonetici onayi veya profil kaydi gerekli.",
        );
        return;
      }

      router.push(`/${profile.rol}`);
    } catch (error) {
      setMessage(formatAuthError(error));
    } finally {
      setIsLoading(false);
    }
  }

  async function resetPassword() {
    if (!email.includes("@")) {
      setMessage("Şifre sıfırlama için önce e-posta adresini yaz.");
      return;
    }

    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/sifre-yenile`,
      });

      setMessage(
        error
          ? error.message
          : "Şifre yenileme bağlantısı e-posta adresine gönderildi.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "İşlem tamamlanamadı.");
    }
  }

  return (
    <div className="mx-auto grid min-h-[calc(100vh-5rem)] w-full max-w-6xl items-center gap-8 lg:grid-cols-[1fr_440px]">
      <section className="text-center lg:text-left">
        <p className="text-2xl font-black uppercase tracking-[0.18em] text-emerald-200 sm:text-3xl">
          Akıllı Spor Salonu
        </p>
        <h1 className="mx-auto mt-5 max-w-xl text-balance text-3xl font-black leading-tight text-white lg:mx-0">
          {roleHints[selectedRole]}
        </h1>
        <div className="mx-auto mt-8 grid max-w-xl grid-cols-3 gap-3 lg:mx-0">
          <div className="border border-white/15 bg-white/10 p-3 backdrop-blur">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-100">Takip</p>
            <p className="mt-2 text-2xl font-black">Canlı</p>
          </div>
          <div className="border border-white/15 bg-white/10 p-3 backdrop-blur">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-100">Program</p>
            <p className="mt-2 text-2xl font-black">Hedefli</p>
          </div>
          <div className="border border-white/15 bg-white/10 p-3 backdrop-blur">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-100">Salon</p>
            <p className="mt-2 text-2xl font-black">Akıllı</p>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-white/20 bg-slate-950/72 p-5 shadow-2xl backdrop-blur-xl">
        <div className="grid grid-cols-2 gap-2 rounded-lg bg-white/10 p-1">
          <button
            className={`rounded-md px-4 py-3 text-sm font-semibold ${mode === "giris" ? "bg-cyan-400 text-slate-950" : "text-slate-300"}`}
            onClick={() => setMode("giris")}
            type="button"
          >
            Giriş Yap
          </button>
          <button
            className={`rounded-md px-4 py-3 text-sm font-semibold ${mode === "kayit" ? "bg-cyan-400 text-slate-950" : "text-slate-300"}`}
            onClick={() => setMode("kayit")}
            disabled={selectedRole === "admin"}
            type="button"
          >
            Kayıt Ol
          </button>
        </div>

        <div className="mx-auto mt-4 w-full max-w-56 text-center">
          <p className="text-sm font-semibold text-slate-200">Giriş türü</p>
          <select
            className="mt-2 h-9 w-full rounded-md border border-white/10 bg-white px-2 text-center text-sm font-bold text-slate-950 outline-none ring-cyan-300 focus:ring-2"
            onChange={(event) => {
              const role = event.target.value as Role;
              setSelectedRole(role);
              if (role === "admin" && mode === "kayit") {
                setMode("giris");
              }
              setMessage("");
            }}
            value={selectedRole}
          >
            <option value="sporcu">Sporcu</option>
            <option value="hoca">Hoca</option>
            <option value="admin">Yönetici</option>
          </select>
        </div>

        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          {mode === "kayit" && (
            <label className="block">
              <span className="text-sm font-semibold text-slate-200">Ad soyad</span>
              <input
                className="mt-2 h-12 w-full rounded-md border border-white/10 bg-white px-3 text-slate-950 outline-none ring-cyan-300 focus:ring-2"
                onChange={(event) => setName(event.target.value)}
                required
                value={name}
              />
            </label>
          )}

          <label className="block">
            <span className="text-sm font-semibold text-slate-200">E-posta</span>
            <input
              className="mt-2 h-12 w-full rounded-md border border-white/10 bg-white px-3 text-slate-950 outline-none ring-cyan-300 focus:ring-2"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-slate-200">Şifre</span>
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
            disabled={isLoading}
            type="submit"
          >
            {isLoading ? "İşleniyor..." : mode === "giris" ? "Giriş yap" : "Hesap oluştur"}
          </button>
        </form>

        <button
          className="mt-4 text-sm font-semibold text-cyan-200"
          onClick={resetPassword}
          type="button"
        >
          Şifremi unuttum
        </button>

        {message && (
          <p className="mt-4 rounded-md border border-cyan-300/30 bg-cyan-300/10 p-3 text-sm text-cyan-50">
            {message}
          </p>
        )}
      </section>
    </div>
  );
}
function formatAuthError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const normalized = message.toLowerCase();

  if (normalized.includes("invalid login credentials")) {
    return "E-posta veya sifre hatali. Bu hesap Supabase'de yoksa once Kayit Ol ile hesap olustur ya da Sifremi unuttum'u kullan.";
  }

  if (normalized.includes("email not confirmed")) {
    return "E-posta adresin henuz onaylanmamis. Gelen onay baglantisini acip tekrar dene.";
  }

  if (normalized.includes("failed to fetch") || normalized.includes("network")) {
    return "Supabase'e baglanilamadi. Interneti, .env.local ayarlarini ve Supabase projesinin aktif oldugunu kontrol et.";
  }

  if (normalized.includes("permission denied") || normalized.includes("row-level security")) {
    return "Giris yapildi ama profil kaydi okunamadi. Supabase profiles tablo izinlerini kontrol et.";
  }

  return message || "İşlem tamamlanamadı.";
}
