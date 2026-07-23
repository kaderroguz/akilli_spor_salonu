import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

type DeleteUserBody = {
  userId?: string;
};

type DeleteError = {
  code?: string;
  message?: string;
};

type TableDeleteClient = {
  from: (table: string) => {
    delete: () => {
      eq: (column: string, value: string) => PromiseLike<{ error: DeleteError | null }>;
    };
  };
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(request: Request) {
  try {
    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      return NextResponse.json(
        { error: "SUPABASE_SERVICE_ROLE_KEY server ortam degiskeni gerekli." },
        { status: 500 },
      );
    }

    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) {
      return NextResponse.json({ error: "Oturum bilgisi bulunamadi." }, { status: 401 });
    }

    const body = (await request.json()) as DeleteUserBody;
    if (!body.userId) {
      return NextResponse.json({ error: "Silinecek kullanici bulunamadi." }, { status: 400 });
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: authData, error: authError } = await userClient.auth.getUser(token);
    if (authError || !authData.user) {
      return NextResponse.json({ error: "Oturum dogrulanamadi." }, { status: 401 });
    }

    if (authData.user.id === body.userId) {
      return NextResponse.json({ error: "Admin kendi hesabini silemez." }, { status: 400 });
    }

    const { data: sessionAdminProfile, error: sessionAdminError } = await userClient
      .from("profiles")
      .select("rol")
      .eq("id", authData.user.id)
      .maybeSingle();

    const { data: idAdminProfile, error: idAdminError } = await serviceClient
      .from("profiles")
      .select("rol")
      .eq("id", authData.user.id)
      .maybeSingle();

    let adminRole = (sessionAdminProfile?.rol || idAdminProfile?.rol) as string | null | undefined;
    let adminRoleError = sessionAdminError || idAdminError;

    if (!isAdminRole(adminRole) && authData.user.email) {
      const { data: emailAdminProfile, error: emailAdminError } = await serviceClient
        .from("profiles")
        .select("rol")
        .eq("email", authData.user.email)
        .maybeSingle();

      adminRole = (emailAdminProfile?.rol as string | null | undefined) || adminRole;
      adminRoleError = emailAdminError || adminRoleError;
    }

    if (!isAdminRole(adminRole)) {
      return NextResponse.json(
        {
          error:
            `Bu islemi yalnizca admin/yonetici yapabilir. ` +
            `Aktif oturum: ${authData.user.email || authData.user.id}. ` +
            `Bulunan rol: ${adminRole || "yok"}. ` +
            `Kontrol hatasi: ${adminRoleError?.message || "yok"}.`,
        },
        { status: 403 },
      );
    }

    const { data: serviceTargetProfile, error: serviceTargetError } = await serviceClient
      .from("profiles")
      .select("rol")
      .eq("id", body.userId)
      .maybeSingle();

    const { data: sessionTargetProfile, error: sessionTargetError } = serviceTargetProfile
      ? { data: null, error: null }
      : await userClient
          .from("profiles")
          .select("rol")
          .eq("id", body.userId)
          .maybeSingle();

    const targetProfile = serviceTargetProfile || sessionTargetProfile;
    const targetProfileError = targetProfile ? null : serviceTargetError || sessionTargetError;

    if (targetProfileError || !targetProfile) {
      return NextResponse.json(
        {
          error:
            `Kullanici profili bulunamadi. ` +
            `Silinecek id: ${body.userId}. ` +
            `Kontrol hatasi: ${targetProfileError?.message || "yok"}.`,
        },
        { status: 404 },
      );
    }

    if (!["sporcu", "hoca"].includes(normalizeRole(targetProfile.rol))) {
      return NextResponse.json({ error: "Yalnizca sporcu veya hoca silinebilir." }, { status: 400 });
    }

    await deleteFromTable(serviceClient, "bildirimler", "hoca_id", body.userId);
    await deleteFromTable(serviceClient, "bildirimler", "sporcu_id", body.userId);
    await deleteFromTable(serviceClient, "programlar", "hoca_id", body.userId);
    await deleteFromTable(serviceClient, "programlar", "sporcu_id", body.userId);
    await deleteFromTable(serviceClient, "antrenmanlar", "sporcu_id", body.userId);
    await deleteFromTable(serviceClient, "hoca_sporcu", "hoca_id", body.userId);
    await deleteFromTable(serviceClient, "hoca_sporcu", "sporcu_id", body.userId);
    await deleteFromTable(serviceClient, "rol_talepleri", "kullanici_id", body.userId);

    const { error: deleteAuthError } = await serviceClient.auth.admin.deleteUser(body.userId);
    if (deleteAuthError) {
      return NextResponse.json({ error: formatServiceRoleError(deleteAuthError.message) }, { status: 500 });
    }

    await deleteFromTable(serviceClient, "profiles", "id", body.userId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Kullanici silinemedi." },
      { status: 500 },
    );
  }
}

function normalizeRole(role: string | null | undefined) {
  return (role || "")
    .trim()
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replaceAll("ı", "i");
}

function isAdminRole(role: string | null | undefined) {
  const normalizedRole = normalizeRole(role);
  return normalizedRole === "admin" || normalizedRole === "yonetici";
}

function formatServiceRoleError(message: string) {
  if (message.toLowerCase().includes("invalid api key")) {
    return "SUPABASE_SERVICE_ROLE_KEY gecersiz. Supabase API Keys sayfasindaki service_role secret degerini eksiksiz kopyala ve server'i yeniden baslat.";
  }

  return message;
}

async function deleteFromTable(
  client: TableDeleteClient,
  table: string,
  column: string,
  value: string,
) {
  const { error } = await client.from(table).delete().eq(column, value);
  if (error && error.code !== "42P01" && error.code !== "42703") {
    throw new Error(error.message || `${table} kaydi silinemedi.`);
  }
}
