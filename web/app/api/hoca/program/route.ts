import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

type CreateProgramBody = {
  baslangic_tarihi?: string;
  bitis_tarihi?: string;
  hedef_tekrar?: number;
  hareket?: string;
  notlar?: string;
  odev_no?: number;
  sporcu_id?: string;
  tarih?: string;
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

    const body = (await request.json()) as CreateProgramBody;
    if (!body.sporcu_id || !body.hareket || !body.hedef_tekrar || !body.odev_no || !body.tarih) {
      return NextResponse.json({ error: "Program bilgileri eksik." }, { status: 400 });
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
    const { data: coachProfile } = await serviceClient
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
      .eq("sporcu_id", body.sporcu_id)
      .eq("durum", "onaylandi")
      .maybeSingle();

    if (connectionError || !connection) {
      return NextResponse.json({ error: "Bu sporcu hoca hesabina onayli bagli degil." }, { status: 403 });
    }

    const payload = {
      baslangic_tarihi: body.baslangic_tarihi || body.tarih,
      bitis_tarihi: body.bitis_tarihi || body.tarih,
      durum: "planlandi",
      hedef_tekrar: body.hedef_tekrar,
      hoca_id: coachId,
      hareket: body.hareket,
      notlar: body.notlar || "",
      odev_no: body.odev_no,
      sporcu_id: body.sporcu_id,
      tarih: body.tarih,
    };

    let { data, error } = await serviceClient
      .from("programlar")
      .insert(payload)
      .select("id,sporcu_id,odev_no,hareket,hedef_tekrar,notlar,durum,tarih,baslangic_tarihi,bitis_tarihi")
      .single();

    if (error && body.hareket) {
      const fallbackExercise = dbExerciseName(body.hareket);
      if (fallbackExercise !== body.hareket) {
        const retry = await serviceClient
          .from("programlar")
          .insert({ ...payload, hareket: fallbackExercise })
          .select("id,sporcu_id,odev_no,hareket,hedef_tekrar,notlar,durum,tarih,baslangic_tarihi,bitis_tarihi")
          .single();
        data = retry.data;
        error = retry.error;
      }
    }

    if (error) throw error;

    return NextResponse.json({ program: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Program atanamadi." },
      { status: 500 },
    );
  }
}

function dbExerciseName(value: string) {
  const map: Record<string, string> = {
    "Aç-Kapa Zıplama": "AÃ§-Kapa ZÄ±plama",
    "Gövde Çevirme": "GÃ¶vde Ã‡evirme",
    "Şınav": "ÅÄ±nav",
  };
  return map[value] || value;
}
