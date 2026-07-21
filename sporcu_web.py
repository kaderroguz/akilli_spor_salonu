import os
import json
import threading
import time
import base64
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import av
import altair as alt
import cv2
import joblib
import mediapipe as mp
import numpy as np
import pandas as pd
import extra_streamlit_components as stx
import streamlit as st
import streamlit.components.v1 as components
from streamlit_webrtc import VideoProcessorBase, WebRtcMode, webrtc_streamer
from supabase import create_client


st.set_page_config(
    page_title="Akıllı Spor Salonu",
    page_icon="🏋️",
    layout="wide",
)

# Arka plan görseli, uygulama hangi klasörden çalıştırılırsa çalıştırılsın
# bu dosyanın yanından okunur.
arkaplan_dosyasi = Path(__file__).with_name("sporcu_panel_flu_arka_plan.png")
arkaplan_verisi = base64.b64encode(arkaplan_dosyasi.read_bytes()).decode("utf-8")

# Sporcu panelinin genel görsel kimliği. Bu bölüm yalnızca arayüzü değiştirir;
# kamera, model, Supabase ve ödev işlemlerine dokunmaz.
st.markdown(
    """
    <style>
    :root {
        --sporcu-koyu: #082f49;
        --sporcu-ana: #0891b2;
        --sporcu-acik: #22d3ee;
        --sporcu-mavi: #2563eb;
        --sporcu-zemin: #f0f9ff;
        --sporcu-yazi: #102a43;
    }
    .stApp {
        background:
            radial-gradient(circle at 88% 8%, rgba(34,211,238,.15), transparent 24rem),
            linear-gradient(145deg, #f8fdff 0%, var(--sporcu-zemin) 52%, #eef6ff 100%);
        color: var(--sporcu-yazi);
    }
    [data-testid="stHeader"] {
        background: rgba(248,253,255,.86);
        border-bottom: 1px solid rgba(8,145,178,.14);
        backdrop-filter: blur(12px);
    }
    .block-container {
        max-width: 1380px;
        padding-top: 2rem;
        padding-bottom: 4rem;
    }
    .sporcu-hero {
        position: relative;
        overflow: hidden;
        margin: .25rem 0 1.35rem;
        padding: 1.55rem 1.8rem;
        border: 1px solid rgba(34,211,238,.45);
        border-radius: 24px;
        background: linear-gradient(120deg, #083344 0%, #0e7490 58%, #2563eb 130%);
        box-shadow: 0 18px 45px rgba(8,47,73,.18);
    }
    .sporcu-hero::after {
        content: "";
        position: absolute;
        width: 220px; height: 220px;
        right: -55px; top: -100px;
        border-radius: 50%;
        background: rgba(255,255,255,.12);
    }
    .sporcu-hero h1 {
        margin: 0 !important;
        color: white !important;
        font-size: clamp(1.8rem, 4vw, 3rem) !important;
        letter-spacing: -.03em;
    }
    .sporcu-hero p {
        margin: .45rem 0 0 !important;
        color: #cffafe !important;
        font-size: 1.03rem;
    }
    .sporcu-hero .etiket {
        display: inline-block;
        margin-bottom: .6rem;
        padding: .28rem .72rem;
        color: #ecfeff;
        background: rgba(255,255,255,.14);
        border: 1px solid rgba(255,255,255,.22);
        border-radius: 999px;
        font-size: .78rem;
        font-weight: 800;
        letter-spacing: .08em;
    }
    .sporcu-giris-baslik {
        text-align: center;
        padding: 12px 8px 18px;
    }
    .sporcu-giris-ikon {
        width: 76px;
        height: 76px;
        margin: 0 auto 10px;
        display: grid;
        place-items: center;
        border-radius: 22px;
        font-size: 38px;
        background: linear-gradient(135deg, #0891b2, #2563eb);
        box-shadow: 0 12px 28px rgba(37, 99, 235, .24);
    }
    .sporcu-giris-baslik h1 {
        margin: 0;
        color: #082f49 !important;
        font-size: 2.15rem;
    }
    .sporcu-giris-baslik p {
        margin: 8px 0 0;
        color: #52677a !important;
        font-size: 1rem;
    }
    [data-testid="stVerticalBlockBorderWrapper"] {
        background: rgba(255,255,255,.96);
        border: 1px solid #bae6fd !important;
        border-radius: 24px !important;
        box-shadow: 0 18px 48px rgba(8,47,73,.13);
    }
    /* Giriş ekranı */
    [data-testid="stForm"],
    [data-testid="stExpander"] {
        border: 1px solid #bae6fd !important;
        border-radius: 16px !important;
        box-shadow: 0 10px 28px rgba(8,47,73,.07) !important;
    }
    button[kind="primary"] {
        background: linear-gradient(135deg, var(--sporcu-ana), var(--sporcu-mavi)) !important;
        border: 0 !important;
        color: white !important;
        font-weight: 800 !important;
        box-shadow: 0 8px 20px rgba(8,145,178,.25) !important;
    }
    /* Giriş ve kayıt ekranındaki bütün alanları açık ve okunaklı tut */
    [data-testid="stWidgetLabel"] p,
    [data-testid="stWidgetLabel"] span,
    [data-testid="stTextInput"] label p,
    [data-testid="stSelectbox"] label p {
        color: #0f2942 !important;
        font-weight: 750 !important;
        opacity: 1 !important;
    }
    [data-testid="stTextInput"] input,
    [data-testid="stTextInput"] input[type="password"],
    [data-testid="stNumberInput"] input,
    [data-baseweb="select"] > div {
        min-height: 48px !important;
        background: #ffffff !important;
        color: #0f172a !important;
        -webkit-text-fill-color: #0f172a !important;
        caret-color: #0891b2 !important;
        border: 2px solid #7dd3fc !important;
        border-radius: 12px !important;
        opacity: 1 !important;
        box-shadow: 0 5px 14px rgba(8,145,178,.07) !important;
    }
    [data-testid="stTextInput"] input::placeholder {
        color: #64748b !important;
        -webkit-text-fill-color: #64748b !important;
        opacity: 1 !important;
    }
    [data-testid="stTextInput"] input:focus,
    [data-baseweb="select"] > div:focus-within {
        border-color: #0891b2 !important;
        box-shadow: 0 0 0 4px rgba(34,211,238,.18) !important;
    }
    [data-testid="stTextInput"] button,
    [data-testid="stTextInput"] button svg {
        color: #0e7490 !important;
        fill: #0e7490 !important;
        stroke: #0e7490 !important;
        opacity: 1 !important;
    }
    [data-baseweb="select"] span,
    [data-baseweb="select"] input,
    [data-baseweb="select"] svg {
        color: #0f172a !important;
        fill: #0f172a !important;
        opacity: 1 !important;
    }
    [role="listbox"] { background: #ffffff !important; }
    [role="option"] { color: #0f172a !important; background: #ffffff !important; }
    [role="option"]:hover { background: #cffafe !important; }
    [data-baseweb="tab-list"] {
        gap: .4rem;
        padding: .35rem;
        background: rgba(255,255,255,.9);
        border: 1px solid #bae6fd;
        border-radius: 14px;
        box-shadow: 0 8px 22px rgba(8,47,73,.06);
    }
    [data-baseweb="tab"] {
        padding: .55rem 1rem !important;
        border-radius: 10px !important;
        color: #334155 !important;
        font-weight: 800 !important;
    }
    [data-baseweb="tab"] p,
    [data-baseweb="tab"] span { color: #334155 !important; opacity: 1 !important; }
    [aria-selected="true"][data-baseweb="tab"] {
        background: linear-gradient(135deg, #0891b2, #2563eb) !important;
    }
    [aria-selected="true"][data-baseweb="tab"] p,
    [aria-selected="true"][data-baseweb="tab"] span { color: #ffffff !important; }
    [data-testid="stButton"] button {
        min-height: 46px !important;
        background: linear-gradient(135deg, #0891b2, #2563eb) !important;
        color: #ffffff !important;
        border: 1px solid rgba(255,255,255,.25) !important;
        border-radius: 12px !important;
        font-weight: 800 !important;
        box-shadow: 0 8px 20px rgba(8,145,178,.24) !important;
    }
    [data-testid="stButton"] button p,
    [data-testid="stButton"] button span { color: #ffffff !important; }
    [data-testid="stButton"] button:hover {
        background: linear-gradient(135deg, #0e7490, #1d4ed8) !important;
        transform: translateY(-1px);
    }
    [data-testid="stAlert"] {
        border-radius: 13px !important;
        border: 1px solid #bae6fd !important;
    }
    [data-testid="stAlert"] p,
    [data-testid="stAlert"] span { color: #0f2942 !important; opacity: 1 !important; }
    .hareket-rehberi {
        padding: 1.05rem 1.1rem;
        margin-bottom: .8rem;
        border: 1px solid #a5f3fc;
        border-radius: 18px;
        background: linear-gradient(145deg, #ecfeff, #eff6ff);
        box-shadow: 0 12px 28px rgba(8,47,73,.09);
    }
    /* Kamera bileşeni bulunduğu kolondan taşmasın. */
    [data-testid="stIFrame"],
    [data-testid="stIFrame"] iframe {
        width: 100% !important;
        max-width: 100% !important;
    }
    .hareket-rehberi h3 {
        margin: 0 0 .25rem;
        color: #082f49 !important;
    }
    .hareket-hedefi {
        display: inline-block;
        margin: .35rem 0 .8rem;
        padding: .28rem .68rem;
        border-radius: 999px;
        color: #075985;
        background: #bae6fd;
        font-weight: 800;
    }
    .rehber-adimi {
        display: flex;
        gap: .65rem;
        align-items: flex-start;
        margin: .55rem 0;
        color: #17324d;
        line-height: 1.42;
    }
    .rehber-numara {
        flex: 0 0 1.65rem;
        height: 1.65rem;
        display: grid;
        place-items: center;
        border-radius: 50%;
        color: white;
        background: linear-gradient(135deg, #0891b2, #2563eb);
        font-size: .8rem;
        font-weight: 900;
    }
    @media (max-width: 720px) {
        .block-container { padding: 1rem .85rem 3rem; }
        .sporcu-hero { padding: 1.25rem; border-radius: 18px; }
        .hareket-rehberi { padding: .9rem; }
    }
    </style>
    """,
    unsafe_allow_html=True,
)

st.markdown(
    """
    <style>
    :root { --gym-bg: url("data:image/png;base64,__ARKAPLAN_VERISI__"); }
    /* Giriş ekranı: koyu spor salonu arka planı ve saydam cam form */
    .stApp, [data-testid="stAppViewContainer"] {
        background:
            linear-gradient(115deg, rgba(3, 13, 27, .78), rgba(4, 42, 70, .66)),
            url("data:image/png;base64,__ARKAPLAN_VERISI__") center / cover fixed !important;
        color: #eefbff;
    }
    [data-testid="stHeader"] {
        background: rgba(4, 18, 32, .64) !important;
        border-bottom: 1px solid rgba(125, 211, 252, .18) !important;
        backdrop-filter: blur(16px);
    }
    .sporcu-giris-baslik h1 { color: #ffffff !important; text-shadow: 0 3px 16px rgba(0,0,0,.52); }
    .sporcu-giris-baslik p { color: #d8edf6 !important; }
    [data-testid="stVerticalBlockBorderWrapper"],
    [data-testid="stForm"],
    [data-testid="stExpander"] {
        background: rgba(7, 25, 42, .72) !important;
        border: 1px solid rgba(125, 211, 252, .28) !important;
        box-shadow: 0 18px 45px rgba(0, 0, 0, .30) !important;
        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
    }
    [data-testid="stWidgetLabel"] p,
    [data-testid="stWidgetLabel"] span,
    [data-testid="stTextInput"] label p,
    [data-testid="stSelectbox"] label p { color: #e0f2fe !important; }
    [data-baseweb="tab-list"] {
        background: rgba(7, 25, 42, .74) !important;
        border-color: rgba(125, 211, 252, .24) !important;
        backdrop-filter: blur(12px);
    }
    </style>
    """.replace("__ARKAPLAN_VERISI__", arkaplan_verisi),
    unsafe_allow_html=True,
)

_cookie_manager = stx.CookieManager(key="sporcu_cerezleri")


def yeni_istemci():
    istemci = create_client(st.secrets["SUPABASE_URL"], st.secrets["SUPABASE_KEY"])
    access = st.session_state.get("sb_access_token")
    refresh = st.session_state.get("sb_refresh_token")
    if access and refresh:
        istemci.auth.set_session(access, refresh)
    return istemci


def oturumu_kaydet(oturum, panel="sporcu"):
    st.session_state.sb_access_token = oturum.access_token
    st.session_state.sb_refresh_token = oturum.refresh_token
    _cookie_manager.set(
        f"akilli_spor_{panel}_oturumu",
        json.dumps({"access_token": oturum.access_token, "refresh_token": oturum.refresh_token}),
        expires_at=datetime.now() + timedelta(days=14),
        same_site="lax",
    )


def oturumu_cerezden_yukle(panel="sporcu"):
    if st.session_state.get("sb_access_token") and st.session_state.get("sb_refresh_token"):
        return True
    ham = _cookie_manager.get(f"akilli_spor_{panel}_oturumu")
    if not ham:
        return False
    try:
        veri = json.loads(ham)
        st.session_state.sb_access_token = veri["access_token"]
        st.session_state.sb_refresh_token = veri["refresh_token"]
        return True
    except Exception:
        return False


def oturumu_temizle(panel="sporcu"):
    st.session_state.pop("sb_access_token", None)
    st.session_state.pop("sb_refresh_token", None)
    try:
        _cookie_manager.delete(f"akilli_spor_{panel}_oturumu")
    except Exception:
        pass


if "sporcu_kullanici" not in st.session_state:
    st.session_state.sporcu_kullanici = None

