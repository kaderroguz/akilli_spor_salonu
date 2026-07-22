"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/DashboardLayout";
import { getSupabaseClient } from "@/lib/supabase/client";

type Tab = "ozet" | "program" | "sonuclar" | "bildirimler" | "profil";

type Profile = {
  id: string;
  ad_soyad: string | null;
  email: string | null;
  rol: string | null;
  created_at: string | null;
  dogum_tarihi: string | null;
  boy_cm: number | null;
  kilo_kg: number | null;
  seviye: string | null;
  sakatlik_notu: string | null;
  saglik_verisi_onayi: boolean | null;
};

type Training = {
  id: number;
  hareket: string | null;
  sure_saniye: number | null;
  toplam: number | null;
  dogru: number | null;
  hatali: number | null;
  basari_yuzdesi: number | null;
  en_sik_form_hatasi: string | null;
  tarih: string | null;
};

type Program = {
  id: number;
  odev_no: number | null;
  hareket: string | null;
  hedef_tekrar: number | null;
  notlar: string | null;
  durum: string | null;
  tarih: string | null;
  baslangic_tarihi: string | null;
  bitis_tarihi: string | null;
};

type Notification = {
  id: number;
  odev_no: number | null;
  mesaj: string | null;
  okundu: boolean | null;
  created_at: string | null;
  profiles?: { ad_soyad: string | null } | { ad_soyad: string | null }[] | null;
};

type CoachConnection = {
  durum: string | null;
  hoca_id: string;
  profiles?: { ad_soyad: string | null; email: string | null } | { ad_soyad: string | null; email: string | null }[] | null;
};

const tabs: Array<{ id: Tab; label: string }> = [
  { id: "ozet", label: "Ozet" },
  { id: "program", label: "Program" },
  { id: "sonuclar", label: "Sonuclar" },
  { id: "bildirimler", label: "Bildirimler" },
  { id: "profil", label: "Profil" },
];

