import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

type ConnectionRequestBody = {
  action?: "accept" | "reject";
  athleteId?: string;
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

    const body = (await request.json()) as ConnectionRequestBody;
    if (!body.athleteId || !body.action) {
      return NextResponse.json({ error: "Istek bilgisi eksik." }, { status: 400 });
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

    const coachId = authData.user.id;
    const { data: coachProfile } = await userClient
      .from("profiles")
      .select("rol")
      .eq("id", coachId)
      .maybeSingle();

    if (coachProfile?.rol !== "hoca") {
      return NextResponse.json({ error: "Bu islemi yalnizca hoca yapabilir." }, { status: 403 });
    }

    const { data: connection, error: connectionError } = await serviceClient
      .from("hoca_sporcu")
      .select("hoca_id,sporcu_id,durum")
      .eq("hoca_id", coachId)
      .eq("sporcu_id", body.athleteId)
      .maybeSingle();

    if (connectionError || !connection) {
      return NextResponse.json({ error: "Sporcu istegi bulunamadi." }, { status: 404 });
    }

    if (body.action === "accept") {
      const { error } = await serviceClient
        .from("hoca_sporcu")
        .update({ durum: "onaylandi" })
        .eq("hoca_id", coachId)
        .eq("sporcu_id", body.athleteId);
      if (error) throw error;

      const { error: notificationError } = await serviceClient.from("bildirimler").insert({
        hoca_id: coachId,
        mesaj: "Hoca istegin kabul edildi.",
        odev_no: 0,
        sporcu_id: body.athleteId,
      });
      if (notificationError) throw notificationError;

      return NextResponse.json({ status: "onaylandi" });
    }

    const { error: notificationError } = await serviceClient.from("bildirimler").insert({
      hoca_id: coachId,
      mesaj: "Hoca istegin reddedildi.",
      odev_no: 0,
      sporcu_id: body.athleteId,
    });
    if (notificationError) throw notificationError;

    const { error } = await serviceClient
      .from("hoca_sporcu")
      .delete()
      .eq("hoca_id", coachId)
      .eq("sporcu_id", body.athleteId);
    if (error) throw error;

    return NextResponse.json({ status: "reddedildi" });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Istek guncellenemedi." },
      { status: 500 },
    );
  }
}