if st.session_state.sporcu_kullanici is None and oturumu_cerezden_yukle("sporcu"):
    try:
        kullanici_cevabi = yeni_istemci().auth.get_user()
        profil = (
            yeni_istemci().table("profiles").select("id, ad_soyad, rol")
            .eq("id", str(kullanici_cevabi.user.id)).single().execute().data
        )
        if profil and profil["rol"] == "sporcu":
            profil["email"] = kullanici_cevabi.user.email
            st.session_state.sporcu_kullanici = profil
    except Exception:
        oturumu_temizle("sporcu")

if st.session_state.sporcu_kullanici is None:
    sol, orta, sag = st.columns([1, 1.15, 1])
    with orta:
        with st.container(border=True):
            st.markdown(
                """
                <div class="sporcu-giris-baslik">
                    <div class="sporcu-giris-ikon">🏃</div>
                    <h1>Sporcu Girişi</h1>
                    <p>Antrenmanlarını takip etmek ve hedeflerine ulaşmak için giriş yap.</p>
                </div>
                """,
                unsafe_allow_html=True,
            )
            kayit_modu = str(st.query_params.get("kayit", "0")) == "1"
            if kayit_modu:
                kayit_sekmesi, giris_sekmesi = st.tabs(["Kayıt Ol", "Giriş Yap"])
            else:
                giris_sekmesi, kayit_sekmesi = st.tabs(["Giriş Yap", "Kayıt Ol"])

            with giris_sekmesi:
                giris_adi = st.text_input(
                    "E-posta",
                    placeholder="ornek@eposta.com",
                    key="sporcu_giris_adi",
                )
                giris_sifre = st.text_input(
                    "Şifre",
                    type="password",
                    placeholder="Şifrenizi girin",
                    key="sporcu_giris_sifre",
                )
                if st.button(
                    "Giriş yap", type="primary", use_container_width=True,
                    key="sporcu_giris_butonu",
                ):
                    try:
                        cevap = yeni_istemci().auth.sign_in_with_password({
                            "email": giris_adi.strip(),
                            "password": giris_sifre,
                        })
                        oturumu_kaydet(cevap.session, "sporcu")
                        profil = (
                            yeni_istemci().table("profiles")
                            .select("id, ad_soyad, rol")
                            .eq("id", str(cevap.user.id)).single().execute().data
                        )
                        if profil["rol"] != "sporcu":
                            oturumu_temizle("sporcu")
                            st.error("Bu hesap sporcu hesabı değil.")
                        else:
                            profil["email"] = giris_adi.strip()
                            st.session_state.sporcu_kullanici = profil
                            st.rerun()
                    except Exception as hata:
                        oturumu_temizle("sporcu")
                        st.error(f"Giriş hatası: {hata}")

                with st.expander("🔑 Şifremi unuttum"):
                    sifre_eposta = st.text_input(
                        "Kayıtlı e-posta adresiniz",
                        placeholder="ornek@eposta.com",
                        key="sporcu_sifre_eposta",
                    )
                    if st.button(
                        "Sıfırlama bağlantısı gönder",
                        use_container_width=True,
                        key="sporcu_sifre_sifirla",
                    ):
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

            with kayit_sekmesi:
                yeni_ad = st.text_input(
                    "Ad soyad", placeholder="Adınız ve soyadınız", key="yeni_ad"
                )
                yeni_kullanici = st.text_input(
                    "E-posta", placeholder="ornek@eposta.com", key="yeni_kullanici"
                )
                yeni_sifre = st.text_input(
                    "Şifre (en az 6 karakter)", type="password",
                    placeholder="En az 6 karakter", key="yeni_sifre"
                )
                hesap_turu = st.selectbox(
                    "Hesap türü",
                    ["Sporcu", "Hoca adayı"],
                    help="Hoca adaylarının hesabı admin onayından sonra hoca hesabına dönüşür.",
                )
                if st.button("Hesap oluştur", use_container_width=True):
                    try:
                        cevap = yeni_istemci().auth.sign_up({
                            "email": yeni_kullanici.strip(),
                            "password": yeni_sifre,
                            "options": {"data": {
                                "ad_soyad": yeni_ad.strip(),
                                "hesap_turu": "hoca" if hesap_turu == "Hoca adayı" else "sporcu",
                            }},
                        })
                        if hesap_turu == "Hoca adayı":
                            st.success(
                                "Hesabınız oluşturuldu. E-posta onayından sonra "
                                "hoca başvurunuz admin paneline iletilecek."
                            )
                        elif cevap.session:
                            st.success("Sporcu hesabı oluşturuldu. Giriş yapabilirsiniz.")
                        else:
                            st.success(
                                "Sporcu hesabı oluşturuldu. E-postanıza gelen onay bağlantısına basın."
                            )
                    except Exception as hata:
                        st.error(f"Hesap oluşturulamadı: {hata}")

    st.stop()

kullanici = st.session_state.sporcu_kullanici

st.markdown(
    f"""
    <div class="sporcu-hero">
        <span class="etiket">SPORCU PANELİ</span>
        <h1>🏋️ Akıllı Spor Salonu</h1>
        <p>Hoş geldin, {kullanici.get('ad_soyad') or 'Sporcu'}! Bugün hedefin için bir adım daha at.</p>
    </div>
    """,
    unsafe_allow_html=True,
)

st.markdown(
    """
    <style>
    .stApp, [data-testid="stAppViewContainer"] {
        background:
            radial-gradient(circle at 6% 7%, rgba(34,211,238,.20), transparent 22rem),
            radial-gradient(circle at 94% 18%, rgba(37,99,235,.16), transparent 28rem),
            repeating-linear-gradient(135deg, rgba(8,47,73,.045) 0 1px, transparent 1px 24px),
            linear-gradient(145deg, #f6fdff 0%, #eaf9ff 52%, #eef4ff 100%) !important;
        background-attachment: fixed !important;
        color: #172033;
    }
    [data-testid="stAppViewContainer"] h1,
    [data-testid="stAppViewContainer"] h2,
    [data-testid="stAppViewContainer"] h3,
    [data-testid="stAppViewContainer"] p,
    [data-testid="stAppViewContainer"] span { color: #172033; }
    [data-testid="stMetric"] {
        background: white;
        border: 1px solid #dbe3ee;
        border-radius: 14px;
        padding: 14px;
        box-shadow: 0 3px 10px rgba(0,0,0,0.05);
    }
    [data-testid="stMetricLabel"] p { color: #475569 !important; }
    [data-testid="stMetricValue"] { color: #111827 !important; }
    .sporcu-ozet-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 14px;
        margin: 12px 0 24px;
    }
    .sporcu-ozet-kart {
        min-height: 118px;
        padding: 18px;
        border: 1px solid #bae6fd;
        border-radius: 18px;
        background: linear-gradient(145deg, #ffffff, #f0f9ff);
        box-shadow: 0 9px 25px rgba(8, 47, 73, .08);
    }
    .sporcu-ozet-kart .ikon { font-size: 24px; }
    .sporcu-ozet-kart .baslik {
        margin-top: 9px;
        color: #52667a !important;
        font-size: 13px;
        font-weight: 800;
    }
    .sporcu-ozet-kart .deger {
        margin-top: 3px;
        color: #0f2942 !important;
        font-size: 25px;
        line-height: 1.15;
        font-weight: 900;
    }
    .odev-durum {
        display: inline-block;
        margin: 0 0 10px;
        padding: 6px 11px;
        border-radius: 999px;
        font-size: 13px;
        font-weight: 900;
    }
    .odev-tamam { color: #065f46 !important; background: #d1fae5; border: 1px solid #6ee7b7; }
    .odev-bugun { color: #9a3412 !important; background: #ffedd5; border: 1px solid #fdba74; }
    .odev-gecikti { color: #991b1b !important; background: #fee2e2; border: 1px solid #fca5a5; }
    .odev-bekliyor { color: #475569 !important; background: #e2e8f0; border: 1px solid #cbd5e1; }
    @media (max-width: 900px) {
        .sporcu-ozet-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media (max-width: 540px) {
        .sporcu-ozet-grid { grid-template-columns: 1fr; }
    }
    .model-yukleniyor {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        background: #ffffff;
        color: #172033;
        border: 1px solid #bfdbfe;
        border-radius: 12px;
        padding: 10px 14px;
        box-shadow: 0 3px 12px rgba(15, 23, 42, .10);
        font-weight: 600;
    }
    .model-yukleniyor-daire {
        width: 18px;
        height: 18px;
        border: 3px solid #bfdbfe;
        border-top-color: #2563eb;
        border-radius: 50%;
        animation: model-don 0.8s linear infinite;
    }
    @keyframes model-don { to { transform: rotate(360deg); } }

    /* Streamlit yeniden çalışırken eski içeriği soldurmasın. */
    [data-stale="true"] {
        opacity: 1 !important;
    }
    /* Kamera açılırken/kapanırken Streamlit eski ekranı kısa süreliğine
       bekleme durumuna alır. Bu sırada kullanıcıya belirgin bir yükleme
       göstergesi sunulur ve işlem tamamlanınca otomatik kaybolur. */
    [data-testid="stAppViewContainer"]:has([data-stale="true"])::before,
    [data-testid="stAppViewContainer"][data-stale="true"]::before {
        content: "";
        position: fixed;
        left: 50%;
        top: 46%;
        width: 34px;
        height: 34px;
        margin-left: -17px;
        margin-top: -17px;
        border: 5px solid #bfdbfe;
        border-top-color: #2563eb;
        border-radius: 50%;
        animation: model-don .75s linear infinite;
        z-index: 999999;
        background: transparent;
        box-sizing: border-box;
    }
    html[data-kamera-gecis="true"]
    [data-testid="stAppViewContainer"]:has([data-stale="true"])::after,
    html[data-kamera-gecis="true"]
    [data-testid="stAppViewContainer"][data-stale="true"]::after {
        content: "Kamera güncelleniyor...";
        position: fixed;
        left: 50%;
        top: calc(46% + 34px);
        transform: translateX(-50%);
        z-index: 999999;
        padding: 7px 12px;
        border-radius: 9px;
        background: #ffffff;
        color: #172033;
        box-shadow: 0 4px 14px rgba(15, 23, 42, .18);
        font-size: 14px;
        font-weight: 700;
        white-space: nowrap;
    }
    [data-testid="stSidebar"] {
        background-color: #172033;
    }
    [data-testid="stSidebar"] h1,
    [data-testid="stSidebar"] h2,
    [data-testid="stSidebar"] h3,
    [data-testid="stSidebar"] label,
    [data-testid="stSidebar"] p {
        color: white !important;
    }
    [data-baseweb="select"] > div,
    [data-testid="stNumberInput"] input {
        background-color: white !important;
        color: #111827 !important;
        border: 2px solid #94a3b8 !important;
    }
    [data-baseweb="select"] span,
    [data-baseweb="select"] input {
        color: #111827 !important;
    }
    [data-testid="stTextInput"] input,
    [data-testid="stTextArea"] textarea,
    [data-testid="stDateInput"] input {
        background: #ffffff !important;
        color: #0f172a !important;
        -webkit-text-fill-color: #0f172a !important;
        border: 2px solid #60a5fa !important;
        border-radius: 10px !important;
        font-weight: 600 !important;
        caret-color: #2563eb !important;
        opacity: 1 !important;
    }
    [data-testid="stTextInput"] input:disabled,
    [data-testid="stTextArea"] textarea:disabled {
        background: #e2e8f0 !important;
        color: #334155 !important;
        -webkit-text-fill-color: #334155 !important;
        border-color: #94a3b8 !important;
        opacity: 1 !important;
    }
    [data-testid="stTextInput"] input:focus,
    [data-testid="stTextArea"] textarea:focus {
        border-color: #1d4ed8 !important;
        box-shadow: 0 0 0 3px rgba(37, 99, 235, .20) !important;
    }
    [role="listbox"] { background-color: white !important; }
    [role="option"] { color: #111827 !important; }
    [role="option"]:hover { background-color: #dbeafe !important; }
    /* Ana sayfadaki butonlar: normal durumda da belirgin ve okunaklı */
    [data-testid="stMain"] [data-testid="stButton"] button {
        background: #2563eb !important;
        color: #ffffff !important;
        border: 2px solid #1d4ed8 !important;
        border-radius: 10px !important;
        font-weight: 700 !important;
        box-shadow: 0 4px 10px rgba(37, 99, 235, 0.25) !important;
        opacity: 1 !important;
    }
    [data-testid="stMain"] [data-testid="stFormSubmitButton"] button,
    [data-testid="stMain"] [data-testid="stDownloadButton"] button {
        background: #2563eb !important;
        color: #ffffff !important;
        border: 2px solid #1d4ed8 !important;
        border-radius: 10px !important;
        font-weight: 700 !important;
        box-shadow: 0 4px 10px rgba(37, 99, 235, .25) !important;
        opacity: 1 !important;
    }
    [data-testid="stMain"] [data-testid="stFormSubmitButton"] button p,
    [data-testid="stMain"] [data-testid="stDownloadButton"] button p {
        color: #ffffff !important;
    }
    [data-testid="stMain"] [data-testid="stButton"] button p,
    [data-testid="stMain"] [data-testid="stButton"] button span {
        color: #ffffff !important;
    }
    [data-testid="stMain"] [data-testid="stButton"] button:hover {
        background: #1d4ed8 !important;
        color: #ffffff !important;
        border-color: #1e40af !important;
    }
    [data-testid="stMain"] [data-testid="stButton"] button:focus,
    [data-testid="stMain"] [data-testid="stButton"] button:active {
        background: #1e40af !important;
        color: #ffffff !important;
    }
    [data-testid="stSidebar"] [data-testid="stButton"] button {
        background: #2563eb !important;
        color: #ffffff !important;
        border: 2px solid #60a5fa !important;
        border-radius: 10px !important;
        font-weight: 700 !important;
        box-shadow: 0 4px 10px rgba(37, 99, 235, 0.35) !important;
    }
    [data-testid="stSidebar"] [data-testid="stButton"] button:hover {
        background: #1d4ed8 !important;
        border-color: #93c5fd !important;
    }
    [data-testid="stSidebarCollapseButton"] button,
    [data-testid="stSidebarCollapsedControl"] button {
        background: #f59e0b !important;
        color: #ffffff !important;
        border: 2px solid #fbbf24 !important;
        border-radius: 12px !important;
        box-shadow: 0 4px 12px rgba(245, 158, 11, 0.45) !important;
        opacity: 1 !important;
    }
    [data-testid="stSidebarCollapseButton"] button:hover,
    [data-testid="stSidebarCollapsedControl"] button:hover {
        background: #d97706 !important;
        transform: scale(1.06);
    }
    [data-testid="stSidebarCollapseButton"] svg,
    [data-testid="stSidebarCollapsedControl"] svg {
        fill: #ffffff !important;
        stroke: #ffffff !important;
    }
    /* Form alanları ve sekmeler */
    [data-testid="stTextInput"] input,
    [data-testid="stTextArea"] textarea,
    [data-testid="stDateInput"] input {
        background: #ffffff !important;
        color: #0f172a !important;
        -webkit-text-fill-color: #0f172a !important;
        caret-color: #2563eb !important;
        border: 2px solid #94a3b8 !important;
        border-radius: 10px !important;
        opacity: 1 !important;
    }
    [data-testid="stTextInput"] input:focus,
    [data-testid="stTextArea"] textarea:focus,
    [data-testid="stDateInput"] input:focus {
        border-color: #2563eb !important;
        box-shadow: 0 0 0 3px rgba(37, 99, 235, .18) !important;
    }
    [data-baseweb="tab"] { color: #334155 !important; font-weight: 700 !important; }
    [aria-selected="true"][data-baseweb="tab"] { color: #1d4ed8 !important; }
    /* Bilgi, uyarı ve başarı kutularındaki metinler */
    [data-testid="stAlert"] p,
    [data-testid="stAlert"] span { color: #0f172a !important; font-weight: 600 !important; }
    /* DataFrame üzerindeki indir/ara/tam ekran araçları */
    [data-testid="stElementToolbar"] {
        background: #2563eb !important;
        border: 2px solid #60a5fa !important;
        border-radius: 10px !important;
        box-shadow: 0 4px 12px rgba(37, 99, 235, .30) !important;
        opacity: 1 !important;
        visibility: visible !important;
    }
    [data-testid="stElementToolbar"] button {
        background: transparent !important;
        color: #ffffff !important;
        opacity: 1 !important;
    }
    [data-testid="stElementToolbar"] button:hover { background: #1d4ed8 !important; }
    [data-testid="stElementToolbar"] svg,
    [data-testid="stElementToolbar"] button svg {
        fill: #ffffff !important;
        stroke: #ffffff !important;
        color: #ffffff !important;
        opacity: 1 !important;
    }
    [data-testid="stDataFrame"] {
        border: 2px solid #64748b !important;
        border-radius: 12px !important;
        overflow: hidden !important;
        box-shadow: 0 5px 16px rgba(15, 23, 42, .15) !important;
    }
    /* Modern sporcu teması: mevcut stillerin son katmanı */
    [data-testid="stSidebar"] {
        background: radial-gradient(circle at 15% 5%, rgba(34,211,238,.18), transparent 13rem),
                    linear-gradient(180deg, #082f49 0%, #0c4a6e 52%, #172554 100%) !important;
        border-right: 1px solid rgba(103,232,249,.28);
    }
    [data-testid="stSidebar"] [data-testid="stAlert"] {
        background: rgba(255,255,255,.10) !important;
        border: 1px solid rgba(165,243,252,.26) !important;
        border-radius: 14px !important;
    }
    [data-testid="stSidebar"] [data-testid="stAlert"] p,
    [data-testid="stSidebar"] [data-testid="stAlert"] span { color: #ecfeff !important; }
    [data-baseweb="tab-list"] {
        gap: .35rem;
        padding: .35rem;
        background: rgba(255,255,255,.72);
        border: 1px solid #bae6fd;
        border-radius: 15px;
        box-shadow: 0 8px 24px rgba(8,47,73,.06);
    }
    [data-baseweb="tab"] {
        min-height: 42px;
        padding: .55rem .85rem !important;
        border-radius: 11px !important;
    }
    [aria-selected="true"][data-baseweb="tab"] {
        color: #ffffff !important;
        background: linear-gradient(135deg, #0891b2, #2563eb) !important;
        box-shadow: 0 6px 16px rgba(8,145,178,.22);
    }
    [aria-selected="true"][data-baseweb="tab"] p,
    [aria-selected="true"][data-baseweb="tab"] span { color: #ffffff !important; }
    [data-testid="stMetric"] {
        min-height: 122px;
        background: linear-gradient(145deg, #ffffff, #ecfeff) !important;
        border: 1px solid #a5f3fc !important;
        border-radius: 18px !important;
        box-shadow: 0 12px 28px rgba(8,145,178,.10) !important;
        transition: transform .2s ease, box-shadow .2s ease;
    }
    [data-testid="stMetric"]:hover {
        transform: translateY(-3px);
        box-shadow: 0 17px 34px rgba(8,145,178,.17) !important;
    }
    [data-testid="stMetricValue"] { color: #0e7490 !important; font-weight: 850 !important; }
    [data-testid="stMain"] [data-testid="stButton"] button,
    [data-testid="stMain"] [data-testid="stFormSubmitButton"] button,
    [data-testid="stMain"] [data-testid="stDownloadButton"] button {
        min-height: 43px;
        background: linear-gradient(135deg, #0891b2, #2563eb) !important;
        border: 1px solid rgba(255,255,255,.25) !important;
        border-radius: 12px !important;
        box-shadow: 0 8px 18px rgba(8,145,178,.24) !important;
        transition: transform .18s ease, box-shadow .18s ease !important;
    }
    [data-testid="stMain"] [data-testid="stButton"] button:hover,
    [data-testid="stMain"] [data-testid="stFormSubmitButton"] button:hover,
    [data-testid="stMain"] [data-testid="stDownloadButton"] button:hover {
        background: linear-gradient(135deg, #0e7490, #1d4ed8) !important;
        transform: translateY(-2px);
        box-shadow: 0 11px 24px rgba(37,99,235,.28) !important;
    }
    [data-testid="stTextInput"] input,
    [data-testid="stTextArea"] textarea,
    [data-testid="stDateInput"] input,
    [data-testid="stNumberInput"] input,
    [data-baseweb="select"] > div {
        border: 1.5px solid #7dd3fc !important;
        border-radius: 12px !important;
        box-shadow: 0 4px 12px rgba(14,116,144,.05) !important;
    }
    [data-testid="stAlert"] {
        border-radius: 14px !important;
        border-width: 1px !important;
        box-shadow: 0 7px 18px rgba(15,23,42,.06);
    }
    [data-testid="stExpander"] {
        background: rgba(255,255,255,.76) !important;
        border: 1px solid #bae6fd !important;
    }
    hr { border-color: #bae6fd !important; }
    </style>
    """,
    unsafe_allow_html=True,
)