export default function SporcuPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("ozet");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [connections, setConnections] = useState<CoachConnection[]>([]);
  const [message, setMessage] = useState("Yukleniyor...");
  const [actionMessage, setActionMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [coachCode, setCoachCode] = useState("");

  const totals = useMemo(() => {
    const toplam = sum(trainings, "toplam");
    const dogru = sum(trainings, "dogru");
    const hatali = sum(trainings, "hatali");
    return {
      toplam,
      dogru,
      hatali,
      basari: toplam ? Math.round((dogru / toplam) * 1000) / 10 : 0,
      puan: dogru * 2 - hatali,
    };
  }, [trainings]);

  const load = useCallback(async () => {
    try {
      const supabase = getSupabaseClient();
      const { data: authData } = await supabase.auth.getUser();

      if (!authData.user) {
        router.push("/login?role=sporcu");
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id,ad_soyad,email,rol,created_at,dogum_tarihi,boy_cm,kilo_kg,seviye,sakatlik_notu,saglik_verisi_onayi")
        .eq("id", authData.user.id)
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      if (!profileData || profileData.rol !== "sporcu") {
        router.push("/login?role=sporcu");
        return;
      }

      const [trainingResult, programResult, notificationResult, connectionResult] =
        await Promise.all([
          supabase
            .from("antrenmanlar")
            .select("id,hareket,sure_saniye,toplam,dogru,hatali,basari_yuzdesi,en_sik_form_hatasi,tarih")
            .eq("sporcu_id", authData.user.id)
            .order("tarih", { ascending: false })
            .limit(50),
          supabase
            .from("programlar")
            .select("id,odev_no,hareket,hedef_tekrar,notlar,durum,tarih,baslangic_tarihi,bitis_tarihi")
            .eq("sporcu_id", authData.user.id)
            .order("baslangic_tarihi", { ascending: true })
            .limit(100),
          supabase
            .from("bildirimler")
            .select("id,odev_no,mesaj,okundu,created_at,profiles!bildirimler_hoca_id_fkey(ad_soyad)")
            .eq("sporcu_id", authData.user.id)
            .order("created_at", { ascending: false })
            .limit(30),
          supabase
            .from("hoca_sporcu")
            .select("hoca_id,durum,profiles!hoca_sporcu_hoca_id_fkey(ad_soyad,email)")
            .eq("sporcu_id", authData.user.id)
            .order("created_at", { ascending: false }),
        ]);

      if (trainingResult.error) throw trainingResult.error;
      if (programResult.error) throw programResult.error;
      if (notificationResult.error) throw notificationResult.error;
      if (connectionResult.error) throw connectionResult.error;

      setProfile(profileData as Profile);
      setTrainings((trainingResult.data as Training[]) || []);
      setPrograms((programResult.data as Program[]) || []);
      setNotifications((notificationResult.data as Notification[]) || []);
      setConnections((connectionResult.data as CoachConnection[]) || []);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Veriler yuklenemedi.");
    }
  }, [router]);

  useEffect(() => {
    // Auth durumu ve Supabase verileri client tarafinda oturumdan okunuyor.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function completeProgram(id: number) {
    setIsSaving(true);
    setActionMessage("");
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from("programlar")
        .update({ durum: "tamamlandi" })
        .eq("id", id);
      if (error) throw error;
      setActionMessage("Program tamamlandi olarak isaretlendi.");
      await load();
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "Program guncellenemedi.");
    } finally {
      setIsSaving(false);
    }
  }

  async function markNotificationRead(id: number) {
    setIsSaving(true);
    setActionMessage("");
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from("bildirimler")
        .update({ okundu: true })
        .eq("id", id);
      if (error) throw error;
      setActionMessage("Bildirim okundu olarak isaretlendi.");
      await load();
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "Bildirim guncellenemedi.");
    } finally {
      setIsSaving(false);
    }
  }

  async function sendCoachRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setActionMessage("");
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.rpc("hoca_istegi_gonder", {
        girilen_kod: coachCode.trim(),
      });
      if (error) throw error;
      setCoachCode("");
      setActionMessage("Hoca istegi gonderildi.");
      await load();
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "Hoca istegi gonderilemedi.");
    } finally {
      setIsSaving(false);
    }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;
    const form = new FormData(event.currentTarget);
    setIsSaving(true);
    setActionMessage("");
    try {
      const supabase = getSupabaseClient();
      const payload = {
        ad_soyad: String(form.get("ad_soyad") || "").trim(),
        dogum_tarihi: nullableString(form.get("dogum_tarihi")),
        boy_cm: nullableNumber(form.get("boy_cm")),
        kilo_kg: nullableNumber(form.get("kilo_kg")),
        seviye: nullableString(form.get("seviye")),
        sakatlik_notu: nullableString(form.get("sakatlik_notu")),
        saglik_verisi_onayi: form.get("saglik_verisi_onayi") === "on",
        profil_guncelleme_zamani: new Date().toISOString(),
      };
      if (payload.ad_soyad.length < 2) {
        setActionMessage("Ad soyad en az 2 karakter olmali.");
        return;
      }
      const { error } = await supabase.from("profiles").update(payload).eq("id", profile.id);
      if (error) throw error;
      setActionMessage("Profil kaydedildi.");
      await load();
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "Profil kaydedilemedi.");
    } finally {
      setIsSaving(false);
    }
  }

  const pendingNotifications = notifications.filter((item) => !item.okundu).length;
  const activePrograms = programs.filter((item) => item.durum !== "tamamlandi");

  return (
    <DashboardLayout
      accent="cyan"
      subtitle="Sporcu Paneli"
      title={`Merhaba ${profile?.ad_soyad || "Sporcu"}`}
    >
      {message ? <Status text={message} /> : null}
      {actionMessage ? <Status text={actionMessage} /> : null}

      <div className="grid gap-4 md:grid-cols-5">
        <Metric label="Antrenman" value={trainings.length} />
        <Metric label="Toplam tekrar" value={totals.toplam} />
        <Metric label="Dogru tekrar" value={totals.dogru} />
        <Metric label="Basari" value={`%${totals.basari}`} />
        <Metric label="Puan" value={totals.puan} />
      </div>

      <div className="mt-6 flex gap-2 overflow-x-auto rounded-lg border border-white/10 bg-white/[0.04] p-2">
        {tabs.map((tab) => (
          <button
            className={`h-11 shrink-0 rounded-md px-4 text-sm font-bold transition ${
              activeTab === tab.id ? "bg-cyan-400 text-slate-950" : "text-slate-300 hover:bg-white/10"
            }`}
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "ozet" && (
        <div className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
          <Panel title="Bugunku durum">
            <div className="grid gap-3 sm:grid-cols-3">
              <MiniStat label="Aktif program" value={activePrograms.length} />
              <MiniStat label="Okunmamis bildirim" value={pendingNotifications} />
              <MiniStat label="Son basari" value={`%${trainings[0]?.basari_yuzdesi ?? 0}`} />
            </div>
            <div className="mt-5 rounded-md border border-cyan-300/20 bg-cyan-300/10 p-4">
              <h3 className="font-bold text-cyan-50">Kamera analizi</h3>
              <p className="mt-2 text-sm leading-6 text-cyan-100">
                Python hareket analizi motoru korunacak. Sonraki adimda bu alan FastAPI veya benzeri bir servis uzerinden kameraya baglanacak.
              </p>
            </div>
          </Panel>
          <Panel title="Son antrenmanlar">
            <TrainingList trainings={trainings.slice(0, 5)} />
          </Panel>
        </div>
      )}

      {activeTab === "program" && (
        <Panel title="Programlarim">
          <ProgramList disabled={isSaving} onComplete={completeProgram} programs={programs} />
        </Panel>
      )}

      {activeTab === "sonuclar" && (
        <Panel title="Antrenman sonuclarim">
          <TrainingSummary trainings={trainings} totals={totals} />
        </Panel>
      )}

      {activeTab === "bildirimler" && (
        <Panel title="Hoca bildirimleri">
          <NotificationList
            disabled={isSaving}
            notifications={notifications}
            onRead={markNotificationRead}
          />
        </Panel>
      )}

      {activeTab === "profil" && profile && (
        <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_380px]">
          <Panel title="Profilim">
            <ProfileForm disabled={isSaving} onSubmit={saveProfile} profile={profile} />
          </Panel>
          <Panel title="Bagli hocam">
            <CoachPanel
              coachCode={coachCode}
              connections={connections}
              disabled={isSaving}
              onCoachCodeChange={setCoachCode}
              onSubmit={sendCoachRequest}
            />
          </Panel>
        </div>
      )}
    </DashboardLayout>
  );
}

