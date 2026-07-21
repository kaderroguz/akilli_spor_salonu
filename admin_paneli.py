import json
import html
import base64
from datetime import datetime, timedelta
from pathlib import Path

import extra_streamlit_components as stx
import pandas as pd
import streamlit as st
from supabase import create_client


st.set_page_config(
    page_title="Akıllı Spor Salonu - Admin",
    page_icon="🛡️",
    layout="wide",
)

arkaplan_dosyasi = Path(__file__).with_name("admin_panel_arka_plan.jpg")
arkaplan_verisi = base64.b64encode(arkaplan_dosyasi.read_bytes()).decode("utf-8")

_cookie_manager = stx.CookieManager(key="admin_cerezleri")


def yeni_istemci():
    istemci = create_client(st.secrets["SUPABASE_URL"], st.secrets["SUPABASE_KEY"])
    access = st.session_state.get("admin_access_token")
    refresh = st.session_state.get("admin_refresh_token")
    if access and refresh:
        istemci.auth.set_session(access, refresh)
    return istemci


def oturumu_kaydet(oturum):
    st.session_state.admin_access_token = oturum.access_token
    st.session_state.admin_refresh_token = oturum.refresh_token
    _cookie_manager.set(
        "akilli_spor_admin_oturumu",
        json.dumps({
            "access_token": oturum.access_token,
            "refresh_token": oturum.refresh_token,
        }),
        expires_at=datetime.now() + timedelta(days=14),
        same_site="lax",
    )


def oturumu_yukle():
    if st.session_state.get("admin_access_token"):
        return True
    ham = _cookie_manager.get("akilli_spor_admin_oturumu")
    if not ham:
        return False
    try:
        veri = json.loads(ham)
        st.session_state.admin_access_token = veri["access_token"]
        st.session_state.admin_refresh_token = veri["refresh_token"]
        return True
    except Exception:
        return False


def cikis_yap():
    st.session_state.pop("admin_access_token", None)
    st.session_state.pop("admin_refresh_token", None)
    st.session_state.pop("admin_kullanici", None)
    try:
        _cookie_manager.delete("akilli_spor_admin_oturumu")
    except Exception:
        pass


st.markdown("""
<style>
.stApp, [data-testid="stAppViewContainer"] {
  background:
    radial-gradient(circle at 8% 4%, rgba(56,189,248,.18), transparent 22rem),
    radial-gradient(circle at 93% 15%, rgba(99,102,241,.16), transparent 26rem),
    repeating-linear-gradient(135deg, rgba(148,163,184,.075) 0 1px, transparent 1px 22px),
    linear-gradient(145deg, #eef6ff 0%, #f7fbff 48%, #eef2ff 100%);
  background-attachment: fixed;
  color:#172033;
}
[data-testid="stAppViewContainer"]::before {
  content:"";
  position:fixed;
  inset:0;
  pointer-events:none;
  z-index:0;
  opacity:.42;
  background:
    linear-gradient(90deg, transparent 0 48%, rgba(30,41,59,.045) 48% 52%, transparent 52% 100%),
    radial-gradient(ellipse at 50% 105%, rgba(37,99,235,.13), transparent 43%);
}
[data-testid="stAppViewContainer"] > section,
[data-testid="stAppViewContainer"] .main { position:relative; z-index:1; }
[data-testid="stAppViewContainer"] h1,
[data-testid="stAppViewContainer"] h2,
[data-testid="stAppViewContainer"] h3,
[data-testid="stAppViewContainer"] p,
[data-testid="stAppViewContainer"] span { color:#172033; }
[data-testid="stSidebar"] {
  background:
    radial-gradient(circle at 75% 8%, rgba(56,189,248,.22), transparent 12rem),
    linear-gradient(180deg,#0b1220 0%, #172554 55%, #111827 100%);
}
[data-testid="stSidebar"] p,[data-testid="stSidebar"] span,
[data-testid="stSidebar"] label { color:#f8fafc !important; }
.admin-kimlik-karti {
  background:linear-gradient(135deg,#2563eb,#1d4ed8);
  color:#ffffff !important;
  border:1px solid #60a5fa;
  border-radius:14px;
  padding:17px 18px;
  margin:4px 0 14px 0;
  box-shadow:0 8px 20px rgba(37,99,235,.28);
  font-size:1rem;
  font-weight:800;
  line-height:1.35;
}
.admin-kimlik-karti .admin-etiket,
.admin-kimlik-karti .admin-adi {
  color:#ffffff !important;
}
.admin-kimlik-karti .admin-etiket {
  display:block;
  font-size:.78rem;
  letter-spacing:.08em;
  opacity:.88;
  margin-bottom:3px;
}
[data-testid="stButton"] button {
  background:#2563eb !important; color:white !important;
  border:2px solid #1d4ed8 !important; border-radius:10px !important;
  font-weight:700 !important;
}
[data-testid="stButton"] button p,[data-testid="stButton"] button span {
  color:white !important;
}
[data-testid="stButton"] button:hover { background:#1d4ed8 !important; }
[data-baseweb="select"] > div,[data-testid="stTextInput"] input {
  background:white !important; color:#0f172a !important;
  border:2px solid #94a3b8 !important;
}
[data-testid="stMetric"] {
  background:white; border:1px solid #cbd5e1; border-radius:14px;
  padding:15px; box-shadow:0 4px 12px rgba(15,23,42,.08);
}
[data-testid="stAlert"] p,[data-testid="stAlert"] span { color:#0f172a !important; }
</style>
""", unsafe_allow_html=True)


