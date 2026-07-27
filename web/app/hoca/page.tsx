"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { getSupabaseClient } from "@/lib/supabase/client";

type Profile = {
  id: string;
  ad_soyad: string | null;
  email?: string | null;
  hoca_kodu: string | null;
  rol: string | null;
};

type Connection = {
  sporcu_id: string;
  durum: string | null;
  profiles?: { ad_soyad: string | null; email: string | null } | null;
};

type Program = {
  id: number;
  sporcu_id: string | null;
  odev_no: number | null;
  hareket: string | null;
  hedef_tekrar: number | null;
  notlar?: string | null;
  tarih?: string | null;
  baslangic_tarihi?: string | null;
  bitis_tarihi?: string | null;
  durum: string | null;
  profiles?: { ad_soyad: string | null; email: string | null } | null;
};

type Notification = {
  id: number;
  sporcu_id: string | null;
  mesaj: string | null;
  odev_no: number | null;
  okundu: boolean | null;
  profiles?: { ad_soyad: string | null; email: string | null } | null;
};

type HocaTab = "anasayfa" | "sporcular" | "gorev-atama" | "programlar" | "bekleyenler" | "bildirimler" | "profil";
type ProgramTab = "planlanan" | "tamamlanmayan" | "tamamlanan";

const exercises = ["Squat", "Şınav", "Barfiks", "Aç-Kapa Zıplama", "Gövde Çevirme"];