st.markdown("""
<style>
/* Premium sporcu arayüzü: fotoğraflı spor salonu zemini ve cam kartlar */
.stApp, [data-testid="stAppViewContainer"] {
  background: linear-gradient(115deg, rgba(3,17,35,.72), rgba(4,42,70,.58)), var(--gym-bg) center / cover fixed !important;
}
[data-testid="stHeader"] { background:rgba(4,18,32,.68) !important; border-bottom:1px solid rgba(103,232,249,.18) !important; backdrop-filter:blur(18px); }
[data-testid="stMain"] { background:transparent !important; }
[data-testid="stMain"] h1, [data-testid="stMain"] h2, [data-testid="stMain"] h3 { color:#f8fdff !important; letter-spacing:-.02em; }
[data-testid="stMain"] p, [data-testid="stMain"] label, [data-testid="stMain"] [data-testid="stCaptionContainer"] p { color:#d8edf6 !important; }
[data-testid="stMetric"], [data-testid="stForm"], [data-testid="stExpander"], [data-testid="stVerticalBlockBorderWrapper"], .sporcu-ozet-kart, .model-yukleniyor {
  background:rgba(7,25,42,.72) !important; border:1px solid rgba(125,211,252,.25) !important;
  box-shadow:0 16px 40px rgba(0,0,0,.25) !important; backdrop-filter:blur(14px); -webkit-backdrop-filter:blur(14px);
}
[data-testid="stMetric"] { border-top:3px solid #22d3ee !important; }
[data-testid="stMetricLabel"] p { color:#a5ddec !important; }
[data-testid="stMetricValue"] { color:#ffffff !important; }
[data-testid="stTabs"] [data-baseweb="tab-list"] { background:rgba(7,25,42,.88) !important; border-color:rgba(125,211,252,.25) !important; }
[data-testid="stTabs"] button { color:#c8e7f3 !important; }
[aria-selected="true"][data-baseweb="tab"] { color:#67e8f9 !important; border-bottom-color:#22d3ee !important; }
[data-testid="stTextInput"] input, [data-testid="stTextArea"] textarea, [data-testid="stNumberInput"] input, [data-baseweb="select"] > div { background:rgba(255,255,255,.94) !important; }
.hareket-animasyon-karti { margin:12px 0 16px; padding:14px; border:1px solid rgba(103,232,249,.34); border-radius:18px; background:linear-gradient(145deg,rgba(8,47,73,.94),rgba(8,85,112,.72)); box-shadow:inset 0 1px rgba(255,255,255,.12),0 12px 26px rgba(0,0,0,.2); }
.animasyon-baslik { display:flex; justify-content:space-between; gap:8px; color:#a5f3fc; font-size:.72rem; font-weight:800; letter-spacing:.09em; }
.animasyon-baslik b { color:#fff; letter-spacing:0; }
.animasyon-sahne { position:relative; display:grid; place-items:center; height:190px; margin:8px 0; overflow:hidden; border-radius:14px; background:radial-gradient(circle at 50% 20%,rgba(34,211,238,.2),transparent 48%),rgba(2,22,38,.72); }
.animasyon-sahne::after { content:""; position:absolute; inset:auto 8% 9px; height:1px; background:linear-gradient(90deg,transparent,#67e8f9,transparent); opacity:.7; }
.animasyon-sahne svg { width:172px; height:190px; filter:drop-shadow(0 0 10px rgba(34,211,238,.35)); }
.anim-cizgi, .anim-bar, .anim-zemin { fill:none; stroke:#d9fbff; stroke-width:7; stroke-linecap:round; stroke-linejoin:round; }
.anim-kafa { fill:#67e8f9; stroke:#ecfeff; stroke-width:3; }.anim-bar { stroke:#fbbf24; stroke-width:8; }.anim-zemin { stroke:#38bdf8; stroke-width:2; opacity:.65; }
.animasyon-ok { position:absolute; right:18px; bottom:20px; color:#67e8f9; font-weight:900; animation:animasyon-nabiz 1.2s ease-in-out infinite; }
.hareket-animasyon-karti p { margin:2px 3px 0 !important; color:#d9f7ff !important; font-size:.86rem; line-height:1.45; }
@keyframes animasyon-nabiz { 50% { transform:translateY(-7px); opacity:.45; } }
</style>
""", unsafe_allow_html=True)

@st.cache_resource(show_spinner=False)
def modeli_yukle():
    return (
        joblib.load("hareket_tanima_modeli.pkl"),
        joblib.load("model_sutunlari.pkl"),
    )


def aci_hesapla(a, b, c):
    a = np.array(a)
    b = np.array(b)
    c = np.array(c)
    aci = np.degrees(
        np.arctan2(c[1] - b[1], c[0] - b[0])
        - np.arctan2(a[1] - b[1], a[0] - b[0])
    )
    aci = abs(aci)
    return 360 - aci if aci > 180 else aci


HAREKETLER = {
    "Squat": "Squats",
    "Şınav": "Push Ups",
    "Barfiks": "Pull ups",
    "Aç-Kapa Zıplama": "Jumping Jacks",
    "Gövde Çevirme": "Russian twists",
}

HAREKET_REHBERI = {
    "Squat": [
        "Ayaklarını omuz genişliğinde aç ve göğsünü dik tut.",
        "Kalçanı geriye vererek dizlerini kontrollü biçimde bük.",
        "Dizlerin ayak yönünde kalsın; yeterince alçalınca tekrar doğrul.",
    ],
    "Şınav": [
        "Ellerini omuzlarının biraz dışına yerleştir.",
        "Başından topuğuna kadar vücudunu düz bir çizgide tut.",
        "Dirseklerini büküp göğsünü indir, ardından kontrollü biçimde yüksel.",
    ],
    "Barfiks": [
        "Barı omuz genişliğinden biraz daha açık kavra.",
        "Sallanma yapmadan karnını sık ve kendini yukarı çek.",
        "Çenen bar seviyesine yaklaşınca kontrollü biçimde aşağı in.",
    ],
    "Aç-Kapa Zıplama": [
        "Dik dur; ayakların kapalı, kolların yanlarında olsun.",
        "Zıplarken ayaklarını yana aç ve kollarını başının üzerine kaldır.",
        "Tekrar zıplayıp ayaklarını kapatırken kollarını indir.",
    ],
    "Gövde Çevirme": [
        "Dizlerini hafif bük, gövdeni geriye doğru az miktarda yatır.",
        "Karnını sık ve ellerini göğsünün önünde birleştir.",
        "Gövdeni kontrollü biçimde sağa ve sola çevir.",
    ],
}