st.markdown(
    """
    <style>
    /* Yönetici paneli: mavi spor salonu arka planı ve saydam cam arayüz. */
    .stApp, [data-testid="stAppViewContainer"] {
        background:
            linear-gradient(115deg, rgba(5, 31, 69, .42), rgba(8, 78, 142, .28)),
            url("data:image/jpeg;base64,__ARKAPLAN_VERISI__") center / cover fixed !important;
        color: #eef8ff !important;
    }
    [data-testid="stHeader"] {
        background: rgba(5, 27, 61, .58) !important;
        border-bottom: 1px solid rgba(186, 230, 253, .32) !important;
        backdrop-filter: blur(16px);
    }
    [data-testid="stSidebar"] {
        background: linear-gradient(180deg, rgba(7, 54, 99, .84), rgba(6, 29, 67, .80)) !important;
        border-right: 1px solid rgba(147, 197, 253, .30) !important;
        backdrop-filter: blur(16px);
    }
    [data-testid="stMain"] { background: transparent !important; }
    [data-testid="stMain"] h1,
    [data-testid="stMain"] h2,
    [data-testid="stMain"] h3,
    [data-testid="stMain"] p,
    [data-testid="stMain"] label,
    [data-testid="stMain"] span { color: #eef8ff !important; }
    [data-testid="stMetric"],
    [data-testid="stVerticalBlockBorderWrapper"],
    [data-testid="stExpander"] {
        background: rgba(6, 31, 67, .62) !important;
        border: 1px solid rgba(147, 197, 253, .46) !important;
        box-shadow: 0 14px 34px rgba(0, 18, 52, .26) !important;
        backdrop-filter: blur(15px);
        -webkit-backdrop-filter: blur(15px);
    }
    [data-testid="stMetric"] { border-top: 3px solid #38bdf8 !important; }
    [data-testid="stMetricLabel"] p { color: #c7e8ff !important; }
    [data-testid="stMetricValue"] { color: #ffffff !important; }
    [data-testid="stTabs"] [data-baseweb="tab-list"] {
        background: rgba(6, 31, 67, .52) !important;
        border: 1px solid rgba(147, 197, 253, .32) !important;
        border-radius: 14px;
        backdrop-filter: blur(12px);
    }
    [data-testid="stTabs"] button { color: #e5f4ff !important; }
    [aria-selected="true"][data-baseweb="tab"] {
        color: #ffffff !important;
        border-bottom-color: #38bdf8 !important;
    }
    .admin-kimlik-karti {
        background: linear-gradient(135deg, rgba(30, 64, 175, .70), rgba(2, 132, 199, .55)) !important;
        border-color: rgba(147, 197, 253, .52) !important;
        backdrop-filter: blur(14px);
    }
    </style>
    """.replace("__ARKAPLAN_VERISI__", arkaplan_verisi),
    unsafe_allow_html=True,
)