export default function HocaPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<HocaTab>("anasayfa");
  const [programTab, setProgramTab] = useState<ProgramTab>("planlanan");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [message, setMessage] = useState("Yükleniyor...");
  const [coachId, setCoachId] = useState("");
  const [assignmentAthleteId, setAssignmentAthleteId] = useState("");
  const [assignmentExercise, setAssignmentExercise] = useState(exercises[0]);
  const [assignmentReps, setAssignmentReps] = useState(10);
  const [assignmentNo, setAssignmentNo] = useState(1);
  const [assignmentStartDate, setAssignmentStartDate] = useState("");
  const [assignmentEndDate, setAssignmentEndDate] = useState("");
  const [assignmentNote, setAssignmentNote] = useState("");
  const [assignmentMessage, setAssignmentMessage] = useState("");
  const [programMessage, setProgramMessage] = useState("");
  const [notificationMessage, setNotificationMessage] = useState("");
  const [connectionMessage, setConnectionMessage] = useState("");
  const [profileMessage, setProfileMessage] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const supabase = getSupabaseClient();
        const { data: authData } = await supabase.auth.getUser();

        if (!authData.user) {
          router.push("/login?role=hoca");
          return;
        }

        const { data: profileData } = await supabase
          .from("profiles")
          .select("id,ad_soyad,email,rol,hoca_kodu")
          .eq("id", authData.user.id)
          .maybeSingle();

        if (!profileData || profileData.rol !== "hoca") {
          router.push("/login?role=hoca");
          return;
        }

        const [connectionResult, programResult, notificationResult] = await Promise.all([
          supabase
            .from("hoca_sporcu")
            .select("sporcu_id,durum,profiles!hoca_sporcu_sporcu_id_fkey(ad_soyad,email)")
            .eq("hoca_id", authData.user.id)
            .order("created_at", { ascending: false }),
          supabase
            .from("programlar")
            .select("id,sporcu_id,odev_no,hareket,hedef_tekrar,notlar,durum,tarih,baslangic_tarihi,bitis_tarihi,profiles!programlar_sporcu_id_fkey(ad_soyad,email)")
            .eq("hoca_id", authData.user.id)
            .order("created_at", { ascending: false })
            .limit(20),
          supabase
            .from("bildirimler")
            .select("id,sporcu_id,mesaj,odev_no,okundu,profiles!bildirimler_sporcu_id_fkey(ad_soyad,email)")
            .eq("hoca_id", authData.user.id)
            .order("created_at", { ascending: false })
            .limit(10),
        ]);

        setProfile(profileData);
        setCoachId(authData.user.id);
        setConnections(normalizeRelatedProfiles<Connection>(connectionResult.data || []));
        setPrograms(normalizeRelatedProfiles<Program>(programResult.data || []));
        setNotifications(normalizeRelatedProfiles<Notification>(notificationResult.data || []));
        setMessage("");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Veriler yüklenemedi.");
      }
    }

    load();
  }, [router]);

  useEffect(() => {
    if (!assignmentMessage) return;
    const timer = window.setTimeout(() => setAssignmentMessage(""), 5000);
    return () => window.clearTimeout(timer);
  }, [assignmentMessage]);

  useEffect(() => {
    if (!programMessage) return;
    const timer = window.setTimeout(() => setProgramMessage(""), 5000);
    return () => window.clearTimeout(timer);
  }, [programMessage]);

  useEffect(() => {
    if (!notificationMessage) return;
    const timer = window.setTimeout(() => setNotificationMessage(""), 5000);
    return () => window.clearTimeout(timer);
  }, [notificationMessage]);

  useEffect(() => {
    if (!connectionMessage) return;
    const timer = window.setTimeout(() => setConnectionMessage(""), 5000);
    return () => window.clearTimeout(timer);
  }, [connectionMessage]);

  useEffect(() => {
    if (!profileMessage) return;
    const timer = window.setTimeout(() => setProfileMessage(""), 5000);
    return () => window.clearTimeout(timer);
  }, [profileMessage]);

  const approvedConnections = connections.filter((item) => item.durum === "onaylandi");
  const waitingConnections = connections.filter((item) => item.durum !== "onaylandi");
  const selectedAssignmentAthleteId = assignmentAthleteId || approvedConnections[0]?.sporcu_id || "";

  async function createProgram(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!coachId) return setAssignmentMessage("Hoca oturumu bulunamadı.");
    if (!selectedAssignmentAthleteId) return setAssignmentMessage("Program atamak için önce onaylı bir sporcu gerekli.");

    const startDate = assignmentStartDate || new Date().toISOString().slice(0, 10);
    const endDate = assignmentEndDate || startDate;
    if (new Date(`${endDate}T00:00:00`) < new Date(`${startDate}T00:00:00`)) {
      setAssignmentMessage("Son tarih başlangıç tarihinden önce olamaz.");
      return;
    }

    setIsDeleting(true);
    setAssignmentMessage("");
    try {
      const supabase = getSupabaseClient();
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Oturum bilgisi bulunamadı.");

      const payload = {
        sporcu_id: selectedAssignmentAthleteId,
        odev_no: assignmentNo,
        hareket: assignmentExercise,
        hedef_tekrar: assignmentReps,
        tarih: startDate,
        baslangic_tarihi: startDate,
        bitis_tarihi: endDate,
        notlar: assignmentNote.trim(),
      };

      const response = await fetch("/api/hoca/program", {
        body: JSON.stringify(payload),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const result = (await response.json()) as { error?: string; program?: Program };
      if (!response.ok || !result.program) throw new Error(result.error || "Program atanamadı.");

      setPrograms((items) => [normalizeRelatedProfiles<Program>([result.program])[0], ...items]);
      setAssignmentNote("");
      setAssignmentMessage("Program sporcuya atandı.");
      setProgramTab("planlanan");
    } catch (error) {
      setAssignmentMessage(error instanceof Error ? error.message : "Program atanamadı.");
    } finally {
      setIsDeleting(false);
    }
  }

  async function deleteProgram(id: number) {
    if (!window.confirm("Bu program silinsin mi?")) return;
    setIsDeleting(true);
    setProgramMessage("");
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.from("programlar").delete().eq("id", id);
      if (error) throw error;
      setPrograms((items) => items.filter((item) => item.id !== id));
      setProgramMessage("Program silindi.");
    } catch (error) {
      setProgramMessage(error instanceof Error ? error.message : "Program silinemedi.");
    } finally {
      setIsDeleting(false);
    }
  }

  async function deleteNotification(id: number) {
    if (!window.confirm("Bu bildirim silinsin mi?")) return;
    setIsDeleting(true);
    setNotificationMessage("");
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.from("bildirimler").delete().eq("id", id);
      if (error) throw error;
      setNotifications((items) => items.filter((item) => item.id !== id));
      setNotificationMessage("Bildirim silindi.");
    } catch (error) {
      setNotificationMessage(error instanceof Error ? error.message : "Bildirim silinemedi.");
    } finally {
      setIsDeleting(false);
    }
  }

  async function updateConnection(connection: Connection, nextStatus: "onaylandi" | "reddedildi") {
    setIsDeleting(true);
    setConnectionMessage("");
    try {
      if (!coachId) throw new Error("Hoca oturumu bulunamadı.");
      const supabase = getSupabaseClient();
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Oturum bilgisi bulunamadı.");

      const response = await fetch("/api/hoca/connection-request", {
        body: JSON.stringify({
          action: nextStatus === "onaylandi" ? "accept" : "reject",
          athleteId: connection.sporcu_id,
        }),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "İstek güncellenemedi.");

      if (nextStatus === "onaylandi") {
        setConnections((items) =>
          items.map((item) =>
            item.sporcu_id === connection.sporcu_id
              ? { ...item, durum: "onaylandi" }
              : item,
          ),
        );
        setConnectionMessage("Sporcu isteği onaylandı ve sporcuya bildirim gönderildi.");
        return;
      }

      setConnections((items) =>
        items.filter((item) => item.sporcu_id !== connection.sporcu_id),
      );
      setConnectionMessage("Sporcu isteği reddedildi ve sporcuya bildirim gönderildi.");
    } catch (error) {
      setConnectionMessage(error instanceof Error ? error.message : "İstek güncellenemedi.");
    } finally {
      setIsDeleting(false);
    }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;
    const form = new FormData(event.currentTarget);
    const fullName = String(form.get("ad_soyad") || "").trim();

    setIsDeleting(true);
    setProfileMessage("");
    try {
      if (fullName.length < 2) {
        setProfileMessage("Ad soyad en az 2 karakter olmalı.");
        return;
      }

      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from("profiles")
        .update({
          ad_soyad: fullName,
          profil_guncelleme_zamani: new Date().toISOString(),
        })
        .eq("id", profile.id);

      if (error) throw error;
      setProfile((current) => current ? { ...current, ad_soyad: fullName } : current);
      setProfileMessage("Profil kaydedildi.");
    } catch (error) {
      setProfileMessage(error instanceof Error ? error.message : "Profil kaydedilemedi.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <DashboardLayout
      accent="emerald"
      sidebar={
        <div className="grid gap-2">
          <SidebarButton active={activeTab === "anasayfa"} label="Ana Sayfa" onClick={() => setActiveTab("anasayfa")} />
          <SidebarButton active={activeTab === "sporcular"} label="Sporcularım" onClick={() => setActiveTab("sporcular")} />
          <SidebarButton active={activeTab === "gorev-atama"} label="Görev atama" onClick={() => setActiveTab("gorev-atama")} />
          <SidebarButton active={activeTab === "programlar"} label="Atanan programlar" onClick={() => setActiveTab("programlar")} />
          <SidebarButton active={activeTab === "bekleyenler"} label="Bekleyen istekler" onClick={() => setActiveTab("bekleyenler")} />
          <SidebarButton active={activeTab === "bildirimler"} label="Bildirimler" onClick={() => setActiveTab("bildirimler")} />
          <SidebarButton active={activeTab === "profil"} label="Profil" onClick={() => setActiveTab("profil")} />
        </div>
      }
      subtitle="Hoca Paneli"
      title={`Merhaba ${profile?.ad_soyad || "Hoca"}!`}
    >
      {message ? <p className="text-slate-300">{message}</p> : null}

      {activeTab === "anasayfa" && (
        <Panel title="Ana Sayfa">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Sporcularım" value={approvedConnections.length} />
            <Metric label="Bekleyen istek" value={waitingConnections.length} />
            <Metric label="Program" value={programs.length} />
            <Metric label="Bildirim" value={notifications.length} />
          </div>
          <div className="mt-4">
            <CoachCodeCard code={profile?.hoca_kodu || ""} />
          </div>
        </Panel>
      )}

      {activeTab === "sporcular" && (
        <Panel title="Sporcularım">
          <ConnectionList connections={approvedConnections} emptyText="Onaylı sporcu bağlantısı yok." />
        </Panel>
      )}

      {activeTab === "gorev-atama" && (
        <Panel title="Görev atama">
          <AssignmentForm
            athleteId={selectedAssignmentAthleteId}
            connections={approvedConnections}
            disabled={isDeleting}
            endDate={assignmentEndDate}
            exercise={assignmentExercise}
            message={assignmentMessage}
            note={assignmentNote}
            onAthleteChange={setAssignmentAthleteId}
            onEndDateChange={setAssignmentEndDate}
            onExerciseChange={setAssignmentExercise}
            onNoteChange={setAssignmentNote}
            onNumberChange={setAssignmentNo}
            onRepsChange={setAssignmentReps}
            onStartDateChange={setAssignmentStartDate}
            onSubmit={createProgram}
            reps={assignmentReps}
            startDate={assignmentStartDate}
            taskNo={assignmentNo}
          />
        </Panel>
      )}

      {activeTab === "programlar" && (
        <Panel title="Atanan programlar">
          <Status text={programMessage} />
          <ProgramList
            activeTab={programTab}
            connections={connections}
            disabled={isDeleting}
            onDelete={deleteProgram}
            onTabChange={setProgramTab}
            programs={programs}
          />
        </Panel>
      )}

      {activeTab === "bekleyenler" && (
        <Panel title="Bekleyen istekler">
          <Status text={connectionMessage} />
          <ConnectionList
            connections={waitingConnections}
            disabled={isDeleting}
            emptyText="Bekleyen sporcu isteği yok."
            onUpdate={updateConnection}
            showActions
          />
        </Panel>
      )}

      {activeTab === "bildirimler" && (
        <Panel title="Bildirimler">
          <Status text={notificationMessage} />
          <NotificationList connections={connections} disabled={isDeleting} notifications={notifications} onDelete={deleteNotification} />
        </Panel>
      )}

      {activeTab === "profil" && profile && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
          <Panel title="Profilim">
            <Status text={profileMessage} />
            <CoachProfileForm disabled={isDeleting} onSubmit={saveProfile} profile={profile} />
          </Panel>
          <Panel title="Hoca kodum">
            <CoachCodeCard code={profile.hoca_kodu || ""} />
          </Panel>
        </div>
      )}
    </DashboardLayout>
  );
}

function normalizeRelatedProfiles<T extends { profiles?: unknown }>(items: unknown[]) {
  return (items as Array<T & { profiles?: T["profiles"] | T["profiles"][] }>).map((item) => ({
    ...item,
    profiles: Array.isArray(item.profiles) ? item.profiles[0] || null : item.profiles || null,
  })) as T[];
}

function SidebarButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-md px-4 text-left text-sm font-bold transition ${
        active ? "bg-emerald-400 text-emerald-950" : "text-slate-300 hover:bg-white/10"
      }`}
      onClick={onClick}
      type="button"
    >
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </button>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.05] p-4 sm:p-5">
      <p className="text-sm text-slate-300">{label}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  );
}

function CoachCodeCard({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    if (!code || !navigator.clipboard) return;
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mb-4 rounded-md border border-emerald-300/25 bg-emerald-300/10 p-4">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-200">
        Hoca kodu
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <p className="max-w-full break-all rounded-md bg-slate-950/70 px-4 py-3 font-mono text-lg font-black text-white sm:text-xl sm:tracking-[0.12em]">
          {code || "Kod olusturulmadi"}
        </p>
        <button
          className="h-10 rounded-md bg-emerald-400 px-4 text-sm font-bold text-emerald-950 transition hover:bg-emerald-300 disabled:opacity-60"
          disabled={!code}
          onClick={copyCode}
          type="button"
        >
          {copied ? "Kopyalandi" : "Kopyala"}
        </button>
      </div>
      <p className="mt-3 text-sm text-emerald-50">
        Sporcu bu kodu kendi panelindeki Hoca kodu alanına yazar.
      </p>
    </div>
  );
}

function ConnectionList({
  connections,
  disabled = false,
  emptyText,
  onUpdate,
  showActions = false,
}: {
  connections: Connection[];
  disabled?: boolean;
  emptyText: string;
  onUpdate?: (connection: Connection, nextStatus: "onaylandi" | "reddedildi") => void;
  showActions?: boolean;
}) {
  if (!connections.length) return <EmptyState text={emptyText} />;

  return (
    <div className="space-y-3">
      {connections.map((connection) => {
        const athlete = athleteProfile(connection.sporcu_id, connection.profiles, connections);
        return (
          <div className="min-w-0 rounded-md border border-white/10 bg-white/[0.05] p-4" key={connection.sporcu_id}>
            <p className="font-semibold">{athlete.name}</p>
            <p className="break-words text-sm text-slate-300">{athlete.email}</p>
            <span
              className={`mt-3 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-bold ${
                connection.durum === "onaylandi"
                  ? "bg-emerald-300/15 text-emerald-100 ring-1 ring-emerald-300/25"
                  : "bg-amber-300/15 text-amber-100 ring-1 ring-amber-300/25"
              }`}
            >
              <span className={`size-1.5 rounded-full ${connection.durum === "onaylandi" ? "bg-emerald-300" : "bg-amber-300"}`} />
              {connection.durum === "onaylandi" ? "Onaylandı" : connection.durum || "Bekliyor"}
            </span>
            {showActions && onUpdate ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  className="h-9 rounded-md bg-emerald-400 px-3 text-sm font-bold text-emerald-950 transition hover:bg-emerald-300 disabled:opacity-60"
                  disabled={disabled}
                  onClick={() => onUpdate(connection, "onaylandi")}
                  type="button"
                >
                  Kabul et
                </button>
                <button
                  className="h-9 rounded-md border border-rose-300/40 px-3 text-sm font-bold text-rose-100 transition hover:bg-rose-300/10 disabled:opacity-60"
                  disabled={disabled}
                  onClick={() => onUpdate(connection, "reddedildi")}
                  type="button"
                >
                  Reddet
                </button>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function AssignmentForm({
  athleteId,
  connections,
  disabled,
  endDate,
  exercise,
  message,
  note,
  onAthleteChange,
  onEndDateChange,
  onExerciseChange,
  onNoteChange,
  onNumberChange,
  onRepsChange,
  onStartDateChange,
  onSubmit,
  reps,
  startDate,
  taskNo,
}: {
  athleteId: string;
  connections: Connection[];
  disabled: boolean;
  endDate: string;
  exercise: string;
  message: string;
  note: string;
  onAthleteChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onExerciseChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onNumberChange: (value: number) => void;
  onRepsChange: (value: number) => void;
  onStartDateChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  reps: number;
  startDate: string;
  taskNo: number;
}) {
  if (!connections.length) return <EmptyState text="Görev atamak için onaylı sporcu bağlantısı yok." />;

  return (
    <form className="grid gap-4" onSubmit={onSubmit}>
      {message ? (
        <p className="rounded-md border border-emerald-300/30 bg-emerald-300/10 p-3 text-sm font-semibold text-emerald-100">
          {message}
        </p>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="text-sm font-semibold text-slate-200">Öğrenci</span>
          <select
            className="mt-2 h-12 w-full rounded-md border border-white/10 bg-white px-3 text-slate-950 outline-none ring-emerald-300 focus:ring-2"
            onChange={(event) => onAthleteChange(event.target.value)}
            value={athleteId}
          >
            {connections.map((connection) => {
              const athlete = athleteProfile(connection.sporcu_id, connection.profiles, connections);
              return (
                <option key={connection.sporcu_id} value={connection.sporcu_id}>
                  {athlete.name} - {athlete.email}
                </option>
              );
            })}
          </select>
        </label>

        <label className="block">
          <span className="text-sm font-semibold text-slate-200">Hareket</span>
          <select
            className="mt-2 h-12 w-full rounded-md border border-white/10 bg-white px-3 text-slate-950 outline-none ring-emerald-300 focus:ring-2"
            onChange={(event) => onExerciseChange(event.target.value)}
            value={exercise}
          >
            {exercises.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <NumberField label="Ödev no" min={1} onChange={onNumberChange} value={taskNo} />
        <NumberField label="Hedef tekrar" min={1} onChange={onRepsChange} value={reps} />
        <DateField label="Başlangıç tarihi" onChange={onStartDateChange} value={startDate} />
        <DateField label="Son tarih" onChange={onEndDateChange} value={endDate} />
      </div>

      <label className="block">
        <span className="text-sm font-semibold text-slate-200">Not</span>
        <textarea
          className="mt-2 min-h-24 w-full rounded-md border border-white/10 bg-white px-3 py-3 text-slate-950 outline-none ring-emerald-300 focus:ring-2"
          onChange={(event) => onNoteChange(event.target.value)}
          placeholder="Örn: Hareketi kontrollü yap, set aralarında 30 sn dinlen."
          value={note}
        />
      </label>

      <button
        className="h-12 rounded-md bg-emerald-400 px-4 font-bold text-emerald-950 transition hover:bg-emerald-300 disabled:opacity-60"
        disabled={disabled}
        type="submit"
      >
        Görevi ata
      </button>
    </form>
  );
}

function CoachProfileForm({
  disabled,
  onSubmit,
  profile,
}: {
  disabled: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  profile: Profile;
}) {
  return (
    <form className="grid gap-4" onSubmit={onSubmit}>
      <label className="block">
        <span className="text-sm font-semibold text-slate-200">Ad soyad</span>
        <input
          className="mt-2 h-12 w-full rounded-md border border-white/10 bg-white px-3 text-slate-950 outline-none ring-emerald-300 focus:ring-2"
          defaultValue={profile.ad_soyad || ""}
          name="ad_soyad"
          required
        />
      </label>

      <label className="block">
        <span className="text-sm font-semibold text-slate-200">E-posta</span>
        <input
          className="mt-2 h-12 w-full rounded-md border border-white/10 bg-white px-3 text-slate-500 outline-none"
          readOnly
          value={profile.email || ""}
        />
      </label>

      <label className="block">
        <span className="text-sm font-semibold text-slate-200">Rol</span>
        <input
          className="mt-2 h-12 w-full rounded-md border border-white/10 bg-white px-3 text-slate-500 outline-none"
          readOnly
          value="Hoca"
        />
      </label>

      <button
        className="h-12 rounded-md bg-emerald-400 px-4 font-bold text-emerald-950 transition hover:bg-emerald-300 disabled:opacity-60"
        disabled={disabled}
        type="submit"
      >
        Profili kaydet
      </button>
    </form>
  );
}

function NumberField({
  label,
  min,
  onChange,
  value,
}: {
  label: string;
  min: number;
  onChange: (value: number) => void;
  value: number;
}) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-200">{label}</span>
      <input
        className="mt-2 h-12 w-full rounded-md border border-white/10 bg-white px-3 text-slate-950 outline-none ring-emerald-300 focus:ring-2"
        min={min}
        onChange={(event) => onChange(Math.max(min, Number(event.target.value) || min))}
        type="number"
        value={value}
      />
    </label>
  );
}

function DateField({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-200">{label}</span>
      <input
        className="mt-2 h-12 w-full rounded-md border border-white/10 bg-white px-3 text-slate-950 outline-none ring-emerald-300 focus:ring-2"
        onChange={(event) => onChange(event.target.value)}
        type="date"
        value={value}
      />
    </label>
  );
}

function ProgramList({
  activeTab,
  connections,
  disabled,
  onDelete,
  onTabChange,
  programs,
}: {
  activeTab: ProgramTab;
  connections: Connection[];
  disabled: boolean;
  onDelete: (id: number) => void;
  onTabChange: (tab: ProgramTab) => void;
  programs: Program[];
}) {
  const completedPrograms = programs.filter((program) => program.durum === "tamamlandi");
  const missedPrograms = programs.filter((program) => program.durum !== "tamamlandi" && isPastDue(program));
  const plannedPrograms = programs.filter((program) => program.durum !== "tamamlandi" && !isPastDue(program));
  const visiblePrograms = {
    planlanan: plannedPrograms,
    tamamlanmayan: missedPrograms,
    tamamlanan: completedPrograms,
  }[activeTab];

  if (!programs.length) return <p className="text-sm text-slate-300">Atanmış program yok.</p>;

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        <button
          className={`h-9 rounded-md px-3 text-xs font-bold transition ${
            activeTab === "planlanan"
              ? "bg-emerald-400 text-emerald-950"
              : "bg-white/[0.06] text-slate-200 hover:bg-white/10"
          }`}
          onClick={() => onTabChange("planlanan")}
          type="button"
        >
          Planlanan ({plannedPrograms.length})
        </button>
        <button
          className={`h-9 rounded-md px-3 text-xs font-bold transition ${
            activeTab === "tamamlanmayan"
              ? "bg-amber-300 text-amber-950"
              : "bg-white/[0.06] text-slate-200 hover:bg-white/10"
          }`}
          onClick={() => onTabChange("tamamlanmayan")}
          type="button"
        >
          Tamamlanmayanlar ({missedPrograms.length})
        </button>
        <button
          className={`h-9 rounded-md px-3 text-xs font-bold transition ${
            activeTab === "tamamlanan"
              ? "bg-emerald-400 text-emerald-950"
              : "bg-white/[0.06] text-slate-200 hover:bg-white/10"
          }`}
          onClick={() => onTabChange("tamamlanan")}
          type="button"
        >
          Tamamlanan ({completedPrograms.length})
        </button>
      </div>

      {visiblePrograms.length ? (
        <div className="space-y-3">
          {visiblePrograms.map((program) => {
            const athlete = athleteProfile(program.sporcu_id, program.profiles, connections);
            return (
              <div className="relative min-w-0 rounded-md border border-white/10 bg-white/[0.05] p-4 pr-14" key={program.id}>
                <button
                  aria-label="Programı sil"
                  className="absolute right-3 top-3 grid size-9 place-items-center rounded-md border border-rose-300/35 text-rose-100 transition hover:bg-rose-400 hover:text-rose-950 disabled:opacity-60"
                  disabled={disabled}
                  onClick={() => onDelete(program.id)}
                  type="button"
                >
                  <svg aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M3 6h18" />
                    <path d="M8 6V4h8v2" />
                    <path d="M6 6l1 15h10l1-15" />
                    <path d="M10 11v6" />
                    <path d="M14 11v6" />
                  </svg>
                </button>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-black text-white">Ödev {program.odev_no || "-"} - {displayExerciseName(program.hareket)}</h3>
                  <span className="rounded-md bg-white/10 px-2.5 py-1 text-xs font-bold text-slate-200">{athlete.name}</span>
                  {program.durum !== "tamamlandi" && isPastDue(program) ? (
                    <span className="rounded-md bg-amber-300/15 px-2.5 py-1 text-xs font-bold text-amber-100 ring-1 ring-amber-300/25">
                      Son tarih geçti
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 break-words text-xs text-slate-400">{athlete.email}</p>
                <p className="mt-3 text-sm text-slate-300">Hedef {program.hedef_tekrar || 0} tekrar - {program.durum || "bekliyor"}</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-md bg-slate-950/35 px-3 py-2">
                    <p className="text-xs font-semibold text-slate-400">Atama başlangıcı</p>
                    <p className="mt-1 text-sm font-bold text-slate-100">{formatDate(program.baslangic_tarihi || program.tarih)}</p>
                  </div>
                  <div className="rounded-md bg-slate-950/35 px-3 py-2">
                    <p className="text-xs font-semibold text-slate-400">Son tarih</p>
                    <p className="mt-1 text-sm font-bold text-slate-100">{formatDate(program.bitis_tarihi || program.tarih)}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-slate-300">
          {activeTab === "planlanan"
            ? "Planlanan program yok."
            : activeTab === "tamamlanmayan"
              ? "Son tarihi geçmiş tamamlanmayan program yok."
              : "Tamamlanan program yok."}
        </p>
      )}
    </div>
  );
}
function NotificationList({
  connections,
  disabled,
  notifications,
  onDelete,
}: {
  connections: Connection[];
  disabled: boolean;
  notifications: Notification[];
  onDelete: (id: number) => void;
}) {
  if (!notifications.length) return <EmptyState text="Bildirim yok." />;

  return (
    <div className="space-y-3">
      {notifications.map((notification) => {
        const athlete = athleteProfile(notification.sporcu_id, notification.profiles, connections);
        return (
          <div className="min-w-0 rounded-md border border-white/10 bg-white/[0.05] p-4" key={notification.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-base font-black text-white">Alıcı: {athlete.name}</h3>
                <p className="mt-1 break-words text-xs text-slate-400">{athlete.email} · Ödev {notification.odev_no || "-"}</p>
              </div>
              <span
                className={`rounded-md px-2.5 py-1 text-xs font-bold ${
                  notification.okundu
                    ? "bg-emerald-300/15 text-emerald-100 ring-1 ring-emerald-300/25"
                    : "bg-amber-300/15 text-amber-100 ring-1 ring-amber-300/25"
                }`}
              >
                {notification.okundu ? "Öğrenci okudu" : "Henüz okunmadı"}
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-100">{notification.mesaj || "-"}</p>
            <button
              className="mt-3 h-9 rounded-md border border-rose-300/40 px-3 text-sm font-bold text-rose-100 transition hover:bg-rose-300/10 disabled:opacity-60"
              disabled={disabled}
              onClick={() => onDelete(notification.id)}
              type="button"
            >
              Sil
            </button>
          </div>
        );
      })}
    </div>
  );
}

function athleteProfile(
  athleteId: string | null,
  profile: { ad_soyad: string | null; email: string | null } | null | undefined,
  connections: Connection[],
) {
  const connectionProfile = connections.find((connection) => connection.sporcu_id === athleteId)?.profiles;
  return {
    email: profile?.email || connectionProfile?.email || "-",
    name: profile?.ad_soyad || connectionProfile?.ad_soyad || "İsimsiz sporcu",
  };
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("tr-TR").format(date);
}

function isPastDue(program: Program) {
  const endDate = program.bitis_tarihi || program.tarih;
  if (!endDate) return false;
  const endTime = new Date(`${endDate}T23:59:59`).getTime();
  if (Number.isNaN(endTime)) return false;
  return endTime < Date.now();
}

function displayExerciseName(value: string | null | undefined) {
  const map: Record<string, string> = {
    "AÃ§-Kapa ZÄ±plama": "Aç-Kapa Zıplama",
    "GÃ¶vde Ã‡evirme": "Gövde Çevirme",
    "ÅÄ±nav": "Şınav",
  };
  return value ? map[value] || value : "-";
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-300">
      {text}
    </div>
  );
}

function Status({ text }: { text: string }) {
  if (!text) return null;
  return (
    <p className="mb-4 rounded-md border border-emerald-300/30 bg-emerald-300/10 p-3 text-sm font-semibold text-emerald-100">
      {text}
    </p>
  );
}

function Panel({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <section className="min-w-0 rounded-lg border border-white/10 bg-white/[0.05] p-4 sm:p-5">
      <h2 className="text-xl font-bold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}