def hareket_animasyonu_html(hareket):
    """Kamerayı etkilemeden rehber yanında çalışan hafif SVG animasyonu."""
    animasyonlar = {
        "Squat": '<animateTransform attributeName="transform" type="translate" values="0 0;0 20;0 0" dur="1.6s" repeatCount="indefinite"/>',
        "Şınav": '<animateTransform attributeName="transform" type="rotate" values="0 0 0;12 80 94;0 0 0" dur="1.5s" repeatCount="indefinite"/>',
        "Barfiks": '<animateTransform attributeName="transform" type="translate" values="0 18;0 -12;0 18" dur="1.45s" repeatCount="indefinite"/>',
        "Aç-Kapa Zıplama": '<animateTransform attributeName="transform" type="scale" values="1 1;1.16 .96;1 1" additive="sum" dur="1.25s" repeatCount="indefinite"/>',
        "Gövde Çevirme": '<animateTransform attributeName="transform" type="rotate" values="-13 80 95;13 80 95;-13 80 95" dur="1.35s" repeatCount="indefinite"/>',
    }
    vurgu = {
        "Squat": "Kalçanı geriye ver, kontrollü alçal ve doğrul.",
        "Şınav": "Vücudunu düz tut; göğsünü kontrollü indirip yükselt.",
        "Barfiks": "Sallanma yapmadan çeneni bara yaklaştır.",
        "Aç-Kapa Zıplama": "Kollar yukarıdayken ayakları aç, sonra kapat.",
        "Gövde Çevirme": "Karnını sık; gövdeyi sağa ve sola kontrollü çevir.",
    }
    bar = '<line x1="32" y1="22" x2="128" y2="22" class="anim-bar"/>' if hareket == "Barfiks" else ''
    return f'''\
    <div class="hareket-animasyon-karti">
      <div class="animasyon-baslik"><span>CANLI HAREKET REHBERİ</span><b>↻ Tekrarla</b></div>
      <div class="animasyon-sahne">
        <svg viewBox="0 0 160 180" role="img" aria-label="{hareket} hareket animasyonu">
          {bar}
          <g class="anim-figur">{animasyonlar.get(hareket, '')}
            <circle cx="80" cy="54" r="13" class="anim-kafa"/>
            <line x1="80" y1="67" x2="80" y2="108" class="anim-cizgi"/>
            <line x1="80" y1="78" x2="46" y2="96" class="anim-cizgi anim-kol"/>
            <line x1="80" y1="78" x2="114" y2="96" class="anim-cizgi anim-kol"/>
            <line x1="80" y1="108" x2="57" y2="145" class="anim-cizgi anim-bacak"/>
            <line x1="80" y1="108" x2="103" y2="145" class="anim-cizgi anim-bacak"/>
          </g>
          <path d="M25 158 H135" class="anim-zemin"/>
        </svg>
        <div class="animasyon-ok">↓&nbsp; ↑</div>
      </div>
      <p>{vurgu.get(hareket, 'Hareketi kontrollü ve doğru formda uygula.')}</p>
    </div>'''


def hareket_animasyonu_iframe(hareket):
    """Animasyonu ayrı bileşende çalıştırır; Streamlit SVG etiketlerini temizlemez."""
    sinif = {
        "Squat": "squat", "Şınav": "sinav", "Barfiks": "barfiks",
        "Aç-Kapa Zıplama": "jack", "Gövde Çevirme": "twist",
    }.get(hareket, "squat")
    gosterim = {
        "Squat": "Dik dur → kalçanı geriye vererek alçal → topuklarından güç alıp kalk",
        "Şınav": "Düz plank pozisyonu → göğsünü kontrollü indir → kollarınla yukarı it",
        "Barfiks": "Kollar açık asıl → çeneni bara yaklaştır → kontrollü aşağı in",
        "Aç-Kapa Zıplama": "Ayaklar kapalı/kollar aşağı → zıplayıp aç ve kolları kaldır → geri dön",
        "Gövde Çevirme": "Karnını sık → gövdeyi sağa çevir → ortaya dönüp sola çevir",
    }.get(hareket, "Hareketi kontrollü biçimde uygula.")
    return f"""
    <html><head><style>
    *{{box-sizing:border-box}} body{{margin:0;background:transparent;font-family:Arial,sans-serif;color:#eafcff}}
    .kart{{height:286px;padding:14px;border-radius:18px;border:1px solid #49d5f1;background:linear-gradient(145deg,#08324a,#12627b);box-shadow:0 10px 25px #001522}}
    .ust{{display:flex;justify-content:space-between;font-weight:800;font-size:12px;letter-spacing:1px;color:#b8f6ff}} .ust b{{color:#fff;letter-spacing:0}}
    .sahne{{position:relative;height:184px;margin:10px 0;border-radius:14px;overflow:hidden;background:radial-gradient(circle at 50% 20%,#186d89 0,transparent 45%),#06243a}}
    .zemin{{position:absolute;bottom:20px;left:12%;right:12%;height:2px;background:#5ee9ff;box-shadow:0 0 12px #5ee9ff}}
    .figur{{position:absolute;left:50%;top:23px;width:96px;height:140px;transform:translateX(-50%);transform-origin:50% 74%}}
    .kafa{{position:absolute;left:38px;top:0;width:22px;height:22px;border:3px solid #e9fdff;border-radius:50%;background:#55dff7}}
    .govde{{position:absolute;left:46px;top:25px;width:6px;height:48px;border-radius:8px;background:#e9fdff}}
    .kol,.bacak{{position:absolute;width:6px;border-radius:8px;background:#e9fdff;transform-origin:top center}} .kol{{top:32px;height:48px}} .sol-kol{{left:43px;transform:rotate(52deg)}} .sag-kol{{left:49px;transform:rotate(-52deg)}} .bacak{{top:70px;height:55px}} .sol-bacak{{left:45px;transform:rotate(28deg)}} .sag-bacak{{left:51px;transform:rotate(-28deg)}}
    .squat{{animation:in-cik 1.45s ease-in-out infinite}} .sinav{{animation:sinav 1.45s ease-in-out infinite}} .barfiks{{animation:barfiks 1.3s ease-in-out infinite}} .jack{{animation:jack 1.2s ease-in-out infinite}} .twist{{animation:twist 1.25s ease-in-out infinite}}
    .jack .sol-kol{{animation:kolsol 1.2s ease-in-out infinite}} .jack .sag-kol{{animation:kolsag 1.2s ease-in-out infinite}} .jack .sol-bacak{{animation:bacaksol 1.2s ease-in-out infinite}} .jack .sag-bacak{{animation:bacak-sag 1.2s ease-in-out infinite}}
    @keyframes in-cik{{50%{{transform:translateX(-50%) translateY(24px) scaleY(.86)}}}} @keyframes sinav{{50%{{transform:translateX(-50%) rotate(12deg) translateY(15px)}}}} @keyframes barfiks{{50%{{transform:translateX(-50%) translateY(-28px)}}}} @keyframes jack{{50%{{transform:translateX(-50%) translateY(-10px)}}}} @keyframes twist{{50%{{transform:translateX(-50%) rotate(16deg)}}}} @keyframes kolsol{{50%{{transform:rotate(-145deg)}}}} @keyframes kolsag{{50%{{transform:rotate(145deg)}}}} @keyframes bacaksol{{50%{{transform:rotate(55deg)}}}} @keyframes bacak-sag{{50%{{transform:rotate(-55deg)}}}}
    .aciklama{{margin:0;color:#d9f7ff;font-size:14px;line-height:1.4}} .aciklama b{{color:#fff}}
    </style></head><body><div class="kart"><div class="ust"><span>CANLI HAREKET REHBERİ</span><b>↻ Tekrarla</b></div><div class="sahne"><div class="figur {sinif}"><i class="kafa"></i><i class="govde"></i><i class="kol sol-kol"></i><i class="kol sag-kol"></i><i class="bacak sol-bacak"></i><i class="bacak sag-bacak"></i></div><div class="zemin"></div></div><p class="aciklama"><b>Nasıl yapılır:</b> {gosterim}</p></div></body></html>
    """

st.sidebar.header("Sporcu Bilgileri")
sporcu_adi = kullanici["ad_soyad"]
st.sidebar.success(f"Giriş yapan: {sporcu_adi}")

try:
    baglantilar = (
        yeni_istemci().table("hoca_sporcu")
        .select("hoca_id,durum")
        .eq("sporcu_id", kullanici["id"]).execute().data
    )
except Exception:
    baglantilar = []

st.sidebar.subheader("👨‍🏫 Hocam")
if baglantilar:
    for baglanti in baglantilar:
        hoca_listesi = (
            yeni_istemci().table("profiles")
            .select("ad_soyad,hoca_kodu")
            .eq("id", baglanti["hoca_id"]).limit(1).execute().data
        )
        hoca = hoca_listesi[0] if hoca_listesi else {}
        hoca_adi = hoca.get("ad_soyad") or "Hoca"
        if baglanti["durum"] == "onaylandi":
            st.sidebar.success(f"✓ {hoca_adi}\n\nBağlantı onaylandı")
        else:
            st.sidebar.info(f"⏳ {hoca_adi}\n\nOnay bekleniyor")
else:
    st.sidebar.warning("Henüz bir hocaya bağlı değilsiniz.")

with st.sidebar.expander("Hoca kodu ile bağlan", expanded=not baglantilar):

    girilen_hoca_kodu = st.text_input(
        "Hoca kodu", placeholder="HCA-ABC123", key="hoca_kodu_girisi"
    )
    if st.button("Bağlantı isteği gönder", key="hoca_istegi_gonder"):
        if not girilen_hoca_kodu.strip():
            st.warning("Önce hoca kodunu yazın.")
        else:
            try:
                yeni_istemci().rpc(
                    "hoca_istegi_gonder",
                    {"girilen_kod": girilen_hoca_kodu.strip()},
                ).execute()
                st.success("İstek hocaya gönderildi.")
                st.rerun()
            except Exception as hata:
                st.error(f"İstek gönderilemedi: {hata}")

if st.sidebar.button("Çıkış yap"):
    try:
        yeni_istemci().auth.sign_out()
    except Exception:
        pass
    oturumu_temizle("sporcu")
    st.session_state.sporcu_kullanici = None
    st.rerun()

if "programdan_hareket" in st.session_state:
    st.session_state.secilen_hareket = st.session_state.pop("programdan_hareket")
if "programdan_hedef" in st.session_state:
    st.session_state.secilen_hedef = st.session_state.pop("programdan_hedef")

hareket_adi = st.sidebar.selectbox(
    "Yapılacak hareket",
    list(HAREKETLER.keys()),
    key="secilen_hareket",
)
hedef_tekrar = st.sidebar.number_input(
    "Hedef tekrar", 1, 500, 10, key="secilen_hedef"
)

with st.sidebar.expander("➕ Çoklu hareket seç", expanded=False):
    st.caption("Hareketlerini topluca seç; kamera bunları sırayla takip eder.")
    toplu_hareketler = st.multiselect(
        "Antrenman listesi",
        list(HAREKETLER.keys()),
        key="toplu_hareket_secimi",
    )
    toplu_hedefler = {}
    for toplu_hareket in toplu_hareketler:
        toplu_hedefler[toplu_hareket] = st.number_input(
            f"{toplu_hareket} hedefi",
            min_value=1,
            max_value=500,
            value=10,
            key=f"toplu_hedef_{toplu_hareket}",
        )
    if st.button(
        "Listeyi hazırla",
        key="toplu_liste_hazirla",
        type="primary",
        use_container_width=True,
    ):
        if not toplu_hareketler:
            st.warning("En az bir hareket seçin.")
        else:
            st.session_state.kisisel_antrenman_listesi = [
                {
                    "hareket": ad,
                    "hedef": int(toplu_hedefler[ad]),
                    "tamamlandi": False,
                }
                for ad in toplu_hareketler
            ]
            ilk_hareket = st.session_state.kisisel_antrenman_listesi[0]
            st.session_state.programdan_hareket = ilk_hareket["hareket"]
            st.session_state.programdan_hedef = ilk_hareket["hedef"]
            st.rerun()

kisisel_liste = st.session_state.get("kisisel_antrenman_listesi", [])
if kisisel_liste:
    st.sidebar.markdown("#### Antrenman listem")
    for liste_sirasi, liste_hareketi in enumerate(kisisel_liste, start=1):
        tik = "✅" if liste_hareketi["tamamlandi"] else "⬜"
        satir, sec_kolonu = st.sidebar.columns([4, 1])
        satir.caption(
            f"{tik} {liste_sirasi}. {liste_hareketi['hareket']} · "
            f"{liste_hareketi['hedef']} tekrar"
        )
        if not liste_hareketi["tamamlandi"] and sec_kolonu.button(
            "▶",
            key=f"kisisel-hareket-sec-{liste_sirasi}",
            help="Bu hareketi kameraya aktar",
        ):
            st.session_state.programdan_hareket = liste_hareketi["hareket"]
            st.session_state.programdan_hedef = liste_hareketi["hedef"]
            st.rerun()

kamera_yonu = st.sidebar.selectbox(
    "Telefon kamerası",
    ["Arka kamera", "Ön kamera"],
)

# Model ana sayfada yüklenmez. Kamera/analiz kullanıcı isteyene kadar kapalıdır.
model = None
model_sutunlari = None
istenen_hareket = HAREKETLER[hareket_adi]