if "admin_kullanici" not in st.session_state:
    st.session_state.admin_kullanici = None

if st.session_state.admin_kullanici is None and oturumu_yukle():
    try:
        kullanici = yeni_istemci().auth.get_user().user
        profil = (
            yeni_istemci().table("profiles")
            .select("id,ad_soyad,email,rol")
            .eq("id", str(kullanici.id)).single().execute().data
        )
        if profil and profil["rol"] == "admin":
            st.session_state.admin_kullanici = profil
        else:
            cikis_yap()
    except Exception:
        cikis_yap()

if st.session_state.admin_kullanici is None:
    st.title("🛡️ Admin Girişi")
    eposta = st.text_input("E-posta")
    sifre = st.text_input("Şifre", type="password")
    if st.button("Giriş yap", type="primary"):
        try:
            cevap = yeni_istemci().auth.sign_in_with_password({
                "email": eposta.strip(), "password": sifre,
            })
            oturumu_kaydet(cevap.session)
            profil = (
                yeni_istemci().table("profiles")
                .select("id,ad_soyad,email,rol")
                .eq("id", str(cevap.user.id)).single().execute().data
            )
            if not profil or profil["rol"] != "admin":
                cikis_yap()
                st.error("Bu hesap admin olarak yetkilendirilmemiş.")
            else:
                st.session_state.admin_kullanici = profil
                st.rerun()
        except Exception as hata:
            cikis_yap()
            st.error(f"Giriş yapılamadı: {hata}")
    with st.expander("🔑 Şifremi unuttum"):
        sifre_eposta = st.text_input(
            "Kayıtlı e-posta adresiniz", key="admin_sifre_eposta"
        )
        if st.button("Sıfırlama bağlantısı gönder", key="admin_sifre_sifirla"):
            if "@" not in sifre_eposta:
                st.warning("Geçerli bir e-posta adresi yazın.")
            else:
                try:
                    yeni_istemci().auth.reset_password_for_email(
                        sifre_eposta.strip()
                    )
                    st.success(
                        "Şifre yenileme bağlantısı e-posta adresinize gönderildi."
                    )
                except Exception as hata:
                    st.error(f"Bağlantı gönderilemedi: {hata}")
    st.stop()

admin = st.session_state.admin_kullanici
st.sidebar.markdown(
    '<div class="admin-kimlik-karti">'
    '<span class="admin-etiket">YÖNETİCİ</span>'
    f'<span class="admin-adi">🛡️ {html.escape(admin.get("ad_soyad") or "Admin")}</span>'
    '</div>',
    unsafe_allow_html=True,
)

if st.sidebar.button("Çıkış yap"):
    try:
        yeni_istemci().auth.sign_out()
    except Exception:
        pass
    cikis_yap()
    st.rerun()

st.title("🛡️ Akıllı Spor Salonu - Admin Paneli")
st.caption("Kullanıcı rollerini ve sistem bağlantılarını güvenli biçimde yönetin.")

