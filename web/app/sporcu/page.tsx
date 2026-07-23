"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/DashboardLayout";
import { getSupabaseClient } from "@/lib/supabase/client";

type Tab = "ozet" | "kamera" | "program" | "sonuclar" | "bildirimler" | "profil";

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

declare global {
  interface Window {
    Pose?: new (options: {
      locateFile: (file: string) => string;
    }) => PoseDetector;
    lottie?: {
      loadAnimation: (options: {
        autoplay: boolean;
        container: HTMLElement;
        loop: boolean;
        path: string;
        renderer: "svg";
      }) => { destroy: () => void };
    };
  }
}

type PoseLandmark = {
  visibility?: number;
  x: number;
  y: number;
  z?: number;
};

type PoseDetector = {
  close: () => void;
  onResults: (callback: (results: { poseLandmarks?: PoseLandmark[] }) => void) => void;
  send: (input: { image: HTMLVideoElement }) => Promise<void>;
  setOptions: (options: {
    modelComplexity: number;
    minDetectionConfidence: number;
    minTrackingConfidence: number;
    selfieMode: boolean;
    smoothLandmarks: boolean;
  }) => void;
};

type RepPhase = "up" | "down" | "open" | "closed" | "left" | "right" | "center";

const tabs: Array<{ id: Tab; label: string }> = [
  { id: "ozet", label: "Ana Sayfa" },
  { id: "kamera", label: "Kamera" },
  { id: "program", label: "Program" },
  { id: "sonuclar", label: "Sonuçlar" },
  { id: "bildirimler", label: "Bildirimler" },
  { id: "profil", label: "Profil" },
];

const exercises = ["Squat", "Şınav", "Barfiks", "Aç-Kapa Zıplama", "Gövde Çevirme"];

const exerciseGuides: Record<
  string,
  {
    animation: "barfiks" | "jack" | "pushup" | "squat" | "twist";
    asset: { src: string; type: "json" | "mp4" };
    frames?: string[];
    image: string;
    steps: string[];
    voice: string;
  }
> = {
  Squat: {
    animation: "squat",
    asset: { src: "/exercises/videos/squat.json", type: "json" },
    image: "/exercises/simulasyon_squat.png",
    frames: ["/exercises/simulasyon_squat.png", "/exercises/3d_antrenor_squat.png"],
    steps: [
      "Başlangıçta ayaklarını omuz genişliğinde aç. Ayak uçların hafif dışa bakabilir, göğsün dik ve bakışın karşıya dönük olsun.",
      "Nefes alırken kalçanı geriye gönder. Sanki arkandaki sandalyeye oturuyormuş gibi kontrollü şekilde aşağı in.",
      "İnerken dizlerin içeri kapanmasın. Dizlerin ayak parmaklarınla aynı yöne baksın ve topukların yerde kalsın.",
      "En alt noktada gövdeni fazla öne düşürme. Karın kaslarını sık, belini doğal pozisyonda koru.",
      "Nefes vererek topuklarından güç al ve yukarı doğru kontrollü şekilde doğrul. Dizlerini kilitlemeden başlangıç pozisyonuna dön.",
    ],
    voice:
      "Squat için ayaklarını omuz genişliğinde aç. Kalçanı geriye gönder, dizlerini hizala, gövdeni dik tut ve topuklardan güç alarak yukarı doğrul.",
  },
  "Şınav": {
    animation: "pushup",
    asset: { src: "/exercises/videos/sinav.json", type: "json" },
    image: "/exercises/simulasyon_sinav.png",
    frames: ["/exercises/sinav_yukari.png", "/exercises/sinav_asagi.png"],
    steps: [
      "Başlangıçta ellerini omuz hizasına yerleştir. Omuz, kalça ve ayak bileklerin düz bir çizgi oluştursun.",
      "Karın ve kalça kaslarını sık. Belin aşağı düşmesin, kalçan da yukarı kalkmasın.",
      "Nefes alırken dirseklerini kontrollü şekilde bük. Göğsünü yere yaklaştır, ama omuzlarını kulaklarına sıkıştırma.",
      "Aşağı inerken gövden tek parça gibi hareket etsin. Başını öne uzatma, bakışın hafif ileri-aşağı olsun.",
      "Nefes vererek avuçlarından güç al ve yukarı it. Dirseklerini tamamen sert kilitlemeden başlangıç pozisyonuna dön.",
    ],
    voice:
      "Şınav için gövdeni düz tut. Karın kaslarını sık, dirseklerini kontrollü bükerek aşağı in ve avuçlarından güç alarak yukarı it.",
  },
  Barfiks: {
    animation: "barfiks",
    asset: { src: "/exercises/videos/barfiks.mp4", type: "mp4" },
    image: "/exercises/simulasyon_barfiks_yeni.png",
    frames: ["/exercises/barfiks_1.png", "/exercises/barfiks_2.png"],
    steps: [
      "Barı omuz genişliğinden biraz açık tut. Avuçların sağlam kavrasın ve vücudun barın altında dengede olsun.",
      "Harekete başlamadan önce omuzlarını aşağı al. Kürek kemiklerini hafifçe geriye ve aşağı çekerek gövdeni sabitle.",
      "Nefes verirken dirseklerini aşağı doğru çek. Kendini sadece kollarla değil, sırt kaslarınla yukarı taşı.",
      "Çenen bar hizasına yaklaştığında gövdeni sallama. Karın kaslarını sık ve bacaklarını kontrol altında tut.",
      "Nefes alarak yavaşça aşağı in. Kollarını bir anda bırakma, başlangıç pozisyonuna kontrollü dön.",
    ],
    voice:
      "Barfiks için barı sıkıca tut. Omuzlarını aşağı sabitle, sırt kaslarınla yukarı çek ve kontrollü şekilde geri in.",
  },
  "Aç-Kapa Zıplama": {
    animation: "jack",
    asset: { src: "/exercises/videos/ac-kapa-ziplama.json", type: "json" },
    image: "/exercises/simulasyon_jack.png",
    steps: [
      "Başlangıçta ayaklarını kapalı tut, kolların vücudunun yanında olsun. Gövden dik ve bakışın karşıya dönük kalsın.",
      "Zıplarken ayaklarını yana aç. Aynı anda kollarını kontrollü şekilde başının üstüne doğru kaldır.",
      "Yere inerken dizlerini yumuşak tut. Dizlerini sert kilitleme ve ağırlığını iki ayağına dengeli dağıt.",
      "Bir sonraki zıplamada ayaklarını tekrar kapat, kollarını yanlara indir. Hareketi ritimli ama kontrollü yap.",
      "Nefesini tutma. Tempo hızlansa bile gövdeni dik, omuzlarını rahat ve dizlerini yumuşak tutmaya devam et.",
    ],
    voice:
      "Aç kapa zıplamada ayaklar kapalı başla. Zıplarken açıl, kollarını yukarı kaldır, yumuşak iniş yap ve aynı ritimle kapan.",
  },
  "Gövde Çevirme": {
    animation: "twist",
    asset: { src: "/exercises/videos/govde-cevirme.mp4", type: "mp4" },
    image: "/exercises/simulasyon_twist.png",
    steps: [
      "Başlangıçta dizlerini hafif bük. Gövden dik olsun, karın kaslarını sık ve ellerini göğüs hizasında birleştir.",
      "Nefes verirken gövdeni kontrollü şekilde sağa çevir. Hareket belden kopuk değil, gövdeyle birlikte akıcı olsun.",
      "Merkeze geri gelirken acele etme. Omuzların ve göğsün tekrar karşıya baksın.",
      "Aynı tempoyla sola çevir. Kalçanı sabit tutmaya çalış, sadece belini zorlayarak dönme.",
      "Sağ ve sol dönüşlerde ritmi koru. Belinde ağrı hissedersen hareket mesafesini küçült ve daha kontrollü devam et.",
    ],
    voice:
      "Gövde çevirme için dik dur. Karın kaslarını sık, önce sağa dön, merkeze gel, sonra sola dön. Belini zorlamadan kontrollü devam et.",
  },
};
const correctionGuides: Record<string, string> = {
  squat: "Dizlerini içeri düşürme, kalçanı geriye al ve göğsünü dik tut.",
  pushup: "Belini çökertme, gövdeni düz tut ve dirseklerini kontrollü bük.",
  barfiks: "Omuzlarını kulaklarına sıkıştırma, kürek kemiklerini aşağı çek.",
  jack: "Dizlerini yumuşak tut, kollarını tam yukarı taşı ve ritmi koru.",
  twist: "Belini zorlamadan dön, gövdeni dik ve kontrollü tut.",
};