class HareketIslemcisi(VideoProcessorBase):
    def __init__(self):
        self.pose = mp.solutions.pose.Pose(
            static_image_mode=False,
            # Hafif model, telefon ve düşük güçlü bilgisayarlarda daha akıcıdır.
            model_complexity=0,
            smooth_landmarks=True,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5,
        )
        self.lock = threading.Lock()
        self.tekrar = 0
        self.dogru = 0
        self.hatali = 0
        self.asama = "baslangic"
        self.durum = "Hazır"
        self.sesli_mesaj = "Hazırsan harekete başla."
        self.russian_yarim = 0
        self.russian_son_yon = None
        self.baslangic_zamani = time.time()
        self.kare_sayaci = 0
        self.son_algilanan = "Vücut bulunamadı"
        self.son_guven = 0.0
        self.form_puani = 0
        self.aci_diz = 0
        self.aci_kalca = 0
        self.aci_dirsek = 0
        self.kadraj_durumu = "Vücudun tamamını göster"
        self.kadraj_renk = (80, 110, 255)
        self.vucut_merkezi = None
        self.vucut_yaricapi = 0

    def recv(self, frame):
        """Tek bir bozuk kare yüzünden WebRTC kamera akışının kapanmasını önler."""
        try:
            return self._kareyi_isle(frame)
        except Exception:
            with self.lock:
                self.durum = "Görüntü yeniden deneniyor"
                self.sesli_mesaj = "Kameraya tam görünecek şekilde biraz geriye geç."
            return frame

    def _kareyi_isle(self, frame):
        goruntu = frame.to_ndarray(format="bgr24")
        # Çok yüksek kamera çözünürlüğü analizi ve geri gönderimi yavaşlatır.
        yukseklik, genislik = goruntu.shape[:2]
        if genislik > 360:
            oran = 360 / genislik
            goruntu = cv2.resize(
                goruntu,
                (360, int(yukseklik * oran)),
                interpolation=cv2.INTER_AREA,
            )

        # Poz analizi daha küçük kopyada yapılır; noktalar normalize olduğu için
        # iskelet asıl görüntüye doğru konumda çizilmeye devam eder.
        analiz_genisligi = min(160, goruntu.shape[1])
        analiz_orani = analiz_genisligi / goruntu.shape[1]
        analiz_goruntu = cv2.resize(
            goruntu,
            (analiz_genisligi, int(goruntu.shape[0] * analiz_orani)),
            interpolation=cv2.INTER_AREA,
        )
        rgb = cv2.cvtColor(analiz_goruntu, cv2.COLOR_BGR2RGB)
        self.kare_sayaci += 1

        # Her karede ağır poz analizi yerine iki karede bir çalıştırmak,
        # kameranın akıcılığını korurken tekrar sayımına yeterli hassasiyet verir.
        sonuc = self.pose.process(rgb) if self.kare_sayaci % 3 == 1 else None

        algilanan = self.son_algilanan
        guven = self.son_guven

        if sonuc and sonuc.pose_landmarks:
            p = sonuc.pose_landmarks.landmark

            # Baloncuk kadrajı: kullanıcı tüm vücudunu rehber siluetin içine
            # aldığında yeşile döner. İskelet çizimi görüntüyü kaplamaz.
            kontrol_noktalari = [
                mp.solutions.pose.PoseLandmark.NOSE,
                mp.solutions.pose.PoseLandmark.LEFT_SHOULDER,
                mp.solutions.pose.PoseLandmark.RIGHT_SHOULDER,
                mp.solutions.pose.PoseLandmark.LEFT_HIP,
                mp.solutions.pose.PoseLandmark.RIGHT_HIP,
                mp.solutions.pose.PoseLandmark.LEFT_ANKLE,
                mp.solutions.pose.PoseLandmark.RIGHT_ANKLE,
            ]
            gorunen = [p[nokta.value] for nokta in kontrol_noktalari]
            tam_gorunuyor = all(getattr(nokta, "visibility", 1.0) > 0.45 for nokta in gorunen)
            ortada = all(.10 < nokta.x < .90 and .03 < nokta.y < .97 for nokta in gorunen)
            with self.lock:
                gorunen_noktalar = [
                    nokta for nokta in gorunen
                    if getattr(nokta, "visibility", 1.0) > 0.20
                ]
                # Sadece yüz görünüyorken baloncuk çizme: bütün vücut için
                # iki kalça ve iki ayak bileğinin de güvenilir biçimde
                # algılanması gerekir. Böylece çember kafayı takip etmez.
                alt_vucut_noktalari = [
                    mp.solutions.pose.PoseLandmark.LEFT_HIP,
                    mp.solutions.pose.PoseLandmark.RIGHT_HIP,
                    mp.solutions.pose.PoseLandmark.LEFT_ANKLE,
                    mp.solutions.pose.PoseLandmark.RIGHT_ANKLE,
                ]
                alt_vucut_gorunuyor = all(
                    p[nokta.value].visibility > 0.55 for nokta in alt_vucut_noktalari
                )

                if alt_vucut_gorunuyor and len(gorunen_noktalar) >= 6:
                    xler = [nokta.x for nokta in gorunen_noktalar]
                    yler = [nokta.y for nokta in gorunen_noktalar]
                    min_x, max_x = min(xler), max(xler)
                    min_y, max_y = min(yler), max(yler)
                    self.vucut_merkezi = (
                        int(((min_x + max_x) / 2) * goruntu.shape[1]),
                        int(((min_y + max_y) / 2) * goruntu.shape[0]),
                    )
                    en_buyuk_olcu = max(
                        (max_x - min_x) * goruntu.shape[1],
                        (max_y - min_y) * goruntu.shape[0],
                    )
                    self.vucut_yaricapi = max(48, int(en_buyuk_olcu * .60))
                else:
                    self.vucut_merkezi = None
                    self.vucut_yaricapi = 0

                if tam_gorunuyor and alt_vucut_gorunuyor and ortada:
                    self.kadraj_durumu = "Harika, vücudun kadrajda"
                    self.kadraj_renk = (80, 255, 140)
                else:
                    self.kadraj_durumu = "Biraz geri çekil ve tüm vücudu göster"
                    self.kadraj_renk = (80, 210, 255)

            def nokta(isaret):
                lm = p[isaret.value]
                return [lm.x, lm.y]

            sol_omuz = nokta(mp.solutions.pose.PoseLandmark.LEFT_SHOULDER)
            sag_omuz = nokta(mp.solutions.pose.PoseLandmark.RIGHT_SHOULDER)
            sol_dirsek = nokta(mp.solutions.pose.PoseLandmark.LEFT_ELBOW)
            sol_bilek = nokta(mp.solutions.pose.PoseLandmark.LEFT_WRIST)
            sag_bilek = nokta(mp.solutions.pose.PoseLandmark.RIGHT_WRIST)
            sol_kalca = nokta(mp.solutions.pose.PoseLandmark.LEFT_HIP)
            sag_kalca = nokta(mp.solutions.pose.PoseLandmark.RIGHT_HIP)
            sol_diz = nokta(mp.solutions.pose.PoseLandmark.LEFT_KNEE)
            sol_ayak = nokta(mp.solutions.pose.PoseLandmark.LEFT_ANKLE)
            sag_ayak = nokta(mp.solutions.pose.PoseLandmark.RIGHT_ANKLE)
            sol_ayak_ucu = nokta(mp.solutions.pose.PoseLandmark.LEFT_FOOT_INDEX)

            omuz = aci_hesapla(sol_dirsek, sol_omuz, sol_kalca)
            dirsek = aci_hesapla(sol_omuz, sol_dirsek, sol_bilek)
            kalca = aci_hesapla(sol_omuz, sol_kalca, sol_diz)
            diz = aci_hesapla(sol_kalca, sol_diz, sol_ayak)
            ayak = aci_hesapla(sol_diz, sol_ayak, sol_ayak_ucu)

            # Hareket sınıflandırması her karede yapılmak zorunda değil.
            # Sekiz karede bir sınıflandırma yeterlidir; eklem açıları ve sayaç
            # her karede çalışmaya devam eder.
            if self.kare_sayaci % 12 == 1:
                girdi = pd.DataFrame(
                    [[omuz, dirsek, kalca, diz, ayak]],
                    columns=model_sutunlari,
                )
                algilanan = model.predict(girdi)[0]
                guven = float(np.max(model.predict_proba(girdi)[0]) * 100)
                self.son_algilanan = algilanan
                self.son_guven = guven

            with self.lock:
                if istenen_hareket == "Squats":
                    if diz > 155:
                        self.asama = "yukari"
                        self.durum = "Aşağı in"
                        self.sesli_mesaj = "Dizlerini bük, kalçanı geriye ver ve kontrollü şekilde aşağı in."
                    elif diz < 105 and self.asama == "yukari":
                        self.tekrar += 1
                        self.asama = "asagi"
                        if kalca < 130:
                            self.dogru += 1
                            self.durum = "Doğru"
                            self.sesli_mesaj = "Doğru squat. Kontrollü şekilde yukarı kalk."
                        else:
                            self.hatali += 1
                            self.durum = "Duruşunu düzelt"
                            self.sesli_mesaj = "Kalçanı biraz daha geriye ver, göğsünü dik tut ve dizlerini ayak yönünde bük."

                elif istenen_hareket == "Push Ups":
                    if dirsek > 150:
                        self.asama = "yukari"
                        self.durum = "Aşağı in"
                        self.sesli_mesaj = "Dirseklerini bük ve göğsünü kontrollü şekilde yere yaklaştır."
                    elif dirsek < 95 and self.asama == "yukari":
                        self.tekrar += 1
                        self.asama = "asagi"
                        if kalca > 150:
                            self.dogru += 1
                            self.durum = "Doğru"
                            self.sesli_mesaj = "Doğru şınav. Vücudunu düz tutarak yukarı it."
                        else:
                            self.hatali += 1
                            self.durum = "Kalçanı düzelt"
                            self.sesli_mesaj = "Kalçanı indir, karın kaslarını sık ve başından topuğuna kadar düz bir çizgi oluştur."

                elif istenen_hareket == "Pull ups":
                    if dirsek > 150:
                        self.asama = "asagi"
                        self.durum = "Yukarı çekil"
                        self.sesli_mesaj = "Omuzlarını geriye al ve dirseklerini aşağı çekerek çeneni bara yaklaştır."
                    elif dirsek < 75 and self.asama == "asagi":
                        self.tekrar += 1
                        self.dogru += 1
                        self.asama = "yukari"
                        self.durum = "Doğru"
                        self.sesli_mesaj = "Doğru barfiks. Kontrollü şekilde aşağı in ve kollarını aç."

                elif istenen_hareket == "Jumping Jacks":
                    ayak_mesafesi = abs(sol_ayak[0] - sag_ayak[0])
                    kollar_yukari = (
                        sol_bilek[1] < sol_omuz[1]
                        and sag_bilek[1] < sag_omuz[1]
                    )
                    kollar_asagi = (
                        sol_bilek[1] > sol_omuz[1]
                        and sag_bilek[1] > sag_omuz[1]
                    )
                    if kollar_asagi and ayak_mesafesi < 0.18:
                        self.asama = "kapali"
                        self.durum = "Kollarını kaldır"
                        self.sesli_mesaj = "Ayaklarını yana açarken iki kolunu da başının üzerine kaldır."
                    elif kollar_yukari and ayak_mesafesi > 0.25 and self.asama == "kapali":
                        self.tekrar += 1
                        self.dogru += 1
                        self.asama = "acik"
                        self.durum = "Doğru"
                        self.sesli_mesaj = "Doğru. Ayaklarını kapatırken kollarını yanlarına indir."

                elif istenen_hareket == "Russian twists":
                    el_x = (sol_bilek[0] + sag_bilek[0]) / 2
                    kalca_x = (sol_kalca[0] + sag_kalca[0]) / 2
                    esik = max(0.07, abs(sol_omuz[0] - sag_omuz[0]) * 0.40)
                    fark = el_x - kalca_x
                    yon = "sol" if fark < -esik else "sag" if fark > esik else None
                    if yon and self.russian_son_yon and yon != self.russian_son_yon:
                        self.russian_yarim += 1
                        if self.russian_yarim % 2 == 0:
                            self.tekrar += 1
                            self.dogru += 1
                            self.durum = "Doğru"
                            self.sesli_mesaj = "Doğru gövde çevirme. Karnını sık ve kontrollü biçimde diğer yana dön."
                    if yon:
                        self.russian_son_yon = yon

                self.aci_diz = int(diz)
                self.aci_kalca = int(kalca)
                self.aci_dirsek = int(dirsek)
                self.form_puani = (
                    100 if self.durum == "Doğru"
                    else 55 if "düzelt" in self.durum.casefold()
                    else 75
                )

        turkce_algilanan = next(
            (ad for ad, kod in HAREKETLER.items() if kod == algilanan),
            algilanan,
        )

        with self.lock:
            tekrar = self.tekrar
            durum = self.durum
            form_puani = self.form_puani
            aci_diz = self.aci_diz
            aci_kalca = self.aci_kalca
            aci_dirsek = self.aci_dirsek
            son_guven = self.son_guven

        # Kadraj dairesi kaldırıldı. Bilgiler korunuyor; küçük puntoyla
        # dört kısa satırda gösterildiği için görüntüyü kaplamaz.
        panel_genisligi = min(275, goruntu.shape[1] - 16)
        cv2.rectangle(goruntu, (8, 8), (panel_genisligi, 104), (15, 23, 42), -1)
        bilgi_satirlari = [
            f"İstenen: {hareket_adi}",
            f"Algılanan: {turkce_algilanan}  %{int(son_guven * 100)}",
            f"Tekrar: {tekrar}/{hedef_tekrar}   Form: %{form_puani}",
            f"Diz: {aci_diz}°  Kalça: {aci_kalca}°  Dirsek: {aci_dirsek}°  {durum}",
        ]
        durum_rengi = (80, 255, 140) if durum == "Doğru" else (80, 110, 255) if "düzelt" in durum.casefold() else (220, 235, 255)
        for sira, metin in enumerate(bilgi_satirlari):
            renk = durum_rengi if sira == 3 else (245, 248, 255)
            cv2.putText(
                goruntu, metin[:55], (15, 28 + sira * 21),
                cv2.FONT_HERSHEY_SIMPLEX, .34, renk, 1, cv2.LINE_AA,
            )

        return av.VideoFrame.from_ndarray(goruntu, format="bgr24")


@st.cache_data(ttl=15, show_spinner=False)
def sporcu_kayitlarini_getir(sporcu_id):
    if not sporcu_id:
        return pd.DataFrame()
    veri = (
        yeni_istemci().table("antrenmanlar").select(
            "id,sporcu_id,tarih,hareket,sure_saniye,toplam,dogru,hatali,basari_yuzdesi"
        )
        .eq("sporcu_id", sporcu_id).order("tarih").execute().data
    )
    eslesen = pd.DataFrame(veri)
    if eslesen.empty:
        return eslesen
    eslesen = eslesen.rename(columns={
        "tarih": "Tarih", "hareket": "Hareket",
        "sure_saniye": "Sure_Saniye", "toplam": "Toplam",
        "dogru": "Dogru", "hatali": "Hatali",
        "basari_yuzdesi": "Basari_Yuzdesi",
    })
    eslesen["Sporcu"] = sporcu_adi
    # Supabase zamanları UTC saklar; ekranda Türkiye saatine çevir.
    eslesen["Tarih"] = (
        pd.to_datetime(eslesen["Tarih"], errors="coerce", utc=True)
        .dt.tz_convert("Europe/Istanbul")
    )
    return eslesen