istemci = yeni_istemci()
profiller = istemci.table("profiles").select("id,ad_soyad,email,rol,created_at,hoca_kodu").order(
    "created_at", desc=True
).execute().data
baglantilar = istemci.table("hoca_sporcu").select(
    "hoca_id,sporcu_id,durum,created_at,"
    "hoca:profiles!hoca_sporcu_hoca_id_fkey(ad_soyad,email),"
    "sporcu:profiles!hoca_sporcu_sporcu_id_fkey(ad_soyad,email)"
).order("created_at", desc=True).execute().data
antrenmanlar = istemci.table("antrenmanlar").select("id", count="exact").execute()
hoca_basvurulari = istemci.table("rol_talepleri").select(
    "id,kullanici_id,durum,created_at,"
    "profil:profiles!rol_talepleri_kullanici_id_fkey(ad_soyad,email)"
).order("created_at", desc=True).execute().data

profil_df = pd.DataFrame(profiller)
if "kullanici_rol_filtresi" not in st.session_state:
    st.session_state.kullanici_rol_filtresi = "tumu"

sayaclar = st.columns(4)
sayaclar[0].metric("Toplam Kullanıcı", len(profiller))
sayaclar[1].metric("Sporcu", int((profil_df["rol"] == "sporcu").sum()) if not profil_df.empty else 0)
sayaclar[2].metric("Hoca", int((profil_df["rol"] == "hoca").sum()) if not profil_df.empty else 0)
sayaclar[3].metric("Antrenman", int(antrenmanlar.count or 0))

filtre_butonlari = st.columns(4)
if filtre_butonlari[0].button("Tüm kullanıcıları göster", use_container_width=True):
    st.session_state.kullanici_rol_filtresi = "tumu"
if filtre_butonlari[1].button("🏃 Sporcuları göster", use_container_width=True):
    st.session_state.kullanici_rol_filtresi = "sporcu"
if filtre_butonlari[2].button("🧑‍🏫 Hocaları göster", use_container_width=True):
    st.session_state.kullanici_rol_filtresi = "hoca"
if filtre_butonlari[3].button("🔗 Bağlantıları aç", use_container_width=True):
    st.session_state.kullanici_rol_filtresi = "baglantilar"

kullanicilar_sekmesi, basvurular_sekmesi, baglantilar_sekmesi = st.tabs([
    "👥 Kullanıcı Yönetimi", "🧑‍🏫 Hoca Başvuruları",
    "🔗 Hoca–Sporcu Bağlantıları"
])

