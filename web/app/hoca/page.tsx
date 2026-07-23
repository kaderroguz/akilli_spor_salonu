"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { getSupabaseClient } from "@/lib/supabase/client";

type Profile = {
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

type HocaTab = "anasayfa" | "sporcular" | "programlar" | "bekleyenler" | "bildirimler";
type ProgramTab = "planlanan" | "tamamlanan";

export default function HocaPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<HocaTab>("anasayfa");
  const [programTab, setProgramTab] = useState<ProgramTab>("planlanan");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [message, setMessage] = useState("YÃ¼kleniyor...");
  const [coachId, setCoachId] = useState("");

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
          .select("ad_soyad, rol, hoca_kodu")
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
            .select("id,sporcu_id,odev_no,hareket,hedef_tekrar,durum,profiles!programlar_sporcu_id_fkey(ad_soyad,email)")
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
        setMessage(error instanceof Error ? error.message : "Veriler yÃ¼klenemedi.");
      }
    }

    load();
  }, [router]);

  const approvedConnections = connections.filter((item) => item.durum === "onaylandi");
  const waitingConnections = connections.filter((item) => item.durum !== "onaylandi");

  async function deleteProgram(id: number) {
    if (!window.confirm("Bu program silinsin mi?")) return;
    setIsDeleting(true);
    setMessage("");
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.from("programlar").delete().eq("id", id);
      if (error) throw error;
      setPrograms((items) => items.filter((item) => item.id !== id));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Program silinemedi.");
    } finally {
      setIsDeleting(false);
    }
  }

  async function deleteNotification(id: number) {
    if (!window.confirm("Bu bildirim silinsin mi?")) return;
    setIsDeleting(true);
    setMessage("");
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.from("bildirimler").delete().eq("id", id);
      if (error) throw error;
      setNotifications((items) => items.filter((item) => item.id !== id));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Bildirim silinemedi.");
    } finally {
      setIsDeleting(false);
    }
  }

  async function updateConnection(connection: Connection, nextStatus: "onaylandi" | "reddedildi") {
    setIsDeleting(true);
    setMessage("");
    try {
      if (!coachId) throw new Error("Hoca oturumu bulunamadi.");
      const supabase = getSupabaseClient();
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Oturum bilgisi bulunamadi.");

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
      if (!response.ok) throw new Error(result.error || "Istek guncellenemedi.");

      if (nextStatus === "onaylandi") {
        setConnections((items) =>
          items.map((item) =>
            item.sporcu_id === connection.sporcu_id
              ? { ...item, durum: "onaylandi" }
              : item,
          ),
        );
        setMessage("Sporcu istegi onaylandi ve sporcuya bildirim gonderildi.");
        return;
      }

      setConnections((items) =>
        items.filter((item) => item.sporcu_id !== connection.sporcu_id),
      );
      setMessage("Sporcu istegi reddedildi ve sporcuya bildirim gonderildi.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Istek guncellenemedi.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <DashboardLayout
      accent="emerald"
      sidebar={
        <div className="grid gap-2">
          <SidebarButton active={activeTab === "anasayfa"} count={approvedConnections.length} label="Ana Sayfa" onClick={() => setActiveTab("anasayfa")} />
          <SidebarButton active={activeTab === "sporcular"} count={approvedConnections.length} label="Sporcularım" onClick={() => setActiveTab("sporcular")} />
          <SidebarButton active={activeTab === "programlar"} count={programs.length} label="Atanan programlar" onClick={() => setActiveTab("programlar")} />
          <SidebarButton active={activeTab === "bekleyenler"} count={waitingConnections.length} label="Bekleyen istekler" onClick={() => setActiveTab("bekleyenler")} />
          <SidebarButton active={activeTab === "bildirimler"} count={notifications.length} label="Bildirimler" onClick={() => setActiveTab("bildirimler")} />
        </div>
      }
      subtitle="Hoca Paneli"
      title={`Merhaba ${profile?.ad_soyad || "Hoca"}!`}
    >
      {message ? <p className="text-slate-300">{message}</p> : null}

      {activeTab === "anasayfa" && (
        <Panel title="Ana Sayfa">
          <div className="grid gap-4 md:grid-cols-4">
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

      {activeTab === "programlar" && (
        <Panel title="Atanan programlar">
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
          <NotificationList connections={connections} disabled={isDeleting} notifications={notifications} onDelete={deleteNotification} />
        </Panel>
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

function SidebarButton({ active, count, label, onClick }: { active: boolean; count: number; label: string; onClick: () => void }) {
  return (
    <button
      className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-md px-4 text-left text-sm font-bold transition ${
        active ? "bg-emerald-400 text-emerald-950" : "text-slate-300 hover:bg-white/10"
      }`}
      onClick={onClick}
      type="button"
    >
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className={`shrink-0 rounded-md px-2 py-1 text-xs ${active ? "bg-emerald-950/15" : "bg-white/10"}`}>{count}</span>
    </button>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.05] p-5">
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
        <p className="rounded-md bg-slate-950/70 px-4 py-3 font-mono text-xl font-black tracking-[0.12em] text-white">
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
          <div className="rounded-md bg-white/[0.05] p-3" key={connection.sporcu_id}>
            <p className="font-semibold">{athlete.name}</p>
            <p className="text-sm text-slate-300">{athlete.email}</p>
            <p className="mt-2 text-xs text-slate-400">{connection.durum || "bekliyor"}</p>
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
  const plannedPrograms = programs.filter((program) => program.durum !== "tamamlandi");
  const visiblePrograms = activeTab === "tamamlanan" ? completedPrograms : plannedPrograms;

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
              <div className="rounded-md bg-white/[0.05] p-3" key={program.id}>
                <p className="text-sm font-semibold text-emerald-100">Sporcu: {athlete.name}</p>
                <p className="mt-1 text-xs text-slate-400">{athlete.email}</p>
                <p className="font-semibold">Ödev {program.odev_no || "-"} - {program.hareket || "-"}</p>
                <p className="text-sm text-slate-300">Hedef {program.hedef_tekrar || 0} tekrar - {program.durum || "bekliyor"}</p>
                <button
                  className="mt-3 h-9 rounded-md border border-rose-300/40 px-3 text-sm font-bold text-rose-100 transition hover:bg-rose-300/10 disabled:opacity-60"
                  disabled={disabled}
                  onClick={() => onDelete(program.id)}
                  type="button"
                >
                  Sil
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-slate-300">
          {activeTab === "planlanan" ? "Planlanan program yok." : "Tamamlanan program yok."}
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
          <div className="rounded-md bg-white/[0.05] p-3" key={notification.id}>
            <p className="text-sm font-semibold text-emerald-100">Kime: {athlete.name}</p>
            <p className="mt-1 text-xs text-slate-400">{athlete.email} · Ödev {notification.odev_no || "-"}</p>
            <p className="text-sm leading-6 text-slate-100">{notification.mesaj || "-"}</p>
            <button
              className="mt-3 h-9 rounded-md border border-rose-300/40 px-3 text-sm font-bold text-rose-100 transition hover:bg-rose-300/10 disabled:opacity-60"
              disabled={disabled}
              onClick={() => onDelete(notification.id)}
              type="button"
            >
              Sil
            </button>
            <p className="mt-2 text-xs text-slate-400">{notification.okundu ? "Okundu" : "Okunmadı"}</p>
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
    name: profile?.ad_soyad || connectionProfile?.ad_soyad || "Ä°simsiz sporcu",
  };
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.04] p-4 text-sm text-slate-300">
      {text}
    </div>
  );
}

function Panel({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.05] p-5">
      <h2 className="text-xl font-bold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}