@st.cache_data(ttl=15, show_spinner=False)
def programlari_getir(sporcu_id):
    return (
        yeni_istemci().table("programlar").select(
            "id,hoca_id,sporcu_id,odev_no,tarih,baslangic_tarihi,bitis_tarihi,"
            "hareket,hedef_tekrar,notlar,durum,created_at"
        ).eq("sporcu_id", sporcu_id).order("tarih").execute().data
    )


@st.cache_data(ttl=15, show_spinner=False)
def bildirimleri_getir(sporcu_id):
    return (
        yeni_istemci().table("bildirimler").select(
            "id,odev_no,mesaj,okundu,created_at,profiles!bildirimler_hoca_id_fkey(ad_soyad)"
        ).eq("sporcu_id", sporcu_id).order("created_at", desc=True).execute().data
    )


kayitlar = sporcu_kayitlarini_getir(kullanici["id"])

programlar = programlari_getir(kullanici["id"])
program_df = pd.DataFrame(programlar)

bildirim_verisi = bildirimleri_getir(kullanici["id"])
okunmamis_sayisi = sum(not b.get("okundu", False) for b in bildirim_verisi)
bildirim_basligi = (
    f"🔔 Bildirimler ({okunmamis_sayisi})"
    if okunmamis_sayisi else "🔔 Bildirimler"
)

ana_sayfa, analiz, programim, sonuclar, bildirimler, profil = st.tabs([
    "🏠 Ana Sayfa",
    "📷 Hareket Analizi",
    "🗓️ Programım",
    "📊 Sonuçlarım",
    bildirim_basligi,
    "👤 Profil",
])