with kullanicilar_sekmesi:
    aktif_filtre = st.session_state.kullanici_rol_filtresi
    if aktif_filtre == "baglantilar":
        st.info("Bağlantıları görüntülemek için üstteki **Hoca–Sporcu Bağlantıları** sekmesine geçin.")
        aktif_filtre = "tumu"
    baslik = {"tumu": "Kullanıcılar", "sporcu": "Sporcular", "hoca": "Hocalar"}[aktif_filtre]
    st.subheader(baslik)
    arama = st.text_input("Ad veya e-posta ile ara")
    filtreli = profiller if aktif_filtre == "tumu" else [
        p for p in profiller if p.get("rol") == aktif_filtre
    ]
    if arama.strip():
        aranan = arama.casefold().strip()
        filtreli = [p for p in profiller if aranan in (
            f"{p.get('ad_soyad','')} {p.get('email','')}".casefold()
        )]

    for profil in filtreli:
        with st.container(border=True):
            bilgi, rol_kolonu, dugme = st.columns([4, 2, 1])
            bilgi.markdown(
                f"**{profil.get('ad_soyad') or '-'}**  \n"
                f"{profil.get('email') or 'E-posta bulunamadı'}"
            )
            mevcut_rol = profil.get("rol", "sporcu")
            if mevcut_rol == "admin":
                rol_kolonu.info("Admin")
            else:
                roller = ["sporcu", "hoca"]
                yeni_rol = rol_kolonu.selectbox(
                    "Rol", roller, index=roller.index(mevcut_rol),
                    key=f"rol-{profil['id']}", label_visibility="collapsed",
                )
                if dugme.button("Kaydet", key=f"rol-kaydet-{profil['id']}"):
                    try:
                        istemci.rpc("admin_rol_degistir", {
                            "hedef_kullanici": profil["id"],
                            "yeni_rol": yeni_rol,
                        }).execute()
                        st.success("Kullanıcı rolü güncellendi.")
                        st.rerun()
                    except Exception as hata:
                        st.error(f"Rol değiştirilemedi: {hata}")

            if aktif_filtre == "hoca":
                hoca_baglantilari = [
                    b for b in baglantilar if b.get("hoca_id") == profil["id"]
                ]
                onayli_sayisi = sum(
                    b.get("durum") == "onaylandi" for b in hoca_baglantilari
                )
                with st.expander(
                    f"👥 Hoca ayrıntıları · {onayli_sayisi} bağlı sporcu",
                    expanded=False,
                ):
                    ozet_1, ozet_2, ozet_3 = st.columns(3)
                    ozet_1.metric("Bağlı sporcu", onayli_sayisi)
                    ozet_2.metric("Toplam istek", len(hoca_baglantilari))
                    ozet_3.metric("Hoca kodu", profil.get("hoca_kodu") or "—")
                    if hoca_baglantilari:
                        ogrenci_listesi = pd.DataFrame([
                            {
                                "Sporcu": (b.get("sporcu") or {}).get("ad_soyad", "-"),
                                "E-posta": (b.get("sporcu") or {}).get("email", "-"),
                                "Bağlantı durumu": b.get("durum", "-"),
                            }
                            for b in hoca_baglantilari
                        ])
                        st.dataframe(ogrenci_listesi, use_container_width=True, hide_index=True)
                    else:
                        st.info("Bu hocanın henüz bağlı öğrencisi yok.")

            if aktif_filtre == "sporcu":
                sporcu_baglantilari = [
                    b for b in baglantilar if b.get("sporcu_id") == profil["id"]
                ]
                onayli_hoca_sayisi = sum(
                    b.get("durum") == "onaylandi" for b in sporcu_baglantilari
                )
                with st.expander(
                    f"🎓 Öğrenci ayrıntıları · {onayli_hoca_sayisi} bağlı hoca",
                    expanded=False,
                ):
                    ozet_1, ozet_2, ozet_3 = st.columns(3)
                    ozet_1.metric("Bağlı hoca", onayli_hoca_sayisi)
                    ozet_2.metric("Toplam istek", len(sporcu_baglantilari))
                    ozet_3.metric("Kayıt tarihi", str(profil.get("created_at") or "—")[:10])
                    if sporcu_baglantilari:
                        hoca_listesi = pd.DataFrame([
                            {
                                "Hoca": (b.get("hoca") or {}).get("ad_soyad", "-"),
                                "E-posta": (b.get("hoca") or {}).get("email", "-"),
                                "Bağlantı durumu": b.get("durum", "-"),
                            }
                            for b in sporcu_baglantilari
                        ])
                        st.dataframe(hoca_listesi, use_container_width=True, hide_index=True)
                    else:
                        st.info("Bu öğrencinin henüz bağlı olduğu hoca yok.")

with basvurular_sekmesi:
    st.subheader("Hoca Başvuruları")
    bekleyenler = [b for b in hoca_basvurulari if b.get("durum") == "bekliyor"]
    if not bekleyenler:
        st.info("Bekleyen hoca başvurusu bulunmuyor.")
    else:
        for basvuru in bekleyenler:
            profil = basvuru.get("profil") or {}
            bilgi, onay_kolonu, red_kolonu = st.columns([5, 1, 1])
            bilgi.info(
                f"{profil.get('ad_soyad', '-')}  •  "
                f"{profil.get('email', 'E-posta bulunamadı')}"
            )
            if onay_kolonu.button("Onayla", key=f"hoca-onay-{basvuru['id']}"):
                try:
                    istemci.rpc("admin_hoca_basvurusu_sonuclandir", {
                        "talep_no": int(basvuru["id"]), "onay": True,
                    }).execute()
                    st.success("Başvuru onaylandı; kullanıcı artık hoca.")
                    st.rerun()
                except Exception as hata:
                    st.error(f"Başvuru onaylanamadı: {hata}")
            if red_kolonu.button("Reddet", key=f"hoca-red-{basvuru['id']}"):
                try:
                    istemci.rpc("admin_hoca_basvurusu_sonuclandir", {
                        "talep_no": int(basvuru["id"]), "onay": False,
                    }).execute()
                    st.warning("Hoca başvurusu reddedildi.")
                    st.rerun()
                except Exception as hata:
                    st.error(f"Başvuru reddedilemedi: {hata}")

    incelenenler = [b for b in hoca_basvurulari if b.get("durum") != "bekliyor"]
    if incelenenler:
        st.markdown("#### Geçmiş başvurular")
        gecmis = pd.DataFrame([{
            "Ad Soyad": (b.get("profil") or {}).get("ad_soyad", "-"),
            "E-posta": (b.get("profil") or {}).get("email", "-"),
            "Durum": "Onaylandı" if b.get("durum") == "onaylandi" else "Reddedildi",
        } for b in incelenenler])
        st.dataframe(gecmis, use_container_width=True, hide_index=True)