export default function SporcuPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("ozet");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [connections, setConnections] = useState<CoachConnection[]>([]);
  const [message, setMessage] = useState("Yükleniyor...");
  const [actionMessage, setActionMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [coachCode, setCoachCode] = useState("");
  const [selectedExercise, setSelectedExercise] = useState(exercises[0]);
  const [targetReps, setTargetReps] = useState(10);
  const [programTab, setProgramTab] = useState<"tamamlanan" | "tamamlanmayan" | "planlanan">("planlanan");
  const [trainingDate, setTrainingDate] = useState("");

  const totals = useMemo(() => {
    const toplam = sum(trainings, "toplam");
    const dogru = sum(trainings, "dogru");
    const hatali = sum(trainings, "hatali");
    return {
      toplam,
      dogru,
      hatali,
      puan: dogru * 2 - hatali,
    };
  }, [trainings]);

  const filteredTrainings = useMemo(
    () => filterTrainingsByDate(trainings, trainingDate),
    [trainingDate, trainings],
  );

  const filteredTotals = useMemo(() => {
    const toplam = sum(filteredTrainings, "toplam");
    const dogru = sum(filteredTrainings, "dogru");
    const hatali = sum(filteredTrainings, "hatali");
    const puan = dogru * 10 - hatali * 2;

    return { toplam, dogru, hatali, puan };
  }, [filteredTrainings]);

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
      setActionMessage("Program tamamlandı olarak işaretlendi.");
      await load();
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "Program güncellenemedi.");
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
      setActionMessage("Bildirim okundu olarak işaretlendi.");
      await load();
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "Bildirim güncellenemedi.");
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
      setActionMessage("Hoca isteği gönderildi.");
      await load();
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "Hoca isteği gönderilemedi.");
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
        setActionMessage("Ad soyad en az 2 karakter olmalı.");
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

  async function saveCameraTraining(result: {
    dogru: number;
    en_sik_form_hatasi?: string;
    hatali: number;
    hareket: string;
    sure_saniye: number;
    toplam: number;
  }) {
    if (!profile) return false;
    setIsSaving(true);
    setActionMessage("");
    try {
      const supabase = getSupabaseClient();
      const payload = {
        sporcu_id: profile.id,
        tarih: new Date().toISOString(),
        hareket: result.hareket,
        sure_saniye: result.sure_saniye,
        toplam: result.toplam,
        dogru: result.dogru,
        hatali: result.hatali,
        basari_yuzdesi: null,
        en_sik_form_hatasi:
          result.hatali > 0
            ? result.en_sik_form_hatasi || "Formu düzelt"
            : "Form hatası tespit edilmedi",
      };
      let { error } = await supabase.from("antrenmanlar").insert(payload);

      if (error) {
        if (error.message.toLowerCase().includes("en_sik_form_hatasi")) {
          const { error: fallbackError } = await supabase
            .from("antrenmanlar")
            .insert({
              sporcu_id: payload.sporcu_id,
              tarih: payload.tarih,
              hareket: payload.hareket,
              sure_saniye: payload.sure_saniye,
              toplam: payload.toplam,
              dogru: payload.dogru,
              hatali: payload.hatali,
              basari_yuzdesi: payload.basari_yuzdesi,
            });
          if (fallbackError) throw fallbackError;
        } else if (error.message.toLowerCase().includes("hareket")) {
          const asciiPayload = {
            ...payload,
            hareket: asciiExerciseName(payload.hareket),
          };
          const asciiResult = await supabase.from("antrenmanlar").insert(asciiPayload);
          error = asciiResult.error;
          if (error) throw error;
        } else {
          throw error;
        }
      }

      setActionMessage("Antrenman sonucu kaydedildi.");
      await load();
      return true;
    } catch (error) {
      setActionMessage(formatSupabaseSaveError(error));
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteTraining(trainingId: number) {
    if (!window.confirm("Bu antrenman sonucu silinsin mi?")) return;
    setIsSaving(true);
    setActionMessage("");
    try {
      const supabase = getSupabaseClient();
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Oturum bilgisi bulunamadi.");

      const response = await fetch("/api/sporcu/training", {
        body: JSON.stringify({ trainingId }),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        method: "DELETE",
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Antrenman silinemedi.");

      setTrainings((items) => items.filter((item) => item.id !== trainingId));
      setActionMessage("Antrenman sonucu silindi.");
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "Antrenman silinemedi.");
    } finally {
      setIsSaving(false);
    }
  }

  const pendingNotifications = notifications.filter((item) => !item.okundu).length;
  const activePrograms = programs.filter((item) => item.durum !== "tamamlandi");

  return (
    <DashboardLayout
      accent="cyan"
      sidebar={
        <div className="grid gap-2">
          {tabs.map((tab) => (
            <button
              className={`h-11 rounded-md px-4 text-left text-sm font-bold transition ${
                activeTab === tab.id
                  ? "bg-cyan-400 text-slate-950"
                  : "text-slate-300 hover:bg-white/10"
              }`}
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>
      }
      subtitle="Sporcu Paneli"
      title={`Merhaba ${profile?.ad_soyad || "Sporcu"}!`}
    >
      {message ? <Status text={message} /> : null}
      {actionMessage ? <Status text={actionMessage} /> : null}

      <div>
          <div className="grid gap-4 md:grid-cols-5">
            <Metric label="Antrenman" value={trainings.length} />
            <Metric label="Toplam tekrar" value={totals.toplam} />
            <Metric label="Doğru tekrar" value={totals.dogru} />
            <Metric label="Hatalı tekrar" value={totals.hatali} />
            <Metric label="Puan" value={totals.puan} />
          </div>

          <div className="mt-6">
          {activeTab === "ozet" && (
        <div className="grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
          <Panel title="Bugünkü">
            <div className="flex flex-wrap gap-3">
              <MiniStat label="Aktif program" value={activePrograms.length} />
              <MiniStat label="Okunmamış bildirim" value={pendingNotifications} />
              <MiniStat label="Son form" value={normalizeFormError(trainings[0]?.en_sik_form_hatasi) || "Kayıt yok"} />
            </div>
          </Panel>
          <Panel title="Son antrenmanlar">
            <TrainingList trainings={trainings.slice(0, 5)} />
          </Panel>
        </div>
          )}

          {activeTab === "kamera" && profile && (
        <CameraTraining
          disabled={isSaving}
          exercise={selectedExercise}
          exercises={exercises}
          onExerciseChange={setSelectedExercise}
          onSave={saveCameraTraining}
          onTargetChange={setTargetReps}
          target={targetReps}
        />
          )}

          {activeTab === "program" && (
        <Panel title="Programlarım">
          <ProgramTabs
            activeTab={programTab}
            disabled={isSaving}
            onComplete={completeProgram}
            onStart={(program) => {
              setSelectedExercise(program.hareket || exercises[0]);
              setTargetReps(program.hedef_tekrar || 10);
              setActiveTab("kamera");
            }}
            onTabChange={setProgramTab}
            programs={programs}
          />
        </Panel>
          )}

          {activeTab === "sonuclar" && (
        <Panel title="Antrenman sonuçlarım">
          <TrainingSummary
            disabled={isSaving}
            onDateChange={setTrainingDate}
            onDelete={deleteTraining}
            onResetDate={() => setTrainingDate("")}
            selectedDate={trainingDate}
            trainings={filteredTrainings}
            totals={filteredTotals}
          />
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
          <Panel title="Bağlı hocam">
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
          </div>
      </div>
    </DashboardLayout>
  );
}

function TrainingSummary({
  disabled,
  onDateChange,
  onDelete,
  onResetDate,
  selectedDate,
  trainings,
  totals,
}: {
  disabled: boolean;
  onDateChange: (value: string) => void;
  onDelete: (id: number) => void;
  onResetDate: () => void;
  selectedDate: string;
  trainings: Training[];
  totals: { toplam: number; dogru: number; hatali: number; puan: number };
}) {
  const mostCommonError = mostCommon(
    trainings.map((item) => normalizeFormError(item.en_sik_form_hatasi)).filter(Boolean) as string[],
  );

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        <MiniStat label="Toplam" value={totals.toplam} />
        <MiniStat label="Doğru" value={totals.dogru} />
        <MiniStat label="Hatalı" value={totals.hatali} />
      </div>
      <div
        className={`mt-4 rounded-md border p-3 text-sm ${
          mostCommonError
            ? "border-amber-300/30 bg-amber-300/10 text-amber-100"
            : "border-emerald-300/20 bg-emerald-300/10 text-emerald-100"
        }`}
      >
        <span className="font-bold">Form özeti:</span>{" "}
        {mostCommonError ? `En sık hata: ${mostCommonError}` : "Form hatası tespit edilmedi."}
      </div>
      <div className="mt-4 flex flex-wrap items-end gap-3 rounded-md border border-white/10 bg-white/[0.04] p-4">
        <label className="block w-full max-w-[220px]">
          <span className="text-sm font-semibold text-slate-200">Tarih seç</span>
          <input
            className="mt-2 h-11 w-full rounded-md border border-white/10 bg-white px-3 text-slate-950 outline-none ring-cyan-300 focus:ring-2"
            onChange={(event) => onDateChange(event.target.value)}
            type="date"
            value={selectedDate}
          />
        </label>
        <button
          className="h-11 self-end rounded-md border border-white/10 px-4 text-sm font-bold text-slate-100 transition hover:bg-white/10"
          onClick={onResetDate}
          type="button"
        >
          Temizle
        </button>
      </div>
      <TrainingList disabled={disabled} onDelete={onDelete} trainings={trainings} />
    </>
  );
}

function CameraTraining({
  disabled,
  exercise,
  exercises,
  onExerciseChange,
  onSave,
  onTargetChange,
  target,
}: {
  disabled: boolean;
  exercise: string;
  exercises: string[];
  onExerciseChange: (value: string) => void;
  onSave: (result: {
    dogru: number;
    en_sik_form_hatasi?: string;
    hatali: number;
    hareket: string;
    sure_saniye: number;
    toplam: number;
  }) => Promise<boolean>;
  onTargetChange: (value: number) => void;
  target: number;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const pausedElapsedRef = useRef(0);
  const isCameraClosingRef = useRef(false);
  const guideStepIndexRef = useRef(0);
  const guideStepTimerRef = useRef<number | null>(null);
  const poseRef = useRef<PoseDetector | null>(null);
  const poseFrameRef = useRef<number | null>(null);
  const poseRestartTimerRef = useRef<number | null>(null);
  const lastPoseFrameAtRef = useRef(0);
  const repPhaseRef = useRef<RepPhase>("up");
  const lastRepAtRef = useRef(0);
  const lowestSquatRef = useRef<FullBodyAnalysis | null>(null);
  const totalRef = useRef(0);
  const formErrorCountsRef = useRef<Map<string, number>>(new Map());
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isTraining, setIsTraining] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [cameraStatus, setCameraStatus] = useState("Kamera kapali.");
  const [formWarning, setFormWarning] = useState("");
  const [showPreparationHint, setShowPreparationHint] = useState(false);
  const [simulationMode, setSimulationMode] = useState<"correct" | "wrong">("correct");
  const [saveNotice, setSaveNotice] = useState("");
  const [cameraFacingMode, setCameraFacingMode] = useState<"user" | "environment">("user");
  const [isGuideSpeaking, setIsGuideSpeaking] = useState(false);
  const [isGuidePaused, setIsGuidePaused] = useState(false);

  const total = correct;
  const guide = exerciseGuides[exercise] || exerciseGuides.Squat;

  useEffect(() => {
    totalRef.current = total;
  }, [total]);

  useEffect(() => {
    if (!isTraining) return;
    const timer = window.setInterval(() => {
      if (startedAtRef.current) {
        setElapsed(getCurrentElapsed());
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isTraining]);

  useEffect(() => {
    return () => {
      stopGuideNarration();
      stopCameraStream(streamRef.current);
    };
  }, []);

  useEffect(() => {
    if (!formWarning || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const speech = new SpeechSynthesisUtterance(formWarning);
    speech.lang = "tr-TR";
    speech.rate = 0.9;
    speech.onstart = () => setIsGuideSpeaking(true);
    speech.onend = () => setIsGuideSpeaking(false);
    speech.onerror = () => setIsGuideSpeaking(false);
    window.speechSynthesis.speak(speech);
  }, [formWarning]);

  useEffect(() => {
    if (!isCameraOpen || !isTraining) {
      stopPoseAnalysis();
      return;
    }

    let disposed = false;
    let restartCount = 0;
    const originalAlert = window.alert;
    window.alert = (message?: unknown) => {
      const text = String(message || "");
      if (text.includes("Failed to create WebGL canvas context when passing video frame")) {
        return;
      }
      originalAlert(message);
    };

    async function startPoseAnalysis() {
      try {
        await loadScript("https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js");
        if (disposed || !window.Pose || !videoRef.current) return;

        const pose = new window.Pose({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
        });
        pose.setOptions({
          modelComplexity: 0,
          smoothLandmarks: true,
          minDetectionConfidence: 0.55,
          minTrackingConfidence: 0.55,
          selfieMode: cameraFacingMode === "user",
        });
        pose.onResults((results) => {
          if (disposed || !isTraining) return;
          handlePoseResults(results.poseLandmarks || []);
        });
        poseRef.current = pose;
        const analysisReadyAt = performance.now() + 900;

        const detect = async () => {
          if (disposed || !poseRef.current || !videoRef.current) return;
          const video = videoRef.current;
          const now = performance.now();
          if (
            now < analysisReadyAt ||
            video.videoWidth === 0 ||
            video.videoHeight === 0 ||
            now - lastPoseFrameAtRef.current < 180
          ) {
            poseFrameRef.current = window.requestAnimationFrame(detect);
            return;
          }
          lastPoseFrameAtRef.current = now;
          if (video.readyState >= 2 && !video.paused && !video.ended) {
            try {
              await poseRef.current.send({ image: video });
            } catch (error) {
              if (disposed) return;
              if (restartCount < 5) {
                restartCount += 1;
                setSimulationMode("correct");
                stopPoseAnalysis();
                poseRestartTimerRef.current = window.setTimeout(() => {
                  if (!disposed) void startPoseAnalysis();
                }, isRecoverablePoseError(error) ? 1000 : 1400);
                return;
              }
              setSimulationMode("correct");
              stopPoseAnalysis();
              return;
            }
          }
          poseFrameRef.current = window.requestAnimationFrame(detect);
        };
        detect();
      } catch {
        setSimulationMode("correct");
      }
    }

    startPoseAnalysis();

    return () => {
      disposed = true;
      window.alert = originalAlert;
      stopPoseAnalysis();
    };
  // Pose loop reads live counters from refs; restarting it for every callback
  // recreation would interrupt mobile camera analysis.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraFacingMode, exercise, isCameraOpen, isTraining, target]);

  async function openCamera() {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraStatus("Tarayıcı kamera erişimini desteklemiyor.");
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: cameraFacingMode },
          height: { ideal: 480 },
          width: { ideal: 640 },
        },
      });
      isCameraClosingRef.current = false;
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsCameraOpen(true);
    setCorrect(0);
    totalRef.current = 0;
    formErrorCountsRef.current.clear();
    setElapsed(0);
    pausedElapsedRef.current = 0;
    startedAtRef.current = null;
    guideStepIndexRef.current = 0;
    resetRepTracking();
    setSimulationMode("correct");
      setFormWarning("");
      setShowPreparationHint(true);
      setCameraStatus("Başlamadan önce canlı rehberdeki doğru yapılışı takip et.");
    } catch (error) {
      setCameraStatus(
        error instanceof Error
          ? `Kamera açılamadı: ${error.message}`
          : "Kamera açılamadı.",
      );
    }
  }

  function closeCamera() {
    isCameraClosingRef.current = true;
    setIsTraining(false);
    stopTraining();
    const videoStream = videoRef.current?.srcObject instanceof MediaStream ? videoRef.current.srcObject : null;
    stopCameraStream(videoStream);
    stopCameraStream(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
      videoRef.current.load();
    }
    setIsCameraOpen(false);
    setCorrect(0);
    totalRef.current = 0;
    formErrorCountsRef.current.clear();
    setElapsed(0);
    pausedElapsedRef.current = 0;
    startedAtRef.current = null;
    setFormWarning("");
    setShowPreparationHint(false);
    guideStepIndexRef.current = 0;
    resetRepTracking();
    setSimulationMode("correct");
    setCameraStatus("Kamera kapatıldı.");
  }

  function getCurrentElapsed() {
    if (!startedAtRef.current) return pausedElapsedRef.current;
    return pausedElapsedRef.current + Math.floor((Date.now() - startedAtRef.current) / 1000);
  }

  function startTraining() {
    const isResuming = pausedElapsedRef.current > 0 || elapsed > 0;
    if (!isResuming) {
      setCorrect(0);
      totalRef.current = 0;
      formErrorCountsRef.current.clear();
      setElapsed(0);
      pausedElapsedRef.current = 0;
    }
    setFormWarning("");
    setShowPreparationHint(false);
    setSimulationMode("correct");
    setSaveNotice("");
    if (!isResuming) {
      guideStepIndexRef.current = 0;
      resetRepTracking();
    }
    startedAtRef.current = Date.now();
    setIsTraining(true);
    setCameraStatus("Antrenman başladı. Kamera hareketini takip ediyor.");
    speakGuideSteps(isResuming ? guideStepIndexRef.current : 0);
  }

  function stopTraining() {
    pausedElapsedRef.current = getCurrentElapsed();
    setElapsed(pausedElapsedRef.current);
    setIsTraining(false);
    startedAtRef.current = null;
    stopGuideNarration();
    stopPoseAnalysis();
  }

  function stopGuideNarration() {
    if (guideStepTimerRef.current) {
      window.clearTimeout(guideStepTimerRef.current);
      guideStepTimerRef.current = null;
    }

    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsGuideSpeaking(false);
    setIsGuidePaused(false);
  }

  function pauseGuideNarration() {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.pause();
    setIsGuideSpeaking(false);
    setIsGuidePaused(true);
  }

  function speakGuideSteps(startStepIndex = 0) {
    if (!("speechSynthesis" in window)) {
      setCameraStatus("Tarayıcı sesli anlatımı desteklemiyor.");
      return;
    }

    stopGuideNarration();
    const rate = {
      barfiks: 0.84,
      jack: 0.9,
      pushup: 0.84,
      squat: 0.84,
      twist: 0.82,
    }[guide.animation];
    const speakStep = (index: number) => {
      const step = guide.steps[index];
      if (!step) {
        setIsGuideSpeaking(false);
        setIsGuidePaused(false);
        return;
      }
      guideStepIndexRef.current = index;
      const speech = new SpeechSynthesisUtterance(`${index + 1}. adım. ${step}`);
      speech.lang = "tr-TR";
      speech.rate = rate;
      speech.pitch = 1;
      speech.onstart = () => {
        setIsGuideSpeaking(true);
        setIsGuidePaused(false);
      };
      speech.onend = () => {
        guideStepIndexRef.current = Math.min(index + 1, guide.steps.length);
        guideStepTimerRef.current = window.setTimeout(() => speakStep(index + 1), 450);
      };
      speech.onerror = () => {
        setIsGuideSpeaking(false);
        setIsGuidePaused(false);
      };
      window.speechSynthesis.speak(speech);
    };
    speakStep(startStepIndex);
    setCameraStatus("Canlı rehber hareketi adım adım sesli anlatıyor.");
  }

  async function saveTraining() {
    const finalElapsed = getCurrentElapsed();
    setElapsed(finalElapsed);
    stopTraining();
    setCameraStatus("Sonuç kaydediliyor...");
    const saved = await onSave({
      dogru: correct,
      hatali: 0,
      hareket: exercise,
      en_sik_form_hatasi: getMostCommonFormError(),
      sure_saniye: finalElapsed,
      toplam: total,
    });
    if (saved) {
      const videoStream = videoRef.current?.srcObject instanceof MediaStream ? videoRef.current.srcObject : null;
      stopCameraStream(videoStream);
      stopCameraStream(streamRef.current);
      streamRef.current = null;
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
        videoRef.current.load();
      }
      setIsCameraOpen(false);
      setCorrect(0);
      totalRef.current = 0;
      formErrorCountsRef.current.clear();
      setElapsed(0);
      pausedElapsedRef.current = 0;
      startedAtRef.current = null;
      setSaveNotice("Sonuç kaydedildi");
      setCameraStatus("Sonuç kaydedildi.");
      window.setTimeout(() => setSaveNotice(""), 3500);
    } else {
      setSaveNotice("");
      setCameraStatus("Kayıt tamamlanamadı. Üstteki hata mesajını kontrol et.");
    }
  }

  function speakGuide() {
    if ("speechSynthesis" in window && isGuidePaused) {
      window.speechSynthesis.resume();
      setIsGuideSpeaking(true);
      setIsGuidePaused(false);
      setCameraStatus("Sesli anlatım kaldığı yerden devam ediyor.");
      return;
    }

    const nextStep = guideStepIndexRef.current >= guide.steps.length ? 0 : guideStepIndexRef.current;
    speakGuideSteps(nextStep);
  }

  function finishGuideNarration() {
    stopGuideNarration();
    guideStepIndexRef.current = 0;
    setCameraStatus("Sesli anlatım bitirildi.");
  }

  function stopPoseAnalysis() {
    if (poseFrameRef.current) {
      window.cancelAnimationFrame(poseFrameRef.current);
      poseFrameRef.current = null;
    }
    if (poseRestartTimerRef.current) {
      window.clearTimeout(poseRestartTimerRef.current);
      poseRestartTimerRef.current = null;
    }
    poseRef.current?.close();
    poseRef.current = null;
  }

  function resetRepTracking() {
    repPhaseRef.current = guide.animation === "jack" ? "closed" : guide.animation === "twist" ? "center" : "up";
    lastRepAtRef.current = 0;
    lowestSquatRef.current = null;
  }

  function trackFormError(warning: string) {
    const text = normalizeFormError(warning || "Formu düzelt");
    if (!text || text === "Form hatası tespit edilmedi") return;
    formErrorCountsRef.current.set(text, (formErrorCountsRef.current.get(text) || 0) + 1);
  }

  function getMostCommonFormError() {
    return [...formErrorCountsRef.current.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
  }

  function countWrongAttempt(warning: string) {
    trackFormError(warning);
  }

  function handlePoseResults(landmarks: PoseLandmark[]) {
    if (!isTraining || totalRef.current >= target) return;
    const result = analyzeExercisePose(guide.animation, landmarks, repPhaseRef.current, lowestSquatRef.current);
    if (result.phase) repPhaseRef.current = result.phase;
    if (result.lowestSquat !== undefined) lowestSquatRef.current = result.lowestSquat;

    if (!result.completed) {
      if (result.warning) {
        setFormWarning(result.warning);
        setCameraStatus(result.warning);
        setSimulationMode("wrong");
      }
      return;
    }

    const now = Date.now();
    if (now - lastRepAtRef.current < 900) return;
    lastRepAtRef.current = now;

    if (result.correct) {
      setCorrect((value) => {
        if (value >= target) return value;
        totalRef.current += 1;
        return value + 1;
      });
      setFormWarning("");
      setCameraStatus("Dogru tekrar sayildi.");
      setSimulationMode("correct");
    } else {
      const warning = result.warning || "Formu düzelt";
      countWrongAttempt(warning);
      setFormWarning(warning);
      setCameraStatus(warning);
      setSimulationMode("wrong");
    }
  }

  return (
    <section className="grid gap-4 xl:grid-cols-[1fr_390px]">
      <div>
        <div className="mb-4 grid gap-3 rounded-lg border border-white/10 bg-white/[0.05] p-4 md:grid-cols-[1fr_180px_210px]">
          <label className="block">
            <span className="text-sm font-semibold text-slate-200">Hareket</span>
            <select
              className="mt-2 h-12 w-full rounded-md border border-white/10 bg-white px-3 text-slate-950 outline-none ring-cyan-300 focus:ring-2"
              onChange={(event) => {
                setFormWarning("");
                setSimulationMode("correct");
                onExerciseChange(event.target.value);
              }}
              value={exercise}
            >
              {exercises.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-slate-200">Hedef tekrar</span>
            <input
              className="mt-2 h-12 w-full rounded-md border border-white/10 bg-white px-3 text-slate-950 outline-none ring-cyan-300 focus:ring-2"
              min={1}
              onChange={(event) => onTargetChange(Number(event.target.value) || 1)}
              type="number"
              value={target}
            />
          </label>

          <label className="block">
            <span className="text-sm font-semibold text-slate-200">Kamera yönü</span>
            <select
              className="mt-2 h-12 w-full rounded-md border border-white/10 bg-white px-3 text-slate-950 outline-none ring-cyan-300 focus:ring-2 disabled:opacity-70"
              disabled={isCameraOpen}
              onChange={(event) => setCameraFacingMode(event.target.value as "user" | "environment")}
              value={cameraFacingMode}
            >
              <option value="user">Ön kamera</option>
              <option value="environment">Arka kamera</option>
            </select>
          </label>
        </div>

      <div className="overflow-hidden rounded-lg border border-white/10 bg-black">
        <div className="relative aspect-video w-full">
          <video
            className="size-full object-cover"
            muted
            playsInline
            ref={videoRef}
          />
          {!isCameraOpen ? (
            <div className="absolute inset-0 grid place-items-center bg-slate-950 text-center">
              <div>
                <p className="text-lg font-bold">Kamera bekleniyor</p>
                <p className="mt-2 text-sm text-slate-300">Başlatmak için kamera izni ver.</p>
              </div>
            </div>
          ) : null}
          <div className="absolute left-4 top-4 w-[min(19rem,calc(100%-2rem))] rounded-lg border border-white/10 bg-slate-950/85 p-2.5 text-white shadow-xl backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-cyan-200">Sayaç</p>
              <span className="rounded-md bg-white/10 px-2 py-1 text-[10px] font-bold">
                {isTraining ? "Antrenman aktif" : "Hazır"}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              <CounterBox label="Toplam" value={total} />
              <CounterBox label="Doğru" value={correct} />
            </div>
            {showPreparationHint ? (
              <div className="mt-2 rounded-md border border-cyan-300/30 bg-slate-900/80 p-2.5">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-cyan-200">
                  Hazırlık
                </p>
                <p className="mt-1.5 text-xs leading-5">
                  Başlamadan önce canlı rehberdeki doğru duruşu al.
                </p>
              </div>
            ) : null}
            {formWarning ? (
              <div className="mt-2 rounded-md border border-rose-300/50 bg-rose-950/90 p-2.5">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-rose-200">
                  Duzelt
                </p>
                <p className="mt-1.5 text-xs font-bold leading-5">
                  Doğru yapılışı canlı rehberde takip et.
                </p>
                <p className="mt-1 text-xs leading-5">{formWarning}</p>
              </div>
            ) : null}
          </div>
          <div className="absolute bottom-4 left-4 flex flex-wrap gap-2">
            {!isCameraOpen ? (
              <button
                className="h-10 rounded-md bg-cyan-400 px-4 text-sm font-bold text-slate-950 shadow-xl transition hover:bg-cyan-300"
                onClick={openCamera}
                type="button"
              >
                Kamerayı aç
              </button>
            ) : (
              <button
                className="h-10 rounded-md border border-white/20 bg-slate-950/85 px-4 text-sm font-bold text-slate-100 shadow-xl transition hover:bg-white/10"
                onClick={closeCamera}
                type="button"
              >
                Kamerayı kapat
              </button>
            )}
          </div>
          {saveNotice ? (
            <div className="absolute bottom-4 right-4 max-w-sm rounded-lg border border-emerald-300/50 bg-emerald-950/90 p-4 text-white shadow-2xl">
              <p className="text-sm font-black uppercase tracking-[0.16em] text-emerald-200">
                Kayıt tamam
              </p>
              <p className="mt-2 text-lg font-bold">{saveNotice}</p>
            </div>
          ) : null}
        </div>
      </div>

        <div className="mt-4 rounded-md border border-cyan-300/20 bg-cyan-300/10 p-3">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-200">
            Bilgi
          </p>
          <p className="mt-2 text-sm font-semibold leading-6 text-cyan-50">{cameraStatus}</p>
          <div className="mt-3 grid gap-2 text-sm text-cyan-50 sm:grid-cols-4">
            <div className="flex items-center gap-2">
              <span className="text-cyan-100/80">Kamera</span>
              <span className="font-bold">{isCameraOpen ? "Açık" : "Kapalı"}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-cyan-100/80">Durum</span>
              <span className="font-bold">{isTraining ? "Aktif" : "Hazır"}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-cyan-100/80">Hareket</span>
              <span className="truncate font-bold">{exercise}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-cyan-100/80">Yön</span>
              <span className="font-bold">
                {cameraFacingMode === "user" ? "Ön" : "Arka"}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          <MiniStat label="Süre" value={`${elapsed} sn`} />
          <MiniStat label="Hedef" value={`${total}/${target}`} />
          <MiniStat label="Doğru" value={correct} />
        </div>
        <p className="mt-3 text-xs leading-5 text-slate-400">
          Telefon veya bilgisayar kamerasi ile hareket formu tarayicida analiz edilir.
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          {!isTraining ? (
            <button
              className="h-11 rounded-md bg-cyan-400 px-4 font-bold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-60"
              disabled={!isCameraOpen}
              onClick={startTraining}
              type="button"
            >
              {elapsed > 0 ? "Devam et" : "Antrenmanı başlat"}
            </button>
          ) : (
            <button
              className="h-11 rounded-md border border-cyan-300/40 px-4 font-bold text-cyan-100 transition hover:bg-cyan-300/10"
              onClick={stopTraining}
              type="button"
            >
              Duraklat
            </button>
          )}

          <button
            className="h-11 rounded-md bg-emerald-400 px-4 font-bold text-emerald-950 transition hover:bg-emerald-300 disabled:opacity-60"
            disabled={disabled}
            onClick={saveTraining}
            type="button"
          >
            Sonucu kaydet
          </button>
          <button
            className="h-11 rounded-md border border-rose-300/50 px-4 font-bold text-rose-100 transition hover:bg-rose-300/10 disabled:opacity-50"
            disabled={!isCameraOpen}
            onClick={closeCamera}
            type="button"
          >
            Kamerayı kapat
          </button>
        </div>
      </div>

      <aside className="rounded-lg border border-white/10 bg-white/[0.05] p-5">
        <div className="overflow-hidden rounded-lg border border-cyan-300/20 bg-slate-950 shadow-2xl">
          <ExerciseGuideVideo
            correction={correctionGuides[guide.animation]}
            exercise={exercise}
            guide={guide}
            key={exercise}
            warning={Boolean(formWarning) || simulationMode === "wrong"}
          />
        </div>
        <div className="mt-3 grid gap-2">
          <button
            className={`h-10 rounded-md text-sm font-bold transition ${
              simulationMode === "correct"
                ? "bg-cyan-400 text-slate-950"
                : "border border-white/10 text-slate-200 hover:bg-white/10"
            }`}
            onClick={() => {
              setSimulationMode("correct");
              setFormWarning("");
            }}
            type="button"
          >
            Doğru form
          </button>
        </div>
        {formWarning ? (
          <div className="mt-3 rounded-md border border-rose-300/40 bg-rose-300/10 p-3 text-sm leading-6 text-rose-100">
            {formWarning}
          </div>
        ) : null}

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <button
            className="h-10 rounded-md border border-cyan-300/40 px-4 text-sm font-bold text-cyan-100 transition hover:bg-cyan-300/10"
            onClick={speakGuide}
            type="button"
          >
            Sesli anlat
          </button>
          <button
            className="h-10 rounded-md border border-rose-300/40 px-4 text-sm font-bold text-rose-100 transition hover:bg-rose-300/10 disabled:opacity-50"
            disabled={!isGuideSpeaking}
            onClick={pauseGuideNarration}
            type="button"
          >
            Durdur
          </button>
          <button
            className="h-10 rounded-md border border-white/10 px-4 text-sm font-bold text-slate-100 transition hover:bg-white/10"
            onClick={finishGuideNarration}
            type="button"
          >
            Bitir
          </button>
        </div>

        <div className="mt-4 rounded-md bg-white/[0.06] p-4">
          <p className="text-sm font-bold text-slate-100">Hareket rehberi</p>
          <ol className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
            {guide.steps.map((step, index) => (
              <li className="flex gap-2" key={step}>
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-cyan-400 text-xs font-black text-slate-950">
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>

      </aside>
    </section>
  );
}

function ProgramTabs({
  activeTab,
  disabled,
  onComplete,
  onStart,
  onTabChange,
  programs,
}: {
  activeTab: "tamamlanan" | "tamamlanmayan" | "planlanan";
  disabled: boolean;
  onComplete: (id: number) => void;
  onStart: (program: Program) => void;
  onTabChange: (tab: "tamamlanan" | "tamamlanmayan" | "planlanan") => void;
  programs: Program[];
}) {
  const completedPrograms = programs.filter((program) => program.durum === "tamamlandi");
  const missedPrograms = programs.filter((program) => {
    const endDate = program.bitis_tarihi || program.tarih;
    return program.durum !== "tamamlandi" && Boolean(endDate) && new Date(`${endDate}T23:59:59`) < new Date();
  });
  const plannedPrograms = programs.filter(
    (program) => program.durum !== "tamamlandi" && !missedPrograms.includes(program),
  );
  const tabs: Array<{
    count: number;
    id: "tamamlanan" | "tamamlanmayan" | "planlanan";
    label: string;
  }> = [
    { id: "tamamlanan", label: "Tamamlananlar", count: completedPrograms.length },
    { id: "tamamlanmayan", label: "Tamamlanmayanlar", count: missedPrograms.length },
    { id: "planlanan", label: "Planlananlar", count: plannedPrograms.length },
  ];
  const visiblePrograms = {
    tamamlanan: completedPrograms,
    tamamlanmayan: missedPrograms,
    planlanan: plannedPrograms,
  }[activeTab];

  return (
    <>
      <div className="mt-4 grid gap-2">
        {tabs.map((tab) => (
          <button
            className={`flex min-h-12 items-center justify-between rounded-md px-4 text-left text-sm font-bold transition ${
              activeTab === tab.id
                ? "bg-cyan-400 text-slate-950"
                : "bg-white/[0.06] text-slate-200 hover:bg-white/10"
            }`}
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            type="button"
          >
            <span>{tab.label}</span>
            <span className="rounded-md bg-slate-950/15 px-2 py-1 text-xs">{tab.count}</span>
          </button>
        ))}
      </div>

      {visiblePrograms.length ? (
        <ProgramList
          disabled={disabled}
          onComplete={onComplete}
          onStart={onStart}
          programs={visiblePrograms}
        />
      ) : (
        <Empty
          text={
            activeTab === "tamamlanan"
              ? "Tamamlanan program bulunmuyor."
              : activeTab === "tamamlanmayan"
                ? "Tamamlanmayan program bulunmuyor."
                : "Planlanan program bulunmuyor."
          }
        />
      )}
    </>
  );
}

function TrainingList({
  disabled = false,
  onDelete,
  trainings,
}: {
  disabled?: boolean;
  onDelete?: (id: number) => void;
  trainings: Training[];
}) {
  if (!trainings.length) return <Empty text="Henüz antrenman kaydı yok." />;

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[840px] border-separate border-spacing-y-2 text-left text-sm">
        <thead className="text-slate-300">
          <tr>
            <th className="px-3 py-2">Tarih</th>
            <th className="px-3 py-2">Hareket</th>
            <th className="px-3 py-2">Süre</th>
            <th className="px-3 py-2">Toplam</th>
            <th className="px-3 py-2">Doğru</th>
            <th className="px-3 py-2">Hatalı</th>
            {onDelete ? <th className="px-3 py-2">İşlem</th> : null}
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
              <td className={onDelete ? "px-3 py-3 text-rose-200" : "rounded-r-md px-3 py-3 text-rose-200"}>
                {training.hatali || 0}
              </td>
              {onDelete ? (
                <td className="rounded-r-md px-3 py-3">
                  <button
                    className="h-9 rounded-md border border-rose-300/40 px-3 text-xs font-bold text-rose-100 transition hover:bg-rose-300/10 disabled:opacity-60"
                    disabled={disabled}
                    onClick={() => onDelete(training.id)}
                    type="button"
                  >
                    Sil
                  </button>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ExerciseGuideVideo({
  correction,
  exercise,
  guide,
  warning,
}: {
  correction: string;
  exercise: string;
  guide: (typeof exerciseGuides)[string];
  warning: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lottieRef = useRef<HTMLDivElement | null>(null);
  const [fallbackAssetSrc, setFallbackAssetSrc] = useState("");
  const useFallbackGuide = fallbackAssetSrc === guide.asset.src;

  useEffect(() => {
    if (guide.asset.type !== "json" || useFallbackGuide) return;

    let animation: { destroy: () => void } | null = null;
    let disposed = false;
    let retryTimer = 0;

    const startAnimation = () => {
      if (disposed) return;
      if (!lottieRef.current) {
        retryTimer = window.setTimeout(startAnimation, 50);
        return;
      }

      loadScript("https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie.min.js")
        .then(() => {
          if (disposed || !window.lottie || !lottieRef.current) return;
          lottieRef.current.innerHTML = "";
          animation?.destroy();
          animation = window.lottie.loadAnimation({
            autoplay: true,
            container: lottieRef.current,
            loop: true,
            path: guide.asset.src,
            renderer: "svg",
          });
        })
        .catch(() => setFallbackAssetSrc(guide.asset.src));
    };

    startAnimation();

    return () => {
      disposed = true;
      window.clearTimeout(retryTimer);
      animation?.destroy();
    };
  }, [guide.asset.src, guide.asset.type, useFallbackGuide]);

  useEffect(() => {
    if (!useFallbackGuide) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const canvasElement = canvas;
    const ctx = context;
    let animationFrame = 0;
    let disposed = false;
    function point(x: number, y: number) {
      return { x, y };
    }

    function drawLimb(from: { x: number; y: number }, to: { x: number; y: number }, width = 18, color = "#dbeafe") {
      const limbWidth = Math.max(width, 24);
      ctx.strokeStyle = "rgba(15, 23, 42, .35)";
      ctx.lineWidth = limbWidth + 8;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(from.x + 3, from.y + 4);
      ctx.lineTo(to.x + 3, to.y + 4);
      ctx.stroke();
      ctx.strokeStyle = color;
      ctx.lineWidth = limbWidth;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    }

    function drawJoint(at: { x: number; y: number }, radius = 8, color = "#38bdf8") {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(at.x, at.y, Math.max(radius, 11), 0, Math.PI * 2);
      ctx.fill();
    }

    function drawHead(at: { x: number; y: number }, color = "#f8fafc") {
      ctx.fillStyle = "rgba(15, 23, 42, .35)";
      ctx.beginPath();
      ctx.ellipse(at.x + 4, at.y + 5, 25, 29, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(at.x, at.y, 24, 28, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(15, 23, 42, .28)";
      ctx.fillRect(at.x - 12, at.y - 2, 24, 4);
    }

    function drawTorso(shoulder: { x: number; y: number }, hip: { x: number; y: number }, color = "#bae6fd") {
      const angle = Math.atan2(hip.y - shoulder.y, hip.x - shoulder.x);
      const length = Math.hypot(hip.x - shoulder.x, hip.y - shoulder.y);
      ctx.save();
      ctx.translate((shoulder.x + hip.x) / 2, (shoulder.y + hip.y) / 2);
      ctx.rotate(angle + Math.PI / 2);
      ctx.fillStyle = "rgba(15, 23, 42, .35)";
      ctx.beginPath();
      ctx.roundRect(-36, -length / 2 + 5, 72, length, 24);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(-32, -length / 2, 64, length, 24);
      ctx.fill();
      ctx.restore();
    }

    function drawGuideLine(from: { x: number; y: number }, to: { x: number; y: number }, label: string) {
      ctx.strokeStyle = warning ? "rgba(251, 113, 133, .85)" : "rgba(34, 211, 238, .85)";
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = warning ? "#ffe4e6" : "#cffafe";
      ctx.font = "700 12px Arial";
      ctx.fillText(label, to.x + 8, to.y - 6);
    }

    function drawPhaseLabel(text: string) {
      ctx.fillStyle = "rgba(15, 23, 42, .78)";
      ctx.fillRect(18, canvasElement.height - 92, 150, 34);
      ctx.fillStyle = "#e0f2fe";
      ctx.font = "800 13px Arial";
      ctx.fillText(text, 30, canvasElement.height - 70);
    }

    function drawPerson(time: number, phase: number) {
      const cx = canvasElement.width / 2;
      const base = canvasElement.height - 58;
      const limbColor = "#f8fafc";
      const torsoColor = "#7dd3fc";
      const accent = warning ? "#fb7185" : "#38bdf8";
      const errorShift = 0;

      if (guide.animation === "pushup") {
        const y = base - 38 + phase * 42;
        const shoulder = point(cx - 78, y);
        const hip = point(cx + 40, y + 4);
        const ankle = point(cx + 132, y + 18);
        const elbow = point(cx - 96, y + 42);
        const wrist = point(cx - 116, base);
        drawTorso(shoulder, hip, torsoColor);
        drawLimb(hip, ankle, 18, limbColor);
        drawLimb(shoulder, elbow, 16, limbColor);
        drawLimb(elbow, wrist, 15, limbColor);
        drawLimb(point(cx - 48, y + 4), point(cx - 24, base), 14, limbColor);
        drawHead(point(cx - 112, y - 28));
        drawJoint(shoulder, 8, accent);
        drawJoint(hip, 8, warning ? "#fb7185" : accent);
        drawGuideLine(shoulder, hip, "düz gövde");
        drawPhaseLabel(phase > 0.55 ? "Aşağı in" : "Yukarı it");
        return;
      }

      if (guide.animation === "barfiks") {
        const pull = phase * 56;
        const shoulder = point(cx + errorShift, 166 - pull);
        const hip = point(cx + errorShift, 238 - pull);
        ctx.strokeStyle = "#94a3b8";
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.moveTo(cx - 130, 62);
        ctx.lineTo(cx + 130, 62);
        ctx.stroke();
        drawTorso(shoulder, hip, torsoColor);
        drawLimb(shoulder, point(cx - 70, 62), 15, limbColor);
        drawLimb(shoulder, point(cx + 70, 62), 15, limbColor);
        drawLimb(hip, point(cx - 36, base), 16, limbColor);
        drawLimb(hip, point(cx + 36, base), 16, limbColor);
        drawHead(point(cx + errorShift, 122 - pull));
        drawJoint(shoulder, 8, warning ? "#fb7185" : accent);
        drawGuideLine(shoulder, point(cx, 62), "bar hizası");
        drawPhaseLabel(phase > 0.5 ? "Yukarı çek" : "Kontrollü in");
        return;
      }

      if (guide.animation === "jack") {
        const shoulder = point(cx, 142);
        const hip = point(cx, 230);
        drawTorso(shoulder, hip, torsoColor);
        drawLimb(shoulder, point(cx - 38 - phase * 52, 176 - phase * 102), 15, limbColor);
        drawLimb(shoulder, point(cx + 38 + phase * 52, 176 - phase * 102), 15, limbColor);
        drawLimb(hip, point(cx - 22 - phase * 58, base), 17, limbColor);
        drawLimb(hip, point(cx + 22 + phase * 58, base), 17, limbColor);
        drawHead(point(cx, 102));
        drawPhaseLabel(phase > 0.5 ? "Aç" : "Kapan");
        return;
      }

      if (guide.animation === "twist") {
        const twist = Math.sin(time / 260);
        const shoulder = point(cx + twist * 34 + errorShift, 152);
        const hip = point(cx, 236);
        drawTorso(shoulder, hip, torsoColor);
        drawLimb(shoulder, point(cx - 78 + twist * 28, 182), 15, limbColor);
        drawLimb(shoulder, point(cx + 78 + twist * 28, 182), 15, limbColor);
        drawLimb(hip, point(cx - 54, base), 17, limbColor);
        drawLimb(hip, point(cx + 54, base), 17, limbColor);
        drawHead(point(cx + twist * 42 + errorShift, 112));
        drawJoint(shoulder, 8, warning ? "#fb7185" : accent);
        drawGuideLine(point(cx, 236), shoulder, "kontrollü dönüş");
        drawPhaseLabel(twist > 0 ? "Sağa çevir" : "Sola çevir");
        return;
      }

      const squatDepth = phase * 78;
      const shoulder = point(cx + errorShift, 126 + squatDepth * 0.42);
      const hip = point(cx + errorShift, 214 + squatDepth);
      const kneeLeft = point(cx - 58, 266 + squatDepth * 0.34);
      const kneeRight = point(cx + 58, 266 + squatDepth * 0.34);
      drawTorso(shoulder, hip, torsoColor);
      drawLimb(shoulder, point(cx - 70, 186 + squatDepth * 0.34), 15, limbColor);
      drawLimb(shoulder, point(cx + 70, 186 + squatDepth * 0.34), 15, limbColor);
      drawLimb(hip, kneeLeft, 18, limbColor);
      drawLimb(kneeLeft, point(cx - 90, base), 17, limbColor);
      drawLimb(hip, kneeRight, 18, limbColor);
      drawLimb(kneeRight, point(cx + 90, base), 17, limbColor);
      drawHead(point(cx + errorShift, 88 + squatDepth * 0.3));
      drawJoint(kneeLeft, 8, warning ? "#fb7185" : accent);
      drawJoint(kneeRight, 8, warning ? "#fb7185" : accent);
      drawGuideLine(kneeLeft, point(cx - 90, base), "diz ayak hizası");
      drawGuideLine(kneeRight, point(cx + 90, base), "diz ayak hizası");
      drawPhaseLabel(phase > 0.55 ? "Aşağı kontrollü" : "Yukarı doğrul");
    }

    function render(time: number) {
      if (disposed) return;
      const phase = (Math.sin(time / 360) + 1) / 2;
      ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
      const gradient = ctx.createLinearGradient(0, 0, canvasElement.width, canvasElement.height);
      gradient.addColorStop(0, "#020617");
      gradient.addColorStop(1, "#083344");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvasElement.width, canvasElement.height);
      ctx.fillStyle = "rgba(15, 23, 42, .42)";
      ctx.fillRect(0, canvasElement.height * 0.66, canvasElement.width, canvasElement.height * 0.34);
      ctx.strokeStyle = "rgba(103, 232, 249, .18)";
      ctx.lineWidth = 1;
      for (let index = 0; index < 5; index += 1) {
        const y = canvasElement.height - 44 - index * 24;
        ctx.beginPath();
        ctx.moveTo(42 + index * 20, y);
        ctx.lineTo(canvasElement.width - 42 - index * 20, y);
        ctx.stroke();
      }
      ctx.strokeStyle = "rgba(103, 232, 249, .14)";
      [120, 200, 280, 360].forEach((x) => {
        ctx.beginPath();
        ctx.moveTo(canvasElement.width / 2, canvasElement.height * 0.66);
        ctx.lineTo(x, canvasElement.height - 42);
        ctx.stroke();
      });
      ctx.fillStyle = "rgba(103, 232, 249, .35)";
      ctx.fillRect(44, canvasElement.height - 48, canvasElement.width - 88, 4);

      ctx.fillStyle = "rgba(8, 47, 73, .72)";
      ctx.fillRect(18, 18, 164, 34);
      ctx.fillStyle = "#cffafe";
      ctx.font = "700 14px Arial";
      ctx.fillText(warning ? "Doğrusu bu" : "Canlı rehber", 30, 40);
      drawPerson(time, phase);


      ctx.fillStyle = "#67e8f9";
      ctx.font = "700 18px Arial";
      ctx.fillText(exercise, 18, canvasElement.height - 18);
      ctx.fillStyle = "rgba(103, 232, 249, .8)";
      ctx.fillRect(canvasElement.width - 44, 46 + phase * 110, 5, 62);

      if (warning) {
        ctx.strokeStyle = "#fb7185";
        ctx.lineWidth = 8;
        ctx.strokeRect(8, 8, canvasElement.width - 16, canvasElement.height - 16);
        ctx.fillStyle = "rgba(127, 29, 29, .9)";
        ctx.fillRect(18, 18, canvasElement.width - 36, 72);
        ctx.strokeStyle = "#fda4af";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(canvasElement.width / 2 - 54, 86);
        ctx.lineTo(canvasElement.width / 2 + 42, 118);
        ctx.stroke();
        ctx.fillStyle = "#ffe4e6";
        ctx.font = "900 24px Arial";
        ctx.fillText("Yanlış", 34, 45);
        ctx.font = "700 13px Arial";
        ctx.fillText("Doğru yapılışı canlı rehberde takip et.", 34, 68);
        ctx.font = "600 12px Arial";
        ctx.fillText(correction, 34, 84);
      }
      animationFrame = window.requestAnimationFrame(render);
    }

    animationFrame = window.requestAnimationFrame(render);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(animationFrame);
    };
  }, [correction, exercise, guide, useFallbackGuide, warning]);

  return (
    <div className="relative aspect-[4/3] h-[260px]">
      {!useFallbackGuide && guide.asset.type === "mp4" ? (
        <div className="grid size-full place-items-center bg-slate-950 p-5">
          <div className="h-full max-h-[220px] w-full max-w-[320px] border border-cyan-300/20 bg-white">
            <video
              aria-label={`${exercise} doğru form videosu`}
              autoPlay
              className="size-full object-contain"
              loop
              muted
              onError={() => setFallbackAssetSrc(guide.asset.src)}
              playsInline
              src={guide.asset.src}
            />
          </div>
        </div>
      ) : !useFallbackGuide ? (
        <div
          aria-label={`${exercise} doğru form animasyonu`}
          className="grid size-full place-items-center bg-slate-950 p-5 [&_svg]:h-full [&_svg]:max-h-[220px] [&_svg]:w-full [&_svg]:max-w-[320px]"
          ref={lottieRef}
          role="img"
        />
      ) : (
        <div className="grid size-full place-items-center bg-slate-950 p-5">
          <canvas
            aria-label={`${exercise} canlı hareket rehberi`}
            className="h-full max-h-[220px] w-full max-w-[320px]"
            height={360}
            ref={canvasRef}
            role="img"
            width={480}
          />
        </div>
      )}
      <div className="absolute right-3 top-3 flex items-center gap-2 rounded-md bg-slate-950/80 px-2 py-1 text-xs font-bold text-cyan-100">
        <span className="size-2 rounded-full bg-emerald-300" />
        {!useFallbackGuide && guide.asset.type === "mp4"
          ? "Doğru video"
          : !useFallbackGuide
            ? "Doğru animasyon"
            : warning
              ? "Doğru rehber"
              : "Canlı rehber"}
      </div>
    </div>
  );
}

type FullBodyAnalysis = {
  ankleWidth: number;
  elbow: number;
  hip: number;
  knee: number;
  kneeBalance: number;
  kneeWidth: number;
  shoulderWidth: number;
  torsoLean: number;
  visible: boolean;
  wristDistance: number;
  wristHipOffset: number;
  wristsAboveShoulders: boolean;
  wristsBelowShoulders: boolean;
};

type PoseAnalysisResult = {
  completed: boolean;
  correct: boolean;
  lowestSquat?: FullBodyAnalysis | null;
  phase?: RepPhase;
  warning?: string;
};

const poseIndexes = {
  leftAnkle: 27,
  leftElbow: 13,
  leftHip: 23,
  leftKnee: 25,
  leftShoulder: 11,
  leftWrist: 15,
  rightAnkle: 28,
  rightElbow: 14,
  rightHip: 24,
  rightKnee: 26,
  rightShoulder: 12,
  rightWrist: 16,
};

function analyzeExercisePose(
  animation: "barfiks" | "jack" | "pushup" | "squat" | "twist",
  landmarks: PoseLandmark[],
  phase: RepPhase,
  lowestSquat: FullBodyAnalysis | null,
): PoseAnalysisResult {
  const body = analyzeFullBody(landmarks, animation);
  if (!body.visible) {
    if (animation === "twist") {
      return { completed: false, correct: false, warning: "Ellerin, omuzlarin ve kalcan kamerada gorunsun." };
    }
    return { completed: false, correct: false, warning: "Vucudunu kameraya tam goster" };
  }

  if (animation === "squat") {
    const nextLowest = !lowestSquat || body.knee < lowestSquat.knee ? body : lowestSquat;
    if (body.knee < 148 && phase === "up") {
      return {
        completed: false,
        correct: false,
        lowestSquat: nextLowest,
        phase: "down",
        warning: getSquatLiveGuidance(body, "down"),
      };
    }
    const roseFromBottom = Boolean(nextLowest && body.knee - nextLowest.knee > 18);
    if (phase === "down" && (body.knee > 145 || roseFromBottom)) {
      const checked = checkSquatForm(nextLowest);
      return {
        completed: true,
        correct: checked.correct,
        lowestSquat: null,
        phase: "up",
        warning: checked.warning,
      };
    }
    return {
      completed: false,
      correct: false,
      lowestSquat: nextLowest,
      warning: getSquatLiveGuidance(body, phase),
    };
  }

  if (animation === "pushup") {
    if (body.elbow < 95 && phase === "up") {
      return { completed: false, correct: false, phase: "down", warning: "Simdi kontrollu sekilde yukari it" };
    }
    if (body.elbow > 150 && phase === "down") {
      const correct = body.hip > 145 && body.torsoLean < 0.85;
      return {
        completed: true,
        correct,
        phase: "up",
        warning: correct ? "" : "Belini duz tut",
      };
    }
    return { completed: false, correct: false, warning: getPushupLiveGuidance(body, phase) };
  }

  if (animation === "barfiks") {
    if (body.elbow < 80 && phase === "up") {
      const correct = body.elbow < 70;
      return {
        completed: true,
        correct,
        phase: "down",
        warning: correct ? "" : "Biraz daha yukari cik",
      };
    }
    if (body.elbow > 145) return { completed: false, correct: false, phase: "up", warning: "Simdi dirseklerini bukerek kendini yukari cek" };
    return { completed: false, correct: false, warning: getPullupLiveGuidance(body, phase) };
  }

  if (animation === "jack") {
    const open = body.wristsAboveShoulders && body.ankleWidth > body.shoulderWidth * 1.15;
    const closed = body.wristsBelowShoulders && body.ankleWidth < body.shoulderWidth * 0.85;
    if (open && phase === "closed") {
      return { completed: true, correct: true, phase: "open" };
    }
    if (closed) return { completed: false, correct: false, phase: "closed" };
    if (body.wristsAboveShoulders && body.ankleWidth <= body.shoulderWidth * 1.15) {
      return { completed: false, correct: false, warning: "Ayaklarini daha fazla ac" };
    }
    return { completed: false, correct: false, warning: getJackLiveGuidance(body, phase) };
  }

  if (animation === "twist") {
    const threshold = Math.max(0.03, body.shoulderWidth * 0.18);
    const side: RepPhase = body.wristHipOffset < -threshold ? "left" : body.wristHipOffset > threshold ? "right" : "center";
    if ((side === "left" || side === "right") && phase !== side) {
      const correct = body.torsoLean < 1.8;
      return {
        completed: true,
        correct,
        phase: side,
        warning: correct ? "" : "Dik dur, sadece govdeni kontrollu cevir",
      };
    }
    return { completed: false, correct: false, phase: side, warning: getTwistLiveGuidance(body, phase) };
  }

  return { completed: false, correct: false };
}

function analyzeFullBody(
  landmarks: PoseLandmark[],
  animation: "barfiks" | "jack" | "pushup" | "squat" | "twist",
): FullBodyAnalysis {
  const p = (index: number) => landmarks[index];
  const bodyRequired = [
    poseIndexes.leftShoulder,
    poseIndexes.rightShoulder,
    poseIndexes.leftHip,
    poseIndexes.rightHip,
    poseIndexes.leftKnee,
    poseIndexes.rightKnee,
    poseIndexes.leftAnkle,
    poseIndexes.rightAnkle,
  ];
  const armRequired = [
    poseIndexes.leftWrist,
    poseIndexes.rightWrist,
    poseIndexes.leftElbow,
    poseIndexes.rightElbow,
  ];
  const required = animation === "squat" ? bodyRequired : [...bodyRequired, ...armRequired];
  const visible = required.every((index) => (p(index)?.visibility ?? 0) > 0.45);
  if (!visible) {
    return {
      ankleWidth: 0,
      elbow: 180,
      hip: 180,
      knee: 180,
      kneeBalance: 0,
      kneeWidth: 0,
      shoulderWidth: 1,
      torsoLean: 0,
      visible: false,
      wristDistance: 0,
      wristHipOffset: 0,
      wristsAboveShoulders: false,
      wristsBelowShoulders: false,
    };
  }

  const leftKnee = angle(p(poseIndexes.leftHip), p(poseIndexes.leftKnee), p(poseIndexes.leftAnkle));
  const rightKnee = angle(p(poseIndexes.rightHip), p(poseIndexes.rightKnee), p(poseIndexes.rightAnkle));
  const leftHip = angle(p(poseIndexes.leftShoulder), p(poseIndexes.leftHip), p(poseIndexes.leftKnee));
  const rightHip = angle(p(poseIndexes.rightShoulder), p(poseIndexes.rightHip), p(poseIndexes.rightKnee));
  const hasArms = armRequired.every((index) => Boolean(p(index)));
  const leftElbow = hasArms ? angle(p(poseIndexes.leftShoulder), p(poseIndexes.leftElbow), p(poseIndexes.leftWrist)) : 180;
  const rightElbow = hasArms ? angle(p(poseIndexes.rightShoulder), p(poseIndexes.rightElbow), p(poseIndexes.rightWrist)) : 180;
  const shoulderCenter = midpoint(p(poseIndexes.leftShoulder), p(poseIndexes.rightShoulder));
  const hipCenter = midpoint(p(poseIndexes.leftHip), p(poseIndexes.rightHip));
  const wristCenter = hasArms ? midpoint(p(poseIndexes.leftWrist), p(poseIndexes.rightWrist)) : hipCenter;
  const shoulderWidth = distance(p(poseIndexes.leftShoulder), p(poseIndexes.rightShoulder));
  const ankleWidth = distance(p(poseIndexes.leftAnkle), p(poseIndexes.rightAnkle));
  const kneeWidth = distance(p(poseIndexes.leftKnee), p(poseIndexes.rightKnee));

  return {
    ankleWidth,
    elbow: (leftElbow + rightElbow) / 2,
    hip: (leftHip + rightHip) / 2,
    knee: (leftKnee + rightKnee) / 2,
    kneeBalance: Math.abs(leftKnee - rightKnee),
    kneeWidth,
    shoulderWidth,
    torsoLean: Math.abs(shoulderCenter.x - hipCenter.x) / Math.max(Math.abs(shoulderCenter.y - hipCenter.y), 0.001),
    visible: true,
    wristDistance: hasArms ? distance(p(poseIndexes.leftWrist), p(poseIndexes.rightWrist)) : 0,
    wristHipOffset: wristCenter.x - hipCenter.x,
    wristsAboveShoulders: hasArms && p(poseIndexes.leftWrist).y < p(poseIndexes.leftShoulder).y && p(poseIndexes.rightWrist).y < p(poseIndexes.rightShoulder).y,
    wristsBelowShoulders: hasArms && p(poseIndexes.leftWrist).y > p(poseIndexes.leftShoulder).y && p(poseIndexes.rightWrist).y > p(poseIndexes.rightShoulder).y,
  };
}

function checkSquatForm(body: FullBodyAnalysis) {
  if (body.knee > 155) return { correct: false, warning: "Biraz daha asagi in" };
  if (body.knee < 45) return { correct: false, warning: "Cok asagi indin, kontrollu kalk" };
  if (body.kneeBalance > 75) return { correct: false, warning: "Iki bacagini dengeli buk" };
  if (body.torsoLean > 1.75) return { correct: false, warning: "Govdeni daha dik tut" };
  if (body.ankleWidth < body.shoulderWidth * 0.22) return { correct: false, warning: "Ayaklarini omuz genisligine ac" };
  if (body.kneeWidth < body.ankleWidth * 0.18) return { correct: false, warning: "Dizlerini iceri dusurme" };
  return { correct: true, warning: "" };
}

function getSquatLiveGuidance(body: FullBodyAnalysis, phase: RepPhase) {
  if (body.ankleWidth < body.shoulderWidth * 0.32) {
    return "Ayaklarini biraz daha ac, omuz genisligine yaklastir.";
  }
  if (body.kneeWidth < body.ankleWidth * 0.28) {
    return "Dizlerini iceri dusurme, dizlerini ayak parmaklarinla ayni yone it.";
  }
  if (body.torsoLean > 1.35) {
    return "Gogsunu kaldir, govdeni biraz daha dik tut.";
  }
  if (phase === "down") {
    if (body.knee > 148) return "Dizlerini biraz daha buk ve kalcani geriye ver.";
    if (body.knee > 120) return "Biraz daha asagi in, topuklarini yerde tut.";
    return "Guzel, simdi topuklarindan guc alip yukari kalk.";
  }
  return "Baslamak icin dizlerini buk, kalcani geriye ver ve kontrollu asagi in.";
}

function getTwistLiveGuidance(body: FullBodyAnalysis, phase: RepPhase) {
  if (body.torsoLean > 1.8) {
    return "Dik dur, belini geriye kacirma ve karnini sik.";
  }
  if (body.wristDistance > body.shoulderWidth * 1.6) {
    return "Ellerini gogus hizasinda birbirine daha yakin tut.";
  }
  if (phase === "left") {
    return "Guzel, simdi merkeze gel ve saga dogru cevir.";
  }
  if (phase === "right") {
    return "Guzel, simdi merkeze gel ve sola dogru cevir.";
  }
  return "Ellerini gogus hizasinda tut, govdeni belirgin sekilde saga veya sola cevir.";
}

function getPushupLiveGuidance(body: FullBodyAnalysis, phase: RepPhase) {
  if (body.hip <= 140) return "Belini duz tut, kalcani cok dusurme.";
  if (body.torsoLean >= 1.1) return "Omuz, kalca ve ayaklarini ayni cizgide tut.";
  if (phase === "down") return "Avuclarindan guc al ve kontrollu sekilde yukari it.";
  if (body.elbow > 125) return "Dirseklerini buk, gogsunu yere yaklastir.";
  return "Guzel, kontrollu devam et ve hareketi tamamla.";
}

function getPullupLiveGuidance(body: FullBodyAnalysis, phase: RepPhase) {
  if (phase === "down") return "Kontrollu sekilde asagi in, kollarini uzat.";
  if (body.elbow > 120) return "Dirseklerini asagi cek, gogsu bara yaklastir.";
  return "Biraz daha yukari cek, ceneni bar hizasina yaklastir.";
}

function getJackLiveGuidance(body: FullBodyAnalysis, phase: RepPhase) {
  if (phase === "open") return "Simdi ayaklarini kapat ve kollarini yanlara indir.";
  if (!body.wristsAboveShoulders) return "Kollarini basinin ustune kaldir.";
  if (body.ankleWidth <= body.shoulderWidth * 1.15) return "Ayaklarini daha fazla yana ac.";
  return "Ritmi koru, yumusak in ve tekrar kapan.";
}

function angle(a: PoseLandmark, b: PoseLandmark, c: PoseLandmark) {
  const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let degrees = Math.abs((radians * 180) / Math.PI);
  if (degrees > 180) degrees = 360 - degrees;
  return degrees;
}

function distance(a: PoseLandmark, b: PoseLandmark) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function midpoint(a: PoseLandmark, b: PoseLandmark) {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  };
}

function ProgramList({
  disabled,
  onComplete,
  onStart,
  programs,
}: {
  disabled: boolean;
  onComplete: (id: number) => void;
  onStart: (program: Program) => void;
  programs: Program[];
}) {
  if (!programs.length) return <Empty text="Atanmış program bulunmuyor." />;

  return (
    <div className="mt-4 grid gap-3">
      {programs.map((program) => {
        const done = program.durum === "tamamlandi";
        return (
          <article className="rounded-lg border border-white/10 bg-white/[0.05] p-4" key={program.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-cyan-200">Ödev {program.odev_no || "-"}</p>
                <h3 className="mt-1 text-lg font-bold">{program.hareket || "-"}</h3>
                <p className="mt-2 text-sm text-slate-300">
                  {formatDate(program.baslangic_tarihi || program.tarih)} - {formatDate(program.bitis_tarihi || program.tarih)}
                </p>
              </div>
              <span className={`rounded-md px-3 py-1 text-sm font-bold ${done ? "bg-emerald-300 text-emerald-950" : "bg-cyan-300 text-slate-950"}`}>
                {done ? "Tamamlandı" : "Planlandı"}
              </span>
            </div>
            <p className="mt-3 text-sm text-slate-200">Hedef: {program.hedef_tekrar || 0} tekrar</p>
            {program.notlar ? <p className="mt-2 text-sm text-slate-300">Hoca notu: {program.notlar}</p> : null}
            {!done ? (
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  className="h-10 rounded-md bg-cyan-400 px-4 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-60"
                  disabled={disabled}
                  onClick={() => onStart(program)}
                  type="button"
                >
                  Kamerada yap
                </button>
                <button
                  className="h-10 rounded-md border border-white/10 px-4 text-sm font-bold text-slate-100 transition hover:bg-white/10 disabled:opacity-60"
                  disabled={disabled}
                  onClick={() => onComplete(program.id)}
                  type="button"
                >
                  Tamamlandı olarak işaretle
                </button>
              </div>
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
  if (!notifications.length) return <Empty text="Henüz hocanızdan bildirim gelmedi." />;

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
            <p className="mt-2 text-sm text-slate-300">Ödev {notification.odev_no || "-"}</p>
            {!notification.okundu ? (
              <button
                className="mt-4 h-10 rounded-md bg-cyan-400 px-4 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-60"
                disabled={disabled}
                onClick={() => onRead(notification.id)}
                type="button"
              >
                Okundu olarak işaretle
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
        <Field label="Doğum tarihi" name="dogum_tarihi" type="date" value={profile.dogum_tarihi || ""} />
        <Field label="Boy (cm)" name="boy_cm" type="number" value={profile.boy_cm || ""} />
        <Field label="Kilo (kg)" name="kilo_kg" step="0.1" type="number" value={profile.kilo_kg || ""} />
      </div>
      <label className="block">
        <span className="text-sm font-semibold text-slate-200">Spor seviyesi</span>
        <select
          className="mt-2 h-12 w-full rounded-md border border-white/10 bg-white px-3 text-slate-950 outline-none ring-cyan-300 focus:ring-2"
          defaultValue={profile.seviye || "Başlangıç"}
          name="seviye"
        >
          <option value="Başlangıç">Başlangıç</option>
          <option value="Orta">Orta</option>
          <option value="İleri">İleri</option>
        </select>
      </label>
      <label className="block">
        <span className="text-sm font-semibold text-slate-200">Sakatlık veya dikkat notu</span>
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
        Bu isteğe bağlı spor ve sağlık bilgilerimin kaydedilmesine izin veriyorum.
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
        <>
          <Empty text="Henüz onaylanmış hoca bağlantınız yok." />
          <form className="mt-5 grid gap-3" onSubmit={onSubmit}>
            <Field label="Hoca kodu" name="hoca_kodu" onChange={onCoachCodeChange} placeholder="HCA-ABC123" value={coachCode} />
            <button
              className="h-11 rounded-md bg-cyan-400 px-4 font-bold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-60"
              disabled={disabled || !coachCode.trim()}
              type="submit"
            >
              İstek gönder
            </button>
          </form>
          {connections.filter((item) => item.durum === "bekliyor").length ? (
            <p className="mt-4 text-sm text-amber-100">Bekleyen hoca isteğiniz var.</p>
          ) : null}
        </>
      )}
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
    <div className="min-w-[130px] flex-1 rounded-md bg-white/[0.06] p-3">
      <p className="break-words text-xs font-semibold leading-5 text-slate-300">{label}</p>
      <p className="mt-2 truncate text-2xl font-bold">{value}</p>
    </div>
  );
}

function CounterBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-slate-950/70 p-2 text-center">
      <p className="text-[10px] font-semibold text-slate-400">{label}</p>
      <p className="mt-0.5 text-lg font-black text-white">{value}</p>
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

function filterTrainingsByDate(trainings: Training[], selectedDate: string) {
  if (!selectedDate) return trainings;

  const fromTime = new Date(`${selectedDate}T00:00:00`).getTime();
  const toTime = new Date(`${selectedDate}T23:59:59.999`).getTime();

  return trainings.filter((training) => {
    if (!training.tarih) return false;
    const trainingTime = new Date(training.tarih).getTime();
    if (Number.isNaN(trainingTime)) return false;
    return trainingTime >= fromTime && trainingTime <= toTime;
  });
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
    .filter((value) => !["Kayıt yok", "Kayit yok", "Form hatası tespit edilmedi", "Form hatasi tespit edilmedi", "None"].includes(value))
    .forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "";
}

function normalizeFormError(value: string | null | undefined) {
  const text = String(value || "").trim();
  if (!text) return "";
  const lowerText = text.toLocaleLowerCase("tr-TR");
  if (
    lowerText.includes("form hatası tespit edilemdi") ||
    lowerText.includes("form hatasi tespit edilemdi") ||
    lowerText.includes("form hatası tespit edilemedi") ||
    lowerText.includes("form hatasi tespit edilemedi") ||
    lowerText.includes("form hatası tespit edilmedi") ||
    lowerText.includes("form hatasi tespit edilmedi") ||
    lowerText.includes("form tespit edilemedi") ||
    lowerText.includes("form tespit edilmedi")
  ) {
    return "Form hatası tespit edilmedi";
  }
  return text;
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

function asciiExerciseName(value: string) {
  const map: Record<string, string> = {
    "Aç-Kapa Zıplama": "Ac-Kapa Ziplama",
    "Gövde Çevirme": "Govde Cevirme",
    "Şınav": "Sinav",
  };
  return map[value] || value;
}

function formatSupabaseSaveError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  if (message.toLowerCase().includes("row-level security")) {
    return "Kayıt eklenemedi. Lütfen yetki ayarlarını kontrol et.";
  }
  return message || "Kayıt tamamlanamadı.";
}

function isRecoverablePoseError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  const lowerMessage = message.toLowerCase();
  return (
    lowerMessage.includes("webgl") ||
    lowerMessage.includes("loadgraph") ||
    lowerMessage.includes("canvas context")
  );
}

function stopCameraStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.async = true;
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`${src} yüklenemedi.`));
    document.head.appendChild(script);
  });
}