function TrainingSummary({
  trainings,
  totals,
}: {
  trainings: Training[];
  totals: { toplam: number; dogru: number; hatali: number; basari: number; puan: number };
}) {
  const mostCommonError = mostCommon(
    trainings.map((item) => item.en_sik_form_hatasi).filter(Boolean) as string[],
  );

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-4">
        <MiniStat label="Toplam" value={totals.toplam} />
        <MiniStat label="Dogru" value={totals.dogru} />
        <MiniStat label="Hatali" value={totals.hatali} />
        <MiniStat label="Basari" value={`%${totals.basari}`} />
      </div>
      {mostCommonError ? (
        <p className="mt-4 rounded-md bg-amber-300/10 p-3 text-sm text-amber-100">
          En sik form hatasi: {mostCommonError}
        </p>
      ) : null}
      <TrainingList trainings={trainings} />
    </>
  );
}

function TrainingList({ trainings }: { trainings: Training[] }) {
  if (!trainings.length) return <Empty text="Henuz antrenman kaydi yok." />;

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[760px] border-separate border-spacing-y-2 text-left text-sm">
        <thead className="text-slate-300">
          <tr>
            <th className="px-3 py-2">Tarih</th>
            <th className="px-3 py-2">Hareket</th>
            <th className="px-3 py-2">Sure</th>
            <th className="px-3 py-2">Toplam</th>
            <th className="px-3 py-2">Dogru</th>
            <th className="px-3 py-2">Hatali</th>
            <th className="px-3 py-2">Basari</th>
          </tr>
        </thead>
        <tbody>
          {trainings.map((training) => (
            <tr className="bg-white/[0.05]" key={training.id}>
              <td className="rounded-l-md px-3 py-3">{formatDateTime(training.tarih)}</td>
              <td className="px-3 py-3 font-semibold">{training.hareket || "-"}</td>
              <td className="px-3 py-3">{training.sure_saniye ? `${training.sure_saniye} sn` : "-"}</td>
              <td className="px-3 py-3">{training.toplam || 0}</td>
              <td className="px-3 py-3 text-emerald-200">{training.dogru || 0}</td>
              <td className="px-3 py-3 text-rose-200">{training.hatali || 0}</td>
              <td className="rounded-r-md px-3 py-3">%{training.basari_yuzdesi || 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProgramList({
  disabled,
  onComplete,
  programs,
}: {
  disabled: boolean;
  onComplete: (id: number) => void;
  programs: Program[];
}) {
  if (!programs.length) return <Empty text="Atanmis program bulunmuyor." />;

  return (
    <div className="mt-4 grid gap-3">
      {programs.map((program) => {
        const done = program.durum === "tamamlandi";
        return (
          <article className="rounded-lg border border-white/10 bg-white/[0.05] p-4" key={program.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-cyan-200">Odev {program.odev_no || "-"}</p>
                <h3 className="mt-1 text-lg font-bold">{program.hareket || "-"}</h3>
                <p className="mt-2 text-sm text-slate-300">
                  {formatDate(program.baslangic_tarihi || program.tarih)} - {formatDate(program.bitis_tarihi || program.tarih)}
                </p>
              </div>
              <span className={`rounded-md px-3 py-1 text-sm font-bold ${done ? "bg-emerald-300 text-emerald-950" : "bg-cyan-300 text-slate-950"}`}>
                {done ? "Tamamlandi" : "Planlandi"}
              </span>
            </div>
            <p className="mt-3 text-sm text-slate-200">Hedef: {program.hedef_tekrar || 0} tekrar</p>
            {program.notlar ? <p className="mt-2 text-sm text-slate-300">Hoca notu: {program.notlar}</p> : null}
            {!done ? (
              <button
                className="mt-4 h-10 rounded-md bg-cyan-400 px-4 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-60"
                disabled={disabled}
                onClick={() => onComplete(program.id)}
                type="button"
              >
                Tamamlandi olarak isaretle
              </button>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

function NotificationList({
  disabled,
  notifications,
  onRead,
}: {
  disabled: boolean;
  notifications: Notification[];
  onRead: (id: number) => void;
}) {
  if (!notifications.length) return <Empty text="Henuz hocanizdan bildirim gelmedi." />;

  return (
    <div className="mt-4 grid gap-3">
      {notifications.map((notification) => {
        const coach = relationOne(notification.profiles);
        return (
          <article className="rounded-lg border border-white/10 bg-white/[0.05] p-4" key={notification.id}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-bold">{coach?.ad_soyad || "Hoca"}</p>
              <p className="text-sm text-slate-300">{formatDateTime(notification.created_at)}</p>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-100">{notification.mesaj || ""}</p>
            <p className="mt-2 text-sm text-slate-300">Odev {notification.odev_no || "-"}</p>
            {!notification.okundu ? (
              <button
                className="mt-4 h-10 rounded-md bg-cyan-400 px-4 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-60"
                disabled={disabled}
                onClick={() => onRead(notification.id)}
                type="button"
              >
                Okundu olarak isaretle
              </button>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

function ProfileForm({
  disabled,
  onSubmit,
  profile,
}: {
  disabled: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  profile: Profile;
}) {
  return (
    <form className="mt-4 grid gap-4" onSubmit={onSubmit}>
      <Field label="Ad soyad" name="ad_soyad" required value={profile.ad_soyad || ""} />
      <Field label="E-posta" name="email" readOnly value={profile.email || ""} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Dogum tarihi" name="dogum_tarihi" type="date" value={profile.dogum_tarihi || ""} />
        <Field label="Boy (cm)" name="boy_cm" type="number" value={profile.boy_cm || ""} />
        <Field label="Kilo (kg)" name="kilo_kg" step="0.1" type="number" value={profile.kilo_kg || ""} />
      </div>
      <label className="block">
        <span className="text-sm font-semibold text-slate-200">Spor seviyesi</span>
        <select
          className="mt-2 h-12 w-full rounded-md border border-white/10 bg-white px-3 text-slate-950 outline-none ring-cyan-300 focus:ring-2"
          defaultValue={profile.seviye || "Baslangic"}
          name="seviye"
        >
          <option value="Baslangic">Baslangic</option>
          <option value="Orta">Orta</option>
          <option value="Ileri">Ileri</option>
        </select>
      </label>
      <label className="block">
        <span className="text-sm font-semibold text-slate-200">Sakatlik veya dikkat notu</span>
        <textarea
          className="mt-2 min-h-28 w-full rounded-md border border-white/10 bg-white px-3 py-3 text-slate-950 outline-none ring-cyan-300 focus:ring-2"
          defaultValue={profile.sakatlik_notu || ""}
          name="sakatlik_notu"
        />
      </label>
      <label className="flex items-start gap-3 text-sm text-slate-200">
        <input
          className="mt-1 size-4"
          defaultChecked={Boolean(profile.saglik_verisi_onayi)}
          name="saglik_verisi_onayi"
          type="checkbox"
        />
        Bu istege bagli spor ve saglik bilgilerimin kaydedilmesine izin veriyorum.
      </label>
      <button
        className="h-11 rounded-md bg-cyan-400 px-4 font-bold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-60"
        disabled={disabled}
        type="submit"
      >
        Bilgilerimi kaydet
      </button>
    </form>
  );
}

function CoachPanel({
  coachCode,
  connections,
  disabled,
  onCoachCodeChange,
  onSubmit,
}: {
  coachCode: string;
  connections: CoachConnection[];
  disabled: boolean;
  onCoachCodeChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const approved = connections.find((item) => item.durum === "onaylandi");
  const coach = approved ? relationOne(approved.profiles) : null;

  return (
    <div className="mt-4">
      {coach ? (
        <div className="rounded-md bg-emerald-300/10 p-4 text-emerald-100">
          <p className="font-bold">{coach.ad_soyad || "Hoca"}</p>
          <p className="mt-1 text-sm">{coach.email || ""}</p>
        </div>
      ) : (
        <Empty text="Henuz onaylanmis hoca baglantiniz yok." />
      )}
      <form className="mt-5 grid gap-3" onSubmit={onSubmit}>
        <Field label="Hoca kodu" name="hoca_kodu" onChange={onCoachCodeChange} placeholder="HCA-ABC123" value={coachCode} />
        <button
          className="h-11 rounded-md bg-cyan-400 px-4 font-bold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-60"
          disabled={disabled || !coachCode.trim()}
          type="submit"
        >
          Istek gonder
        </button>
      </form>
      {connections.filter((item) => item.durum === "bekliyor").length ? (
        <p className="mt-4 text-sm text-amber-100">Bekleyen hoca isteginiz var.</p>
      ) : null}
    </div>
  );
}

function Field({
  label,
  name,
  onChange,
  placeholder,
  readOnly,
  required,
  step,
  type = "text",
  value,
}: {
  label: string;
  name: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  required?: boolean;
  step?: string;
  type?: string;
  value: string | number;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-200">{label}</span>
      <input
        className="mt-2 h-12 w-full rounded-md border border-white/10 bg-white px-3 text-slate-950 outline-none ring-cyan-300 focus:ring-2 disabled:bg-slate-200"
        defaultValue={onChange ? undefined : value}
        name={name}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        placeholder={placeholder}
        readOnly={readOnly}
        required={required}
        step={step}
        type={type}
        value={onChange ? value : undefined}
      />
    </label>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.05] p-5">
      <p className="text-sm text-slate-300">{label}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md bg-white/[0.06] p-4">
      <p className="text-sm text-slate-300">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}

function Panel({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <section className="mt-6 rounded-lg border border-white/10 bg-white/[0.05] p-5">
      <h2 className="text-xl font-bold">{title}</h2>
      {children}
    </section>
  );
}

function Status({ text }: { text: string }) {
  return (
    <p className="mb-4 rounded-md border border-cyan-300/30 bg-cyan-300/10 p-3 text-sm text-cyan-50">
      {text}
    </p>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="mt-4 text-sm text-slate-300">{text}</p>;
}

function sum(items: Training[], key: "toplam" | "dogru" | "hatali") {
  return items.reduce((total, item) => total + Number(item[key] || 0), 0);
}

function relationOne<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] || null : value || null;
}

function nullableString(value: FormDataEntryValue | null) {
  const text = String(value || "").trim();
  return text || null;
}

function nullableNumber(value: FormDataEntryValue | null) {
  const text = String(value || "").trim();
  return text ? Number(text) : null;
}

function mostCommon(values: string[]) {
  const counts = new Map<string, number>();
  values
    .filter((value) => !["Kayit yok", "Form hatasi tespit edilmedi", "None"].includes(value))
    .forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("tr-TR").format(new Date(value));
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