with ana_sayfa:
    st.subheader(
        f"Hoş geldin, {sporcu_adi}" if sporcu_adi else "Hoş geldiniz"
    )

    if not sporcu_adi:
        st.info("Sonuçlarınızı görmek için sol menüye sporcu adınızı yazın.")

    toplam_antrenman = len(kayitlar)
    toplam_tekrar = int(kayitlar["Toplam"].sum()) if not kayitlar.empty else 0
    dogru = int(kayitlar["Dogru"].sum()) if not kayitlar.empty else 0
    basari = dogru / toplam_tekrar * 100 if toplam_tekrar else 0

    puan = dogru * 10
    if not kayitlar.empty:
        puan += int((kayitlar["Basari_Yuzdesi"] >= 80).sum()) * 50

    bugun = datetime.now(ZoneInfo("Europe/Istanbul")).date()
    ozet_program = program_df.copy()
    bugunku_hareket = 0
    yaklasan_odev = "Program yok"
    if not ozet_program.empty:
        ozet_program["tarih_ozet"] = pd.to_datetime(
            ozet_program["tarih"], errors="coerce"
        ).dt.date
        bugunku_hareket = int((ozet_program["tarih_ozet"] == bugun).sum())
        gelecek = ozet_program[
            (ozet_program["tarih_ozet"] >= bugun)
            & (ozet_program["durum"] != "tamamlandi")
        ].sort_values("tarih_ozet")
        if not gelecek.empty:
            ilk_tarih = gelecek.iloc[0]["tarih_ozet"]
            yaklasan_odev = (
                "Bugün" if ilk_tarih == bugun else ilk_tarih.strftime("%d.%m.%Y")
            )

    son_basari = 0.0
    if not kayitlar.empty:
        son_deger = kayitlar.sort_values("Tarih").iloc[-1]["Basari_Yuzdesi"]
        son_basari = float(son_deger) if pd.notna(son_deger) else 0.0

    st.markdown(
        f"""
        <div class="sporcu-ozet-grid">
            <div class="sporcu-ozet-kart">
                <div class="ikon">📅</div><div class="baslik">BUGÜNKÜ PROGRAM</div>
                <div class="deger">{bugunku_hareket} hareket</div>
            </div>
            <div class="sporcu-ozet-kart">
                <div class="ikon">⏰</div><div class="baslik">YAKLAŞAN ÖDEV</div>
                <div class="deger">{yaklasan_odev}</div>
            </div>
            <div class="sporcu-ozet-kart">
                <div class="ikon">⭐</div><div class="baslik">TOPLAM PUAN</div>
                <div class="deger">{puan}</div>
            </div>
            <div class="sporcu-ozet-kart">
                <div class="ikon">📈</div><div class="baslik">SON BAŞARI</div>
                <div class="deger">%{son_basari:.1f}</div>
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

    k1, k2, k3 = st.columns(3)
    k1.metric("Toplam Antrenman", toplam_antrenman)
    k2.metric("Toplam Tekrar", toplam_tekrar)
    k3.metric("Genel Başarı", f"%{basari:.1f}")

    st.subheader("🏅 Başarı Rozetlerim")
    rozetler = []
    if toplam_antrenman >= 1:
        rozetler.append("🎬 İlk Antrenman")
    if dogru >= 100:
        rozetler.append("💯 100 Doğru Tekrar")
    if toplam_antrenman >= 5:
        rozetler.append("🔥 İstikrar Ustası")
    if toplam_tekrar and basari >= 80:
        rozetler.append("🎯 Form Ustası")
    if not kayitlar.empty and kayitlar["Hareket"].nunique() >= 5:
        rozetler.append("🏆 Beş Hareket Şampiyonu")
    if rozetler:
        st.success("   •   ".join(rozetler))
    else:
        st.info("İlk antrenmanını tamamlayarak ilk rozetini kazanabilirsin.")

    st.subheader("Bugünkü Program")
    st.info(
        f"Seçilen hareket: {hareket_adi} | Hedef: {hedef_tekrar} tekrar"
    )

    if not kayitlar.empty:
        son_kayit = kayitlar.sort_values("Tarih").iloc[-1]
        st.success(
            f"Son antrenman: {son_kayit['Hareket']} - "
            f"{int(son_kayit['Toplam'])} tekrar - "
            f"%{float(son_kayit['Basari_Yuzdesi']):.1f} başarı"
        )

with analiz:
    st.subheader("Canlı Hareket Analizi")
    if st.session_state.get("kayit_basarili_mesaji"):
        st.success(st.session_state.pop("kayit_basarili_mesaji"))

    if "analiz_sistemi_acik" not in st.session_state:
        st.session_state.analiz_sistemi_acik = False
    if "kamera_hazirlik_goster" not in st.session_state:
        st.session_state.kamera_hazirlik_goster = True

    kontrol_kolonu, durum_kolonu = st.columns([1, 3])
    with kontrol_kolonu:
        if not st.session_state.analiz_sistemi_acik:
            if st.button("📷 Kamerayı ve analizi aç", type="primary", use_container_width=True):
                st.session_state.analiz_sistemi_acik = True
                # Hazırlık listesi yalnızca ilk kamera açılışında gösterilir.
                st.session_state.kamera_hazirlik_goster = False
                st.rerun()
        elif st.button("■ Kamerayı kapat", use_container_width=True):
            st.session_state.analiz_sistemi_acik = False
            st.session_state.kamera_hazirlik_goster = True
            st.rerun()
    with durum_kolonu:
        if st.session_state.analiz_sistemi_acik:
            st.success("Analiz sistemi hazır. Kameradan START düğmesine basabilirsiniz.")
        else:
            st.info("Kamera kapalı. Ana sayfayı hızlandırmak için model yalnızca bu düğmeye bastığınızda yüklenir.")

    facing_mode = "environment" if kamera_yonu == "Arka kamera" else "user"
    kamera_kolonu, rehber_kolonu = st.columns([1, 1], gap="medium")
    kamera_baglami = None

    with kamera_kolonu:
        if not st.session_state.analiz_sistemi_acik:
            st.markdown(
                """
                <div class="kamera-hazirlik">
                    <b>✅ Kamera hazırlık kontrolü</b><br>
                    <span>☐ Tüm vücut kadrajda</span><span>☐ Telefon sabit</span>
                    <span>☐ Işık yüzünüze geliyor</span><span>☐ Kameraya 2 metre uzaklık</span>
                </div>
                """,
                unsafe_allow_html=True,
            )
            st.info("Kamerayı açmak için üstteki **Kamerayı ve analizi aç** düğmesine basın.")
        else:
            model_yukleme_alani = st.empty()
            model_yukleme_alani.markdown(
                '<div class="model-yukleniyor"><span class="model-yukleniyor-daire"></span><span>Hareket analiz sistemi hazırlanıyor...</span></div>',
                unsafe_allow_html=True,
            )
            model, model_sutunlari = modeli_yukle()
            model_yukleme_alani.empty()
            components.html(
                """
                <style>body{margin:0;background:transparent;font-family:Arial;text-align:center;color:#eafcff}.sayac{padding:10px;border:1px solid #67e8f9;border-radius:12px;background:rgba(4,42,70,.72);font-weight:800}.sayi{font-size:22px;color:#67e8f9}</style>
                <div class="sayac">Başlamaya hazırlan <span id="sayi" class="sayi">3</span></div>
                <script>let n=3,e=document.getElementById('sayi');let t=setInterval(()=>{n--;e.textContent=n>0?n:'HAZIR!';if(n<=0)clearInterval(t)},1000);</script>
                """,
                height=52,
            )
            st.info("Telefonu sabitleyin, tüm vücudunuzu gösterin ve START düğmesine basarak kamera izni verin.")
            kamera_baglami = webrtc_streamer(
                # Tek ve sabit anahtar: Streamlit aynı anda ikinci WebRTC
                # iframe'i eklemez; bu nedenle çift kamera oluşmaz.
                key="sporcu-kamera",
                mode=WebRtcMode.SENDRECV,
                video_processor_factory=HareketIslemcisi,
                media_stream_constraints={
                    "video": {"facingMode": facing_mode, "width": {"ideal": 480, "max": 640}, "height": {"ideal": 360, "max": 480}, "frameRate": {"ideal": 20, "max": 24}},
                    "audio": False,
                },
                async_processing=True,
            )

    with rehber_kolonu:
        adimlar = HAREKET_REHBERI.get(hareket_adi, [])
        adim_html = "".join(
            f'<div class="rehber-adimi"><span class="rehber-numara">{sira}</span>'
            f'<span>{adim}</span></div>'
            for sira, adim in enumerate(adimlar, start=1)
        )
        components.html(hareket_animasyonu_iframe(hareket_adi), height=294)
        st.markdown(
            f"""
            <div class="hareket-rehberi">
                <h3>🎯 {hareket_adi}</h3>
                <span class="hareket-hedefi">Hedef: {hedef_tekrar} tekrar</span>
                {adim_html}
            </div>
            """,
            unsafe_allow_html=True,
        )
        if "sesli_yonlendirme_degeri" not in st.session_state:
            st.session_state.sesli_yonlendirme_degeri = True
        sesli_antrenor = st.toggle(
            "🔊 Sesli yönlendirme",
            key="sesli_yonlendirme_degeri",
            help="Canlı düzeltmeleri telefon veya bilgisayardan sesli dinleyin.",
        )
        st.caption("Kamera açıkken anlık düzeltme burada gösterilir.")
        anlik_uyari_alani = st.empty()

    # WebRTC bileşenindeki START/STOP tıklamalarını işaretler. Böylece genel
    # sayfa yenilemelerinde yalnızca daire, kamera geçişlerinde ise açıklama
    # metni de gösterilir.
    components.html(
        """
        <script>
        (() => {
            const anaBelge = window.parent.document;

            function kameraIsaretiniKaldir() {
                delete anaBelge.documentElement.dataset.kameraGecis;
            }

            function kameraGecisiniBaslat() {
                anaBelge.documentElement.dataset.kameraGecis = "true";
                let beklemeGoruldu = false;
                const kontrol = window.setInterval(() => {
                    const bekliyor = !!anaBelge.querySelector('[data-stale="true"]');
                    if (bekliyor) beklemeGoruldu = true;
                    if (beklemeGoruldu && !bekliyor) {
                        window.clearInterval(kontrol);
                        kameraIsaretiniKaldir();
                    }
                }, 120);
                window.setTimeout(() => {
                    window.clearInterval(kontrol);
                    kameraIsaretiniKaldir();
                }, 12000);
            }

            function dugmeleriBul() {
                anaBelge.querySelectorAll('iframe').forEach((cerceve) => {
                    try {
                        const belge = cerceve.contentDocument;
                        if (!belge) return;
                        belge.querySelectorAll('button').forEach((dugme) => {
                            const yazi = (dugme.innerText || dugme.textContent || '')
                                .trim().toUpperCase();
                            if ((yazi === 'START' || yazi === 'STOP') &&
                                !dugme.dataset.kameraIzleyici) {
                                dugme.dataset.kameraIzleyici = '1';
                                dugme.addEventListener('click', kameraGecisiniBaslat);
                            }
                        });
                    } catch (_) {
                        // Tarayıcı bileşeni henüz hazır değilse sonraki turda denenir.
                    }
                });
            }

            dugmeleriBul();
            window.setInterval(dugmeleriBul, 750);
        })();
        </script>
        """,
        height=0,
    )

    if kamera_baglami is not None and kamera_baglami.state.playing and kamera_baglami.video_processor is not None:
        # Kamera açıkken sayfayı otomatik yenilemek WebRTC görüntüsünü kilitler
        # ve ekranın sürekli silik kalmasına neden olur. Bu nedenle uyarı,
        # güvenli biçimde mevcut kamera durumundan okunur.
        islemci = kamera_baglami.video_processor if kamera_baglami is not None else None
        with islemci.lock:
            anlik_mesaj = islemci.sesli_mesaj

        anlik_uyari_alani.info(f"🎧 Antrenör uyarısı: {anlik_mesaj}")

        simdi = time.time()
        son_mesaj = st.session_state.get("son_sesli_mesaj")
        son_zaman = st.session_state.get("son_sesli_mesaj_zamani", 0)
        if (
            sesli_antrenor
            and anlik_mesaj
            and (anlik_mesaj != son_mesaj or simdi - son_zaman >= 8)
        ):
            guvenli_mesaj = json.dumps(anlik_mesaj, ensure_ascii=False)
            components.html(
                f"""
                <script>
                const mesaj = {guvenli_mesaj};
                if ('speechSynthesis' in window) {{
                    window.speechSynthesis.cancel();
                    const ses = new SpeechSynthesisUtterance(mesaj);
                    ses.lang = 'tr-TR';
                    ses.rate = 0.95;
                    ses.pitch = 1.0;
                    window.speechSynthesis.speak(ses);
                }}
                </script>
                """,
                height=0,
            )
            st.session_state.son_sesli_mesaj = anlik_mesaj
            st.session_state.son_sesli_mesaj_zamani = simdi
    else:
        anlik_uyari_alani.info("Kamerayı başlatınca canlı yönlendirme burada görünecek.")

    if st.button("💾 Antrenmanı Kaydet", type="primary"):
        islemci = kamera_baglami.video_processor if kamera_baglami is not None else None

        if islemci is None:
            st.error("Önce START düğmesine basıp kamerayı çalıştırın.")
        else:
            with islemci.lock:
                toplam = int(islemci.tekrar)
                dogru = int(islemci.dogru)
                hatali = int(islemci.hatali)
                sure = int(time.time() - islemci.baslangic_zamani)
                kayit_anahtari = (
                    f"{islemci.baslangic_zamani:.3f}-{toplam}-{dogru}-{hatali}"
                )

            basari = dogru / toplam * 100 if toplam else 0
            if st.session_state.get("son_antrenman_kayit_anahtari") == kayit_anahtari:
                st.warning("Bu antrenman zaten kaydedildi. Çift kayıt oluşturulmadı.")
            else:
                try:
                    with st.spinner("Antrenman kaydediliyor, lütfen bekleyin..."):
                        yeni_istemci().table("antrenmanlar").insert({
                            "sporcu_id": kullanici["id"],
                            "hareket": hareket_adi,
                            "sure_saniye": sure,
                            "toplam": toplam,
                            "dogru": dogru,
                            "hatali": hatali,
                            "basari_yuzdesi": round(basari, 2),
                        }).execute()
                        yeni_istemci().table("programlar").update({
                            "durum": "tamamlandi"
                        }).eq("sporcu_id", kullanici["id"]).eq(
                            "hareket", hareket_adi
                        ).eq("tarih", datetime.now().date().isoformat()).eq(
                            "durum", "planlandi"
                        ).execute()
                    st.session_state.son_antrenman_kayit_anahtari = kayit_anahtari
                    kayit_mesaji = (
                        f"✅ Antrenman kaydedildi — Toplam: {toplam}, "
                        f"Doğru: {dogru}, Hatalı: {hatali}, "
                        f"Başarı: %{basari:.1f}"
                    )
                    kisisel_liste = st.session_state.get(
                        "kisisel_antrenman_listesi", []
                    )
                    siradaki_hareket = None
                    for liste_hareketi in kisisel_liste:
                        if (
                            liste_hareketi["hareket"] == hareket_adi
                            and not liste_hareketi["tamamlandi"]
                        ):
                            liste_hareketi["tamamlandi"] = True
                            break
                    for liste_hareketi in kisisel_liste:
                        if not liste_hareketi["tamamlandi"]:
                            siradaki_hareket = liste_hareketi
                            break
                    if siradaki_hareket:
                        st.session_state.programdan_hareket = siradaki_hareket["hareket"]
                        st.session_state.programdan_hedef = siradaki_hareket["hedef"]
                        kayit_mesaji += (
                            f" · Sıradaki: {siradaki_hareket['hareket']}"
                        )
                    elif kisisel_liste:
                        kayit_mesaji += " · Çoklu antrenman tamamlandı!"
                    st.session_state.kayit_basarili_mesaji = kayit_mesaji
                    # Kayıttan sonra WebRTC bileşeni temizlenir; hazırlık
                    # kutusu kalır, kamera ise yalnızca butonla açılır.
                    st.session_state.analiz_sistemi_acik = False
                    st.session_state.kamera_hazirlik_goster = True
                    st.rerun()
                except Exception as hata:
                    st.error(f"Antrenman kaydedilemedi: {hata}")

    st.warning(
        "Bu sistem uzman antrenör değerlendirmesinin yerine geçmez."
    )

with programim:
    st.subheader("🗓️ Antrenman Takvimim")
    secilen_gun = st.date_input("Tarihe göre görüntüle", value=datetime.now().date())

    if program_df.empty:
        st.info("Hocanız henüz size bir antrenman programı atamadı.")
    else:
        program_df["tarih"] = pd.to_datetime(program_df["tarih"]).dt.date
        program_df["baslangic_tarihi"] = pd.to_datetime(
            program_df["baslangic_tarihi"], errors="coerce"
        ).dt.date
        program_df["bitis_tarihi"] = pd.to_datetime(
            program_df["bitis_tarihi"], errors="coerce"
        ).dt.date
        gun_programi = program_df[
            (program_df["baslangic_tarihi"].fillna(program_df["tarih"]) <= secilen_gun)
            & (program_df["bitis_tarihi"].fillna(program_df["tarih"]) >= secilen_gun)
        ]
        if gun_programi.empty:
            st.caption("Bu tarihte atanmış antrenman yok.")
        else:
            for odev_no, odev_satirlari in gun_programi.groupby("odev_no", sort=True):
                st.markdown(f"## 📝 Ödev {int(odev_no)}")
                tamamlanan = int((odev_satirlari["durum"] == "tamamlandi").sum())
                odev_baslangici = odev_satirlari["baslangic_tarihi"].iloc[0]
                odev_bitisi = odev_satirlari["bitis_tarihi"].iloc[0]
                if pd.isna(odev_baslangici):
                    odev_baslangici = odev_satirlari["tarih"].iloc[0]
                if pd.isna(odev_bitisi):
                    odev_bitisi = odev_satirlari["tarih"].iloc[0]
                st.caption(
                    f"{odev_baslangici.strftime('%d.%m.%Y')}–"
                    f"{odev_bitisi.strftime('%d.%m.%Y')} · "
                    f"{tamamlanan}/{len(odev_satirlari)} hareket tamamlandı"
                )
                for _, satir in odev_satirlari.iterrows():
                    tamam = satir["durum"] == "tamamlandi"
                    bugun = datetime.now().date()
                    baslangic = satir["baslangic_tarihi"]
                    bitis = satir["bitis_tarihi"]
                    if pd.isna(baslangic):
                        baslangic = satir["tarih"]
                    if pd.isna(bitis):
                        bitis = satir["tarih"]
                    henuz_baslamadi = bugun < baslangic
                    tarihi_gecti = bugun > bitis
                    bugunun_odevi = baslangic <= bugun <= bitis
                    if tamam:
                        baslik, durum_sinifi = "✅ Tamamlandı", "odev-tamam"
                    elif tarihi_gecti:
                        baslik, durum_sinifi = "🔒 Süresi geçti — Yapılmadı", "odev-gecikti"
                    elif bugunun_odevi:
                        baslik, durum_sinifi = "⏳ Süresi devam ediyor", "odev-bugun"
                    else:
                        baslik, durum_sinifi = "🗓️ Henüz başlamadı", "odev-bekliyor"
                    with st.container(border=True):
                        st.markdown(
                            f'<span class="odev-durum {durum_sinifi}">{baslik}</span>',
                            unsafe_allow_html=True,
                        )
                        st.markdown(f"### {satir['hareket']}")
                        st.write(f"Hedef: **{int(satir['hedef_tekrar'])} tekrar**")
                        if satir.get("notlar"):
                            st.info(f"Hoca notu: {satir['notlar']}")
                        if not tamam and not tarihi_gecti and not henuz_baslamadi:
                            yap_kolonu, tamam_kolonu = st.columns(2)
                            if yap_kolonu.button(
                                "▶ Bu hareketi yap",
                                key=f"program-yap-{satir['id']}",
                                type="primary",
                                use_container_width=True,
                            ):
                                st.session_state.programdan_hareket = satir["hareket"]
                                st.session_state.programdan_hedef = int(
                                    satir["hedef_tekrar"]
                                )
                                st.rerun()
                            if tamam_kolonu.button(
                                "✓ Tamamlandı olarak işaretle",
                                key=f"program-tamamla-{satir['id']}",
                                use_container_width=True,
                            ):
                                yeni_istemci().table("programlar").update({
                                    "durum": "tamamlandi"
                                }).eq("id", int(satir["id"])).execute()
                                st.rerun()

        st.subheader("Yaklaşan Programlar")
        yaklasan = program_df[program_df["tarih"] >= datetime.now().date()].copy()
        if not yaklasan.empty:
            yaklasan = yaklasan.rename(columns={
                "odev_no": "Ödev",
                "tarih": "Tarih", "hareket": "Hareket",
                "hedef_tekrar": "Hedef", "notlar": "Not", "durum": "Durum",
            })
            st.dataframe(
                yaklasan[["Ödev", "Tarih", "Hareket", "Hedef", "Not", "Durum"]],
                use_container_width=True,
                hide_index=True,
            )

with sonuclar:
    st.subheader("Antrenman Sonuçlarım")

    if not sporcu_adi:
        st.info("Sol menüye sporcu adınızı yazın.")
    elif kayitlar.empty:
        st.warning("Bu sporcu adına ait kayıt bulunamadı.")
    else:
        hareket_filtresi = st.selectbox(
            "Hareket filtresi",
            ["Tümü"] + sorted(kayitlar["Hareket"].unique().tolist()),
        )

        gosterilecek = kayitlar.copy()
        if hareket_filtresi != "Tümü":
            gosterilecek = gosterilecek[
                gosterilecek["Hareket"] == hareket_filtresi
            ]

        ozet_toplam = int(gosterilecek["Toplam"].sum())
        ozet_dogru = int(gosterilecek["Dogru"].sum())
        ozet_hatali = int(gosterilecek["Hatali"].sum())
        ozet_basari = (
            100 * ozet_dogru / ozet_toplam if ozet_toplam else 0.0
        )
        o1, o2, o3, o4 = st.columns(4)
        o1.metric("Toplam Tekrar", ozet_toplam)
        o2.metric("Doğru", ozet_dogru)
        o3.metric("Hatalı", ozet_hatali)
        o4.metric("Başarı", f"%{ozet_basari:.1f}")

        hareket_ozeti = (
            gosterilecek.groupby("Hareket", as_index=False)[["Dogru", "Hatali"]]
            .sum()
            .melt(
                id_vars="Hareket",
                value_vars=["Dogru", "Hatali"],
                var_name="Sonuç",
                value_name="Tekrar",
            )
        )
        hareket_ozeti["Sonuç"] = hareket_ozeti["Sonuç"].replace({
            "Dogru": "Doğru", "Hatali": "Hatalı"
        })
        if not hareket_ozeti.empty:
            ozet_grafigi = (
                alt.Chart(hareket_ozeti)
                .mark_bar(cornerRadiusTopLeft=5, cornerRadiusTopRight=5)
                .encode(
                    x=alt.X("Hareket:N", title="Hareket"),
                    y=alt.Y("Tekrar:Q", title="Tekrar"),
                    color=alt.Color(
                        "Sonuç:N",
                        scale=alt.Scale(
                            domain=["Doğru", "Hatalı"],
                            range=["#10b981", "#ef4444"],
                        ),
                    ),
                    xOffset="Sonuç:N",
                    tooltip=["Hareket:N", "Sonuç:N", "Tekrar:Q"],
                )
                .properties(height=260, background="white")
            )
            st.altair_chart(ozet_grafigi, use_container_width=True)

        grafik = gosterilecek.dropna(subset=["Tarih"]).copy()
        if len(grafik) >= 2 and grafik["Basari_Yuzdesi"].notna().any():
            basari_grafigi = (
                alt.Chart(grafik)
                .mark_line(point=True, color="#2563eb", strokeWidth=3)
                .encode(
                    x=alt.X("Tarih:T", title="Tarih"),
                    y=alt.Y(
                        "Basari_Yuzdesi:Q",
                        title="Başarı (%)",
                        scale=alt.Scale(domain=[0, 100]),
                    ),
                    tooltip=[
                        alt.Tooltip("Tarih:T", title="Tarih"),
                        alt.Tooltip("Hareket:N", title="Hareket"),
                        alt.Tooltip(
                            "Basari_Yuzdesi:Q",
                            title="Başarı",
                            format=".1f",
                        ),
                    ],
                )
                .properties(height=280, background="white")
                .configure_axis(
                    labelColor="#172033",
                    titleColor="#172033",
                    gridColor="#e2e8f0",
                )
                .configure_view(stroke="#cbd5e1")
            )
            st.altair_chart(basari_grafigi, use_container_width=True)
        else:
            st.info(
                "Gelişim grafiği, en az iki antrenman kaydından sonra oluşacak."
            )

        # Teknik id alanlarını gizle ve önemli sütunları ekrana sığacak sıraya koy.
        tablo = gosterilecek[[
            "Tarih", "Hareket", "Sure_Saniye", "Toplam",
            "Dogru", "Hatali", "Basari_Yuzdesi",
        ]].copy()
        tablo["Tarih"] = tablo["Tarih"].dt.strftime("%d.%m.%Y %H:%M")
        tablo["Sure_Saniye"] = tablo["Sure_Saniye"].apply(
            lambda saniye: f"{int(saniye)} sn"
        )
        tablo["Basari_Yuzdesi"] = tablo["Basari_Yuzdesi"].apply(
            lambda oran: f"%{float(oran):.1f}"
        )
        tablo = tablo.rename(columns={
            "Sure_Saniye": "Süre",
            "Dogru": "Doğru",
            "Hatali": "Hatalı",
            "Basari_Yuzdesi": "Başarı",
        })
        tablo_stili = (
            tablo.style
            .set_properties(**{
                "background-color": "white",
                "color": "#111827",
                "border-color": "#cbd5e1",
            })
            .set_table_styles([{
                "selector": "th",
                "props": [
                    ("background-color", "#dbeafe"),
                    ("color", "#172033"),
                    ("font-weight", "700"),
                ],
            }])
        )
        st.dataframe(
            tablo_stili,
            use_container_width=True,
            hide_index=True,
            height=min(430, 40 + len(tablo) * 36),
            column_config={
                "Tarih": st.column_config.TextColumn("Tarih", width="medium"),
                "Hareket": st.column_config.TextColumn("Hareket", width="small"),
                "Süre": st.column_config.TextColumn("Süre", width="small"),
                "Toplam": st.column_config.NumberColumn("Toplam", width="small"),
                "Doğru": st.column_config.NumberColumn("Doğru", width="small"),
                "Hatalı": st.column_config.NumberColumn("Hatalı", width="small"),
                "Başarı": st.column_config.TextColumn("Başarı", width="small"),
            },
        )

with bildirimler:
    st.subheader("🔔 Hoca Bildirimlerim")
    if not bildirim_verisi:
        st.info("Henüz hocanızdan bir bildirim gelmedi.")
    else:
        for bildirim in bildirim_verisi:
            hoca = bildirim.get("profiles") or {}
            hoca_adi_bildirim = hoca.get("ad_soyad", "Hoca")
            tarih = pd.to_datetime(
                bildirim.get("created_at"), utc=True
            ).tz_convert("Europe/Istanbul").strftime("%d.%m.%Y %H:%M")
            okundu = bool(bildirim.get("okundu"))
            simge = "✅" if okundu else "🟠"
            with st.container(border=True):
                odev_no = bildirim.get("odev_no")
                odev_etiketi = f" · **Ödev {odev_no}**" if odev_no else ""
                st.markdown(
                    f"**{simge} {hoca_adi_bildirim}**{odev_etiketi} · {tarih}"
                )
                st.write(bildirim.get("mesaj", ""))
                if not okundu and st.button(
                    "Okundu olarak işaretle",
                    key=f"bildirim-okundu-{bildirim['id']}",
                ):
                    try:
                        yeni_istemci().table("bildirimler").update({
                            "okundu": True
                        }).eq("id", int(bildirim["id"])).execute()
                        st.rerun()
                    except Exception as hata:
                        st.error(f"Bildirim güncellenemedi: {hata}")

with profil:
    st.subheader("👤 Profilim")
    st.caption("Hesap bilgileriniz ve antrenman gelişiminiz")

    try:
        profil_bilgisi = (
            yeni_istemci().table("profiles")
            .select(
                "id,ad_soyad,email,rol,created_at,dogum_tarihi,boy_cm,"
                "kilo_kg,seviye,sakatlik_notu,saglik_verisi_onayi"
            )
            .eq("id", kullanici["id"]).single().execute().data
        ) or {}
    except Exception:
        profil_bilgisi = kullanici.copy()

    p1, p2, p3, p4 = st.columns(4)
    p1.metric("Antrenman", toplam_antrenman)
    p2.metric("Doğru Tekrar", dogru)
    p3.metric("Başarı", f"%{basari:.1f}")
    p4.metric("Puan", puan)

    st.markdown("#### Hesap Bilgileri")
    yeni_ad_soyad = st.text_input(
        "Ad soyad",
        value=profil_bilgisi.get("ad_soyad") or sporcu_adi or "",
        key="profil_ad_soyad",
    )
    st.text_input(
        "E-posta",
        value=profil_bilgisi.get("email") or kullanici.get("email", ""),
        disabled=True,
    )
    st.text_input("Hesap türü", value="Sporcu", disabled=True)

    kayit_tarihi = profil_bilgisi.get("created_at")
    if kayit_tarihi:
        kayit_tarihi = pd.to_datetime(kayit_tarihi, errors="coerce")
        if not pd.isna(kayit_tarihi):
            st.caption(f"Kayıt tarihi: {kayit_tarihi.strftime('%d.%m.%Y')}")

    if st.button("Bilgilerimi kaydet", type="primary", key="profil_kaydet"):
        temiz_ad = yeni_ad_soyad.strip()
        if len(temiz_ad) < 2:
            st.warning("Ad soyad en az 2 karakter olmalıdır.")
        else:
            try:
                yeni_istemci().table("profiles").update({
                    "ad_soyad": temiz_ad
                }).eq("id", kullanici["id"]).execute()
                st.session_state.sporcu_kullanici["ad_soyad"] = temiz_ad
                st.success("Profil bilgileriniz kaydedildi.")
                st.rerun()
            except Exception as hata:
                st.error(f"Profil güncellenemedi: {hata}")

    st.markdown("#### İsteğe Bağlı Spor Bilgileri")
    st.caption(
        "Bu alanları doldurmak zorunlu değildir. Sağlık notları yalnızca "
        "açık onayınızla kaydedilir."
    )
    varsayilan_tarih = pd.to_datetime(
        profil_bilgisi.get("dogum_tarihi"), errors="coerce"
    )
    if pd.isna(varsayilan_tarih):
        varsayilan_tarih = datetime.now().date()
    else:
        varsayilan_tarih = varsayilan_tarih.date()
    s1, s2, s3 = st.columns(3)
    dogum_tarihi = s1.date_input(
        "Doğum tarihi", value=varsayilan_tarih, key="profil_dogum"
    )
    boy_cm = s2.number_input(
        "Boy (cm)", min_value=0, max_value=250,
        value=int(profil_bilgisi.get("boy_cm") or 0), key="profil_boy"
    )
    kilo_kg = s3.number_input(
        "Kilo (kg)", min_value=0.0, max_value=400.0, step=0.1,
        value=float(profil_bilgisi.get("kilo_kg") or 0), key="profil_kilo"
    )
    seviye_secenekleri = ["Başlangıç", "Orta", "İleri"]
    mevcut_seviye = profil_bilgisi.get("seviye") or "Başlangıç"
    if mevcut_seviye not in seviye_secenekleri:
        mevcut_seviye = "Başlangıç"
    seviye = st.selectbox(
        "Spor seviyesi", seviye_secenekleri,
        index=seviye_secenekleri.index(mevcut_seviye), key="profil_seviye"
    )
    sakatlik_notu = st.text_area(
        "Sakatlık veya dikkat edilmesi gereken durum",
        value=profil_bilgisi.get("sakatlik_notu") or "",
        placeholder="Yoksa boş bırakabilirsiniz.", key="profil_sakatlik"
    )
    saglik_onayi = st.checkbox(
        "Bu isteğe bağlı sağlık bilgilerimin kaydedilmesine izin veriyorum.",
        value=bool(profil_bilgisi.get("saglik_verisi_onayi")),
        key="profil_saglik_onayi",
    )
    if st.button("Spor bilgilerimi kaydet", key="profil_spor_kaydet"):
        if not saglik_onayi:
            st.warning("Bilgileri kaydetmek için onay kutusunu işaretleyin.")
        else:
            try:
                yeni_istemci().table("profiles").update({
                    "dogum_tarihi": dogum_tarihi.isoformat(),
                    "boy_cm": boy_cm or None,
                    "kilo_kg": kilo_kg or None,
                    "seviye": seviye,
                    "sakatlik_notu": sakatlik_notu.strip(),
                    "saglik_verisi_onayi": True,
                    "profil_guncelleme_zamani": datetime.now(ZoneInfo("Europe/Istanbul")).isoformat(),
                }).eq("id", kullanici["id"]).execute()
                st.success("Spor bilgileriniz kaydedildi.")
                st.rerun()
            except Exception as hata:
                st.error(f"Spor bilgileri kaydedilemedi: {hata}")

    st.markdown("#### 👨‍🏫 Bağlı Hocam")
    onayli_baglanti = next(
        (b for b in baglantilar if b.get("durum") == "onaylandi"), None
    )
    if onayli_baglanti:
        hoca_sonucu = (
            yeni_istemci().table("profiles").select("ad_soyad,email")
            .eq("id", onayli_baglanti["hoca_id"]).limit(1).execute().data
        )
        bagli_hoca = hoca_sonucu[0] if hoca_sonucu else {}
        st.success(f"✓ {bagli_hoca.get('ad_soyad') or 'Hoca'}")
    else:
        st.info("Henüz onaylanmış bir hoca bağlantınız yok.")

    st.markdown("#### 🏅 Rozetlerim")
    if rozetler:
        for rozet in rozetler:
            st.write(rozet)
    else:
        st.caption("İlk antrenmanınızı tamamlayınca rozet kazanmaya başlayacaksınız.")

# Sayfa üzerindeki koyu zeminde tüm ana başlıklar ve metrik değerleri okunur kalsın.
st.markdown("""
<style>
[data-testid="stMain"] .stMarkdown h1, [data-testid="stMain"] .stMarkdown h2, [data-testid="stMain"] .stMarkdown h3 { color:#f8fcff !important; text-shadow:0 2px 12px rgba(0,0,0,.65); }
[data-testid="stMain"] [data-testid="stHeading"] h1,
[data-testid="stMain"] [data-testid="stHeading"] h2,
[data-testid="stMain"] [data-testid="stHeading"] h3,
[data-testid="stMain"] [data-testid="stHeading"] div,
[data-testid="stMain"] [data-testid="stHeading"] span { color:#f8fcff !important; text-shadow:0 2px 12px rgba(0,0,0,.65); }
[data-testid="stMain"] [data-testid="stMetric"] [data-testid="stMetricLabel"] p { color:#b9e9f5 !important; }
[data-testid="stMain"] [data-testid="stMetric"] [data-testid="stMetricValue"] { color:#ffffff !important; }
.sporcu-ozet-kart .baslik { color:#36536d !important; }.sporcu-ozet-kart .deger { color:#082f49 !important; }
[data-testid="stTabs"] button { color:#e5f8ff !important; font-weight:700 !important; }
</style>
""", unsafe_allow_html=True)

st.markdown(
    """
    <style>
    /* Son tema katmanı: arka plan görünür, kartlar saydam ve bütün yazılar nettir. */
    .stApp, [data-testid="stAppViewContainer"] {
        background:
            linear-gradient(115deg, rgba(4, 37, 57, .42), rgba(8, 90, 112, .30)),
            url("data:image/png;base64,__ARKAPLAN_VERISI__") center / cover fixed !important;
        color: #edfaff !important;
    }
    [data-testid="stHeader"] {
        background: rgba(5, 36, 55, .56) !important;
        border-bottom-color: rgba(186, 230, 253, .34) !important;
        backdrop-filter: blur(16px);
    }
    [data-testid="stSidebar"] {
        background: linear-gradient(180deg, rgba(5, 61, 86, .84), rgba(8, 44, 71, .78)) !important;
        border-right: 1px solid rgba(186, 230, 253, .24);
        backdrop-filter: blur(16px);
    }
    [data-testid="stMain"] { background: transparent !important; }
    [data-testid="stMain"] h1,
    [data-testid="stMain"] h2,
    [data-testid="stMain"] h3,
    [data-testid="stMain"] p,
    [data-testid="stMain"] label,
    [data-testid="stMain"] span { color: #edfaff !important; }
    [data-testid="stMetric"],
    [data-testid="stVerticalBlockBorderWrapper"],
    [data-testid="stExpander"],
    .sporcu-ozet-kart,
    .model-yukleniyor {
        background: rgba(5, 37, 54, .62) !important;
        border: 1px solid rgba(125, 211, 252, .48) !important;
        box-shadow: 0 14px 34px rgba(0, 22, 35, .22) !important;
        backdrop-filter: blur(15px);
        -webkit-backdrop-filter: blur(15px);
    }
    [data-testid="stMetricLabel"] p,
    .sporcu-ozet-kart .baslik { color: #c4eaf5 !important; }
    [data-testid="stMetricValue"],
    .sporcu-ozet-kart .deger { color: #ffffff !important; }
    [data-testid="stTabs"] [data-baseweb="tab-list"] {
        background: rgba(5, 37, 54, .52) !important;
        border-color: rgba(186, 230, 253, .34) !important;
        backdrop-filter: blur(12px);
    }
    [data-testid="stTabs"] button { color: #e8faff !important; }
    [aria-selected="true"][data-baseweb="tab"] {
        color: #ffffff !important;
        border-bottom-color: #67e8f9 !important;
    }
    .hareket-rehberi {
        background: rgba(5, 37, 54, .72) !important;
        border-color: rgba(125, 211, 252, .48) !important;
        backdrop-filter: blur(14px);
    }
    .hareket-rehberi h3 { color: #ffffff !important; }
    .hareket-rehberi .hareket-hedefi {
        color: #e0f7ff !important;
        background: rgba(14, 116, 144, .72) !important;
    }
    .hareket-rehberi .rehber-adimi { color: #e8faff !important; }
    .hareket-rehberi .rehber-adimi > span:last-child { color: #e8faff !important; }
    .rehber-numara { background: #0284c7 !important; color: #ffffff !important; }
    .kamera-hazirlik {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: .55rem;
        padding: 1rem;
        border: 1px solid rgba(125, 211, 252, .48);
        border-radius: 16px;
        background: rgba(5, 37, 54, .64);
        color: #e8faff !important;
        backdrop-filter: blur(14px);
    }
    .kamera-hazirlik b { grid-column: 1 / -1; color: #ffffff !important; }
    .kamera-hazirlik span { color: #d6f4ff !important; font-size: .9rem; }
    </style>
    """.replace("__ARKAPLAN_VERISI__", arkaplan_verisi),
    unsafe_allow_html=True,
)

