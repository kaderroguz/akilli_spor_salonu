import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

type DeleteNotificationBody = {
  notificationId?: number;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function DELETE(request: Request) {
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

    const body = (await request.json()) as DeleteNotificationBody;
    if (!body.notificationId) {
      return NextResponse.json({ error: "Silinecek bildirim bulunamadi." }, { status: 400 });
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

    const { data: coachProfile, error: coachError } = await dbClient
      .from("profiles")
      .select("rol")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (coachError) throw coachError;
    if (coachProfile?.rol !== "hoca") {
      return NextResponse.json({ error: "Bu islemi yalnizca hoca yapabilir." }, { status: 403 });
    }

    const { data: notification, error: notificationError } = await dbClient
      .from("bildirimler")
      .select("id,hoca_id")
      .eq("id", body.notificationId)
      .eq("hoca_id", authData.user.id)
      .maybeSingle();

    if (notificationError) throw notificationError;
    if (!notification) {
      return NextResponse.json({ error: "Silinecek bildirim bulunamadi." }, { status: 404 });
    }

    const { error } = await dbClient
      .from("bildirimler")
      .delete()
      .eq("id", notification.id)
      .eq("hoca_id", notification.hoca_id);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Bildirim silinemedi." },
      { status: 500 },
    );
  }
}