with baglantilar_sekmesi:
    st.subheader("Hoca–Sporcu Bağlantı Bulucu")
    if not baglantilar:
        st.info("Henüz hoca–sporcu bağlantısı bulunmuyor.")
    else:
        hoca_secenekleri = {"Tüm hocalar": ""}
        sporcu_secenekleri = {"Tüm sporcular": ""}
        for baglanti in baglantilar:
            hoca = baglanti.get("hoca") or {}
            sporcu = baglanti.get("sporcu") or {}
            hoca_secenekleri[f"{hoca.get('ad_soyad', '-')} · {hoca.get('email', '')}"] = baglanti["hoca_id"]
            sporcu_secenekleri[f"{sporcu.get('ad_soyad', '-')} · {sporcu.get('email', '')}"] = baglanti["sporcu_id"]

        hoca_filtre_kolonu, sporcu_filtre_kolonu = st.columns(2)
        secilen_hoca_etiketi = hoca_filtre_kolonu.selectbox("Hocaya göre bul", list(hoca_secenekleri))
        secilen_sporcu_etiketi = sporcu_filtre_kolonu.selectbox("Sporcuya göre bul", list(sporcu_secenekleri))
        secilen_hoca = hoca_secenekleri[secilen_hoca_etiketi]
        secilen_sporcu = sporcu_secenekleri[secilen_sporcu_etiketi]

        filtrelenmis_baglantilar = [
            b for b in baglantilar
            if (not secilen_hoca or b.get("hoca_id") == secilen_hoca)
            and (not secilen_sporcu or b.get("sporcu_id") == secilen_sporcu)
        ]
        if secilen_hoca:
            st.caption(f"{secilen_hoca_etiketi} için bağlı sporcular listeleniyor.")
        elif secilen_sporcu:
            st.caption(f"{secilen_sporcu_etiketi} için bağlı hoca listeleniyor.")

        if not filtrelenmis_baglantilar:
            st.warning("Bu filtreye uygun bağlantı bulunamadı.")
        for baglanti in filtrelenmis_baglantilar:
            hoca = baglanti.get("hoca") or {}
            sporcu = baglanti.get("sporcu") or {}
            bilgi, dugme = st.columns([6, 1])
            bilgi.info(
                f"Hoca: {hoca.get('ad_soyad','-')}  •  "
                f"Sporcu: {sporcu.get('ad_soyad','-')}  •  "
                f"Durum: {baglanti.get('durum','-')}"
            )
            if dugme.button(
                "Kaldır", key=f"baglanti-{baglanti['hoca_id']}-{baglanti['sporcu_id']}"
            ):
                istemci.table("hoca_sporcu").delete().eq(
                    "hoca_id", baglanti["hoca_id"]
                ).eq("sporcu_id", baglanti["sporcu_id"]).execute()
                st.rerun()

if st.sidebar.button("Verileri yenile"):
    st.rerun()