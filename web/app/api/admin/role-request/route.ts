import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

type RoleRequestBody = {
  action?: "accept" | "reject";
  requestId?: number;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(request: Request) {
  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: "Supabase server ortam degiskenleri eksik." },
        { status: 500 },
      );
    }

    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) {
      return NextResponse.json({ error: "Oturum bilgisi bulunamadi." }, { status: 401 });
    }

    const body = (await request.json()) as RoleRequestBody;
    if (!body.requestId || !body.action) {
      return NextResponse.json({ error: "Basvuru bilgisi eksik." }, { status: 400 });
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const dbClient = supabaseServiceRoleKey
      ? createClient(supabaseUrl, supabaseServiceRoleKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        })
      : userClient;

    const { data: authData, error: authError } = await userClient.auth.getUser(token);
    if (authError || !authData.user) {
      return NextResponse.json({ error: "Oturum dogrulanamadi." }, { status: 401 });
    }

    const { data: adminProfile, error: adminError } = await dbClient
      .from("profiles")
      .select("rol")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (adminError) throw adminError;
    if (!isAdminRole(adminProfile?.rol)) {
      return NextResponse.json({ error: "Bu islemi yalnizca admin/yonetici yapabilir." }, { status: 403 });
    }

    const { data: roleRequest, error: requestError } = await dbClient
      .from("rol_talepleri")
      .select("id,kullanici_id,durum")
      .eq("id", body.requestId)
      .maybeSingle();

    if (requestError) throw requestError;
    if (!roleRequest) {
      return NextResponse.json({ error: "Basvuru bulunamadi." }, { status: 404 });
    }
    if (roleRequest.durum !== "bekliyor") {
      return NextResponse.json({ error: "Bu basvuru zaten guncellenmis." }, { status: 409 });
    }

    const nextStatus = body.action === "accept" ? "onaylandi" : "reddedildi";

    if (body.action === "accept") {
      const { error: profileError } = await dbClient
        .from("profiles")
        .update({ rol: "hoca" })
        .eq("id", roleRequest.kullanici_id);
      if (profileError) throw profileError;
    }

    const { error: updateError } = await dbClient
      .from("rol_talepleri")
      .update({ durum: nextStatus })
      .eq("id", roleRequest.id);

    if (updateError) throw updateError;

    return NextResponse.json({ ok: true, status: nextStatus });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Basvuru guncellenemedi." },
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
    .replaceAll("ı", "i")
    .replaceAll("Ä±", "i");
}

function isAdminRole(role: string | null | undefined) {
  const normalizedRole = normalizeRole(role);
  return normalizedRole === "admin" || normalizedRole === "yonetici";
}
