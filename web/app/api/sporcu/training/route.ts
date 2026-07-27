import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

type DeleteTrainingBody = {
  trainingId?: number;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function DELETE(request: Request) {
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

    const body = (await request.json()) as DeleteTrainingBody;
    if (!body.trainingId) {
      return NextResponse.json({ error: "Silinecek antrenman bulunamadi." }, { status: 400 });
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

    const { data: training, error: trainingError } = await serviceClient
      .from("antrenmanlar")
      .select("id,sporcu_id")
      .eq("id", body.trainingId)
      .eq("sporcu_id", authData.user.id)
      .maybeSingle();

    if (trainingError) throw trainingError;
    if (!training) {
      return NextResponse.json({ error: "Silinecek antrenman bulunamadi." }, { status: 404 });
    }

    const { error } = await serviceClient
      .from("antrenmanlar")
      .delete()
      .eq("id", training.id)
      .eq("sporcu_id", training.sporcu_id);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Antrenman silinemedi." },
      { status: 500 },
    );
  }
}
