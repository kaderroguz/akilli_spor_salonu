"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { getSupabaseClient } from "@/lib/supabase/client";

type Profile = {
  id: string;
  ad_soyad: string | null;
  email: string | null;
  rol: string | null;
  created_at: string | null;
};

type RoleRequest = {
  id: number;
  durum: string | null;
  kullanici_id: string;
  profil?: { ad_soyad: string | null; email: string | null } | null;
};

type AdminTab = "ozet" | "kullanicilar" | "basvurular";
type UserTab = "sporcu" | "hoca";

export default function AdminPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AdminTab>("ozet");
  const [userTab, setUserTab] = useState<UserTab>("sporcu");
  const [adminName, setAdminName] = useState("Yönetici");
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [requests, setRequests] = useState<RoleRequest[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [message, setMessage] = useState("Yükleniyor...");
  const [userMessage, setUserMessage] = useState("");
  const [requestMessage, setRequestMessage] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const supabase = getSupabaseClient();
        const { data: authData } = await supabase.auth.getUser();

        if (!authData.user) {
          router.push("/login?role=admin");
          return;
        }

        const { data: profileData } = await supabase
          .from("profiles")
          .select("ad_soyad, rol")
          .eq("id", authData.user.id)
          .maybeSingle();

        if (!profileData || !isAdminRole(profileData.rol)) {
          router.push("/login?role=admin");
          return;
        }

        const [profilesResult, requestsResult] = await Promise.all([
          supabase
            .from("profiles")
            .select("id,ad_soyad,email,rol,created_at")
            .order("created_at", { ascending: false })
            .limit(50),
          supabase
            .from("rol_talepleri")
            .select("id,kullanici_id,durum,profil:profiles!rol_talepleri_kullanici_id_fkey(ad_soyad,email)")
            .order("created_at", { ascending: false })
            .limit(20),
        ]);

        setAdminName(profileData.ad_soyad || "Yönetici");
        setProfiles((profilesResult.data as Profile[]) || []);
        const normalizedRequests = ((requestsResult.data || []) as Array<
          Omit<RoleRequest, "profil"> & {
            profil?: RoleRequest["profil"] | RoleRequest["profil"][];
          }
        >).map((request) => ({
          ...request,
          profil: Array.isArray(request.profil)
            ? request.profil[0] || null
            : request.profil || null,
        }));

        setRequests(normalizedRequests);
        setMessage("");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Veriler yüklenemedi.");
      }
    }

    load();
  }, [router]);

  useEffect(() => {
    if (!userMessage) return;
    const timer = window.setTimeout(() => setUserMessage(""), 5000);
    return () => window.clearTimeout(timer);
  }, [userMessage]);

  useEffect(() => {
    if (!requestMessage) return;
    const timer = window.setTimeout(() => setRequestMessage(""), 5000);
    return () => window.clearTimeout(timer);
  }, [requestMessage]);

  const athleteCount = profiles.filter((item) => item.rol === "sporcu").length;
  const coachCount = profiles.filter((item) => item.rol === "hoca").length;
  const waitingRequestCount = requests.filter((item) => item.durum === "bekliyor").length;

  async function deleteProfile(profile: Profile) {
    const label = profile.ad_soyad || profile.email || "bu kullanıcı";
    if (!window.confirm(`${label} kaydı silinsin mi?`)) return;

    setIsDeleting(true);
    setUserMessage("");
    try {
      const supabase = getSupabaseClient();
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Oturum bilgisi bulunamadı.");

      const response = await fetch("/api/admin/delete-user", {
        body: JSON.stringify({ userId: profile.id }),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Kullanıcı kaydı silinemedi.");

      setProfiles((items) => items.filter((item) => item.id !== profile.id));
      setRequests((items) => items.filter((item) => item.profil?.email !== profile.email));
      setUserMessage("Kullanıcı kaydı silindi.");
    } catch (error) {
      setUserMessage(error instanceof Error ? error.message : "Kullanıcı kaydı silinemedi.");
    } finally {
      setIsDeleting(false);
    }
  }

  async function updateRoleRequest(request: RoleRequest, nextStatus: "onaylandi" | "reddedildi") {
    setIsDeleting(true);
    setRequestMessage("");
    try {
      const supabase = getSupabaseClient();

      if (nextStatus === "onaylandi") {
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ rol: "hoca" })
          .eq("id", request.kullanici_id);
        if (profileError) throw profileError;
      }

      const { error: requestError } = await supabase
        .from("rol_talepleri")
        .update({ durum: nextStatus })
        .eq("id", request.id);
      if (requestError) throw requestError;

      setRequests((items) =>
        items.map((item) =>
          item.id === request.id ? { ...item, durum: nextStatus } : item,
        ),
      );
      if (nextStatus === "onaylandi") {
        setProfiles((items) =>
          items.map((item) =>
            item.id === request.kullanici_id ? { ...item, rol: "hoca" } : item,
          ),
        );
      }
      setRequestMessage(nextStatus === "onaylandi" ? "Hoca başvurusu onaylandı." : "Hoca başvurusu reddedildi.");
    } catch (error) {
      setRequestMessage(error instanceof Error ? error.message : "Başvuru güncellenemedi.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <DashboardLayout
      accent="blue"
      sidebar={
        <div>
          <p className="text-lg font-extrabold text-blue-200">Admin Menüsü</p>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-1">
            <SidebarButton active={activeTab === "ozet"} count={profiles.length} label="Ana Sayfa" onClick={() => setActiveTab("ozet")} />
            <SidebarButton active={activeTab === "kullanicilar"} count={profiles.length} label="Kullanıcılar" onClick={() => setActiveTab("kullanicilar")} />
            <SidebarButton active={activeTab === "basvurular"} count={waitingRequestCount} label="Hoca başvuruları" onClick={() => setActiveTab("basvurular")} />
          </div>
        </div>
      }
      subtitle="Yönetici Paneli"
      title={`Merhaba ${adminName}!`}
    >
      {message ? <p className="text-slate-300">{message}</p> : null}

      {activeTab === "ozet" && (
        <Panel title="Ana Sayfa">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Toplam kullanıcı" value={profiles.length} />
            <Metric label="Sporcu" value={athleteCount} />
            <Metric label="Hoca" value={coachCount} />
            <Metric label="Bekleyen başvuru" value={waitingRequestCount} />
          </div>
        </Panel>
      )}

      {activeTab === "kullanicilar" && (
        <Panel title="Kullanıcılar">
          {userMessage ? <Status text={userMessage} /> : null}
          <ProfileList
            activeTab={userTab}
            disabled={isDeleting}
            onDelete={deleteProfile}
            onTabChange={setUserTab}
            profiles={profiles}
          />
        </Panel>
      )}

      {activeTab === "basvurular" && (
        <Panel title="Hoca başvuruları">
          {requestMessage ? <Status text={requestMessage} /> : null}
          <RequestList
            disabled={isDeleting}
            onUpdate={updateRoleRequest}
            requests={requests}
          />
        </Panel>
      )}
    </DashboardLayout>
  );
}

function SidebarButton({ active, count, label, onClick }: { active: boolean; count: number; label: string; onClick: () => void }) {
  return (
    <button
      className={`flex min-h-12 w-full items-center justify-center gap-3 rounded-md px-3 text-center text-sm font-bold transition lg:justify-between lg:px-4 lg:text-left ${
        active ? "bg-blue-400 text-blue-950" : "text-slate-300 hover:bg-white/10"
      }`}
      onClick={onClick}
      type="button"
    >
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className={`shrink-0 rounded-md px-2 py-1 text-xs ${active ? "bg-blue-950/15" : "bg-white/10"}`}>{count}</span>
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

function ProfileList({
  activeTab,
  disabled,
  onDelete,
  onTabChange,
  profiles,
}: {
  activeTab: UserTab;
  disabled: boolean;
  onDelete: (profile: Profile) => void;
  onTabChange: (tab: UserTab) => void;
  profiles: Profile[];
}) {
  const athletes = profiles.filter((profile) => profile.rol === "sporcu");
  const coaches = profiles.filter((profile) => profile.rol === "hoca");
  const visibleProfiles = activeTab === "sporcu" ? athletes : coaches;

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        <button
          className={`h-9 rounded-md px-3 text-xs font-bold transition ${
            activeTab === "sporcu"
              ? "bg-blue-400 text-blue-950"
              : "bg-white/[0.06] text-slate-200 hover:bg-white/10"
          }`}
          onClick={() => onTabChange("sporcu")}
          type="button"
        >
          Sporcular ({athletes.length})
        </button>
        <button
          className={`h-9 rounded-md px-3 text-xs font-bold transition ${
            activeTab === "hoca"
              ? "bg-blue-400 text-blue-950"
              : "bg-white/[0.06] text-slate-200 hover:bg-white/10"
          }`}
          onClick={() => onTabChange("hoca")}
          type="button"
        >
          Hocalar ({coaches.length})
        </button>
      </div>

      {visibleProfiles.length ? (
        <div className="space-y-3">
          {visibleProfiles.map((profile) => (
            <div className="min-w-0 rounded-md bg-white/[0.05] p-3" key={profile.id}>
              <p className="font-semibold">{profile.ad_soyad || "İsimsiz kullanıcı"}</p>
              <p className="break-words text-sm text-slate-300">
                {profile.email || "-"} - {profile.rol || "-"}
              </p>
              <button
                className="mt-3 h-9 rounded-md border border-white/15 px-3 text-sm font-bold text-slate-200 transition hover:border-rose-300 hover:bg-rose-400 hover:text-rose-950 disabled:opacity-60"
                disabled={disabled}
                onClick={() => onDelete(profile)}
                type="button"
              >
                Sil
              </button>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState text={activeTab === "sporcu" ? "Sporcu bulunmuyor." : "Hoca bulunmuyor."} />
      )}
    </div>
  );
}
function RequestList({
  disabled,
  onUpdate,
  requests,
}: {
  disabled: boolean;
  onUpdate: (request: RoleRequest, nextStatus: "onaylandi" | "reddedildi") => void;
  requests: RoleRequest[];
}) {
  if (!requests.length) return <EmptyState text="Başvuru bulunmuyor." />;

  return (
    <div className="space-y-3">
      {requests.map((request) => (
        <div className="min-w-0 rounded-md bg-white/[0.05] p-3" key={request.id}>
          <p className="font-semibold">{request.profil?.ad_soyad || "İsimsiz kullanıcı"}</p>
          <p className="break-words text-sm text-slate-300">
            {request.profil?.email || "-"} - {request.durum || "-"}
          </p>
          {request.durum === "bekliyor" ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                className="h-9 rounded-md bg-emerald-400 px-3 text-sm font-bold text-emerald-950 transition hover:bg-emerald-300 disabled:opacity-60"
                disabled={disabled}
                onClick={() => onUpdate(request, "onaylandi")}
                type="button"
              >
                Onayla
              </button>
              <button
                className="h-9 rounded-md border border-white/15 px-3 text-sm font-bold text-slate-200 transition hover:border-rose-300 hover:bg-rose-400 hover:text-rose-950 disabled:opacity-60"
                disabled={disabled}
                onClick={() => onUpdate(request, "reddedildi")}
                type="button"
              >
                Reddet
              </button>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function Status({ text }: { text: string }) {
  return (
    <p className="mb-4 rounded-md border border-blue-300/30 bg-blue-300/10 p-3 text-sm font-semibold text-blue-50">
      {text}
    </p>
  );
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
    <section className="min-w-0 rounded-lg border border-white/10 bg-white/[0.05] p-4 sm:p-5">
      <h2 className="text-xl font-bold">{title}</h2>
      <div className="mt-4 max-h-[520px] overflow-auto pr-1">{children}</div>
    </section>
  );
}

function normalizeRole(role: string | null | undefined) {
  return (role || "")
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replaceAll("ı", "i")
    .replaceAll("ö", "o")
    .replaceAll("ü", "u");
}

function isAdminRole(role: string | null | undefined) {
  const normalizedRole = normalizeRole(role);
  return normalizedRole === "admin" || normalizedRole === "yonetici";
}
