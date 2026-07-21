import os
import json
import base64
from datetime import datetime, timedelta
from io import BytesIO

import pandas as pd
import extra_streamlit_components as stx
import streamlit as st
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)
from supabase import create_client


st.set_page_config(
    page_title="Akıllı Spor Salonu",
    page_icon="🏋️",
    layout="wide",
)


def hoca_arka_plan_verisi():
    yol = os.path.join(os.path.dirname(__file__), "hoca_panel_arka_plan.jpg")
    try:
        with open(yol, "rb") as dosya:
            return base64.b64encode(dosya.read()).decode("utf-8")
    except OSError:
        return ""


_hoca_arka_plan = hoca_arka_plan_verisi()

_cookie_manager = stx.CookieManager(key="hoca_cerezleri")


def yeni_istemci():
    istemci = create_client(st.secrets["SUPABASE_URL"], st.secrets["SUPABASE_KEY"])
    access = st.session_state.get("sb_access_token")
    refresh = st.session_state.get("sb_refresh_token")
    if access and refresh:
        istemci.auth.set_session(access, refresh)
    return istemci


def oturumu_kaydet(oturum, panel="hoca"):
    st.session_state.sb_access_token = oturum.access_token
    st.session_state.sb_refresh_token = oturum.refresh_token
    _cookie_manager.set(
        f"akilli_spor_{panel}_oturumu",
        json.dumps({"access_token": oturum.access_token, "refresh_token": oturum.refresh_token}),
        expires_at=datetime.now() + timedelta(days=14),
        same_site="lax",
    )


def oturumu_cerezden_yukle(panel="hoca"):
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


def oturumu_temizle(panel="hoca"):
    st.session_state.pop("sb_access_token", None)
    st.session_state.pop("sb_refresh_token", None)
    try:
        _cookie_manager.delete(f"akilli_spor_{panel}_oturumu")
    except Exception:
        pass


if "hoca_kullanici" not in st.session_state:
    st.session_state.hoca_kullanici = None

if st.session_state.hoca_kullanici is None and oturumu_cerezden_yukle("hoca"):
    try:
        kullanici_cevabi = yeni_istemci().auth.get_user()
        profil = (
            yeni_istemci().table("profiles").select("id, ad_soyad, rol")
            .eq("id", str(kullanici_cevabi.user.id)).single().execute().data
        )
        if profil and profil["rol"] == "hoca":
            profil["email"] = kullanici_cevabi.user.email
            st.session_state.hoca_kullanici = profil
    except Exception:
        oturumu_temizle("hoca")

st.markdown(
    """
    <style>
    .stApp, [data-testid="stAppViewContainer"] {
        background:
            linear-gradient(115deg, rgba(2, 25, 20, .72), rgba(3, 74, 57, .56)),
            url("data:image/jpeg;base64,__HOCA_ARKA_PLAN__") center / cover fixed;
        color: #f3fffb;
    }
    .hoca-giris-baslik {
        text-align: center;
        padding: 12px 8px 20px;
    }
    .hoca-giris-ikon {
        width: 76px;
        height: 76px;
        margin: 0 auto 10px;
        display: grid;
        place-items: center;
        border-radius: 22px;
        font-size: 38px;
        background: linear-gradient(135deg, #059669, #14b8a6);
        box-shadow: 0 12px 28px rgba(5, 150, 105, .25);
    }
    .hoca-giris-baslik h1 {
        margin: 0;
        color: #f3fffb !important;
        font-size: 2.15rem;
    }
    .hoca-giris-baslik p {
        margin: 8px 0 0;
        color: #d1fae5 !important;
        font-size: 1rem;
    }
    [data-testid="stVerticalBlockBorderWrapper"] {
        background: rgba(4, 45, 36, .72);
        border: 1px solid rgba(167, 243, 208, .40) !important;
        border-radius: 24px !important;
        box-shadow: 0 18px 48px rgba(0, 0, 0, .32);
        backdrop-filter: blur(12px);
    }
    [data-testid="stWidgetLabel"] p {
        color: #ecfdf5 !important;
        font-weight: 700 !important;
    }
    div[data-baseweb="input"] {
        background: rgba(15, 23, 42, .88) !important;
        border: 1px solid rgba(167, 243, 208, .46) !important;
        border-radius: 12px !important;
    }
    div[data-baseweb="input"] input {
        color: #ecfdf5 !important;
        -webkit-text-fill-color: #ecfdf5 !important;
    }
    div[data-baseweb="input"]:focus-within {
        border-color: #059669 !important;
        box-shadow: 0 0 0 3px rgba(5, 150, 105, .16) !important;
    }
    .stButton > button[kind="primary"] {
        width: 100%;
        min-height: 48px;
        border: 0 !important;
        border-radius: 12px !important;
        color: white !important;
        font-weight: 800 !important;
        background: linear-gradient(90deg, #047857, #14b8a6) !important;
        box-shadow: 0 8px 20px rgba(5, 150, 105, .24);
    }
    .stButton > button[kind="primary"]:hover {
        transform: translateY(-1px);
        box-shadow: 0 11px 24px rgba(5, 150, 105, .32);
    }
    </style>
    """.replace("__HOCA_ARKA_PLAN__", _hoca_arka_plan),
    unsafe_allow_html=True,
)

if st.session_state.hoca_kullanici is None:
    sol, orta, sag = st.columns([1, 1.15, 1])
    with orta:
        with st.container(border=True):
            st.markdown(
                """
                <div class="hoca-giris-baslik">
                    <div class="hoca-giris-ikon">👩‍🏫</div>
                    <h1>Hoca Girişi</h1>
                    <p>Sporcularınızı takip etmek ve program oluşturmak için giriş yapın.</p>
                </div>
                """,
                unsafe_allow_html=True,
            )
            hoca_giris_adi = st.text_input(
                "E-posta",
                placeholder="ornek@eposta.com",
                key="hoca_giris_email",
            )
            hoca_giris_sifre = st.text_input(
                "Şifre",
                type="password",
                placeholder="Şifrenizi girin",
                key="hoca_giris_sifre",
            )

            if st.button("Giriş yap", type="primary", use_container_width=True):
                try:
                    cevap = yeni_istemci().auth.sign_in_with_password({
                        "email": hoca_giris_adi.strip(),
                        "password": hoca_giris_sifre,
                    })
                    oturumu_kaydet(cevap.session, "hoca")
                    istemci = yeni_istemci()
                    profil = (
                        istemci.table("profiles").select("id, ad_soyad, rol")
                        .eq("id", str(cevap.user.id)).single().execute().data
                    )
                    if profil["rol"] != "hoca":
                        oturumu_temizle("hoca")
                        st.error("Bu hesap hoca hesabı olarak yetkilendirilmemiş.")
                    else:
                        profil["email"] = hoca_giris_adi.strip()
                        st.session_state.hoca_kullanici = profil
                        st.rerun()
                except Exception as hata:
                    oturumu_temizle("hoca")
                    st.error(f"Giriş hatası: {hata}")

            with st.expander("🔑 Şifremi unuttum"):
                sifre_eposta = st.text_input(
                    "Kayıtlı e-posta adresiniz",
                    placeholder="ornek@eposta.com",
                    key="hoca_sifre_eposta",
                )
                if st.button(
                    "Sıfırlama bağlantısı gönder",
                    use_container_width=True,
                    key="hoca_sifre_sifirla",
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

            st.caption(
                "Yalnızca yönetici tarafından hoca olarak yetkilendirilen hesaplar giriş yapabilir."
            )

    st.stop()

st.markdown(
    """
    <style>
    :root {
        --hoca-koyu: #064e3b;
        --hoca-ana: #059669;
        --hoca-acik: #14b8a6;
        --hoca-zemin: #ecfdf5;
        --hoca-yazi: #12372d;
    }
    .stApp, [data-testid="stAppViewContainer"] {
        background:
            linear-gradient(115deg, rgba(2,25,20,.74), rgba(3,74,57,.58)),
            url("data:image/jpeg;base64,__HOCA_ARKA_PLAN__") center / cover fixed;
        color: #ecfdf5;
    }
    [data-testid="stAppViewContainer"] h1,
    [data-testid="stAppViewContainer"] h2,
    [data-testid="stAppViewContainer"] h3,
    [data-testid="stAppViewContainer"] p,
    [data-testid="stAppViewContainer"] span { color: #172033; }
    /* Koyu ve flu arka planda başlıklar ile sporcu kartları net kalsın. */
    [data-testid="stMain"] h1,
    [data-testid="stMain"] h2,
    [data-testid="stMain"] h3 {
        color: #f8fffc !important;
        text-shadow: 0 2px 12px rgba(0,0,0,.72);
    }
    .bagli-sporcu-adi {
        color: #ffffff !important;
        font-size: 1.55rem;
        font-weight: 850;
        line-height: 1.3;
        text-shadow: 0 2px 10px rgba(0,0,0,.8);
    }
    .bagli-sporcu-aciklama {
        margin-top: .35rem;
        color: #d1fae5 !important;
        font-size: .98rem;
        font-weight: 600;
    }
    [data-testid="stMetric"] {
        background: white;
        border: 1px solid #a7f3d0;
        border-top: 5px solid var(--hoca-ana);
        border-radius: 18px;
        padding: 18px;
        box-shadow: 0 8px 24px rgba(6,78,59,.10);
    }
    [data-testid="stMetricLabel"] p {
        color: #475569 !important;
        font-weight: 600;
    }
    [data-testid="stMetricValue"] { color: #111827 !important; }
    [data-testid="stCaptionContainer"] p { color: #64748b !important; }
    [data-testid="stDownloadButton"] button,
    [data-testid="stButton"] button,
    [data-testid="stFormSubmitButton"] button {
        background: linear-gradient(135deg, var(--hoca-ana), var(--hoca-acik)) !important;
        color: white !important;
        border: 2px solid #047857 !important;
        border-radius: 12px !important;
        font-weight: 700 !important;
        padding: 0.65rem 1rem !important;
        box-shadow: 0 5px 14px rgba(5,150,105,.25);
    }
    [data-testid="stDownloadButton"] button:hover,
    [data-testid="stButton"] button:hover,
    [data-testid="stFormSubmitButton"] button:hover {
        background: linear-gradient(135deg, #047857, #0f766e) !important;
        border-color: #065f46 !important;
    }
    [data-testid="stDownloadButton"] button p,
    [data-testid="stDownloadButton"] button span,
    [data-testid="stButton"] button p,
    [data-testid="stButton"] button span,
    [data-testid="stFormSubmitButton"] button p,
    [data-testid="stFormSubmitButton"] button span {
        color: #ffffff !important;
    }
    [data-baseweb="select"] > div {
        background-color: white !important;
        color: #111827 !important;
        border: 2px solid #94a3b8 !important;
        border-radius: 10px !important;
    }
    [data-baseweb="select"] span,
    [data-baseweb="select"] input {
        color: #111827 !important;
    }
    [data-testid="stTextArea"] textarea,
    [data-testid="stTextInput"] input,
    [data-testid="stNumberInput"] input,
    [data-testid="stDateInput"] input {
        background-color: #ffffff !important;
        color: #111827 !important;
        caret-color: #2563eb !important;
        border: 2px solid #60a5fa !important;
        border-radius: 10px !important;
        font-weight: 600 !important;
        opacity: 1 !important;
    }
    [data-testid="stTextInput"] input:disabled,
    [data-testid="stTextArea"] textarea:disabled,
    [data-testid="stDateInput"] input:disabled {
        background: #e2e8f0 !important;
        color: #334155 !important;
        -webkit-text-fill-color: #334155 !important;
        border-color: #94a3b8 !important;
        opacity: 1 !important;
    }
    [data-testid="stTextArea"] textarea:focus,
    [data-testid="stTextInput"] input:focus,
    [data-testid="stNumberInput"] input:focus,
    [data-testid="stDateInput"] input:focus {
        border-color: #2563eb !important;
        box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.20) !important;
    }
    [data-testid="stTextArea"] textarea::placeholder,
    [data-testid="stTextInput"] input::placeholder {
        color: #64748b !important;
        opacity: 1 !important;
    }
    div[data-baseweb="textarea"],
    div[data-baseweb="textarea"] > div,
    div[data-baseweb="base-input"] {
        background-color: #ffffff !important;
    }
    div[data-baseweb="textarea"] textarea,
    [data-testid="stTextArea"] textarea {
        background: #ffffff !important;
        color: #0f172a !important;
        -webkit-text-fill-color: #0f172a !important;
        caret-color: #2563eb !important;
        font-size: 1rem !important;
        font-weight: 600 !important;
        line-height: 1.5 !important;
        opacity: 1 !important;
    }
    div[data-baseweb="textarea"] textarea::selection {
        background: #bfdbfe !important;
        color: #0f172a !important;
    }
    [role="listbox"] {
        background-color: white !important;
        border: 1px solid #94a3b8 !important;
    }
    [role="option"] { color: #111827 !important; }
    [role="option"]:hover { background-color: #dbeafe !important; }
    [data-testid="stSidebar"] {
        background: linear-gradient(180deg, #052e2b 0%, var(--hoca-koyu) 55%, #134e4a 100%);
        border-right: 1px solid #0f766e;
    }
    [data-testid="stSidebar"] p,
    [data-testid="stSidebar"] span,
    [data-testid="stSidebar"] label {
        color: #f8fafc !important;
        font-weight: 600;
    }
    [data-testid="stSidebar"] [data-testid="stAlert"] {
        border: 1px solid #60a5fa !important;
        border-radius: 12px !important;
        box-shadow: 0 5px 14px rgba(0, 0, 0, 0.22);
    }
    [data-testid="stSidebar"] [data-testid="stAlert"] p {
        color: #ffffff !important;
    }
    [data-testid="stSidebar"] [data-testid="stButton"] button {
        width: 100%;
        background: #ef4444 !important;
        border-color: #dc2626 !important;
        color: #ffffff !important;
    }
    [data-testid="stSidebar"] [data-testid="stButton"] button:hover {
        background: #dc2626 !important;
        border-color: #b91c1c !important;
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
    [data-testid="stElementToolbar"] {
        background: #2563eb !important;
        border: 2px solid #60a5fa !important;
        border-radius: 10px !important;
        box-shadow: 0 4px 12px rgba(37, 99, 235, 0.30) !important;
        opacity: 1 !important;
        visibility: visible !important;
    }
    [data-testid="stElementToolbar"] button {
        background: transparent !important;
        color: #ffffff !important;
        opacity: 1 !important;
    }
    [data-testid="stElementToolbar"] button:hover {
        background: #1d4ed8 !important;
    }
    [data-testid="stElementToolbar"] svg {
        fill: #ffffff !important;
        stroke: #ffffff !important;
        color: #ffffff !important;
        opacity: 1 !important;
    }
    [data-testid="stDataFrame"] {
        border: 2px solid #5eead4 !important;
        border-radius: 16px !important;
        overflow: hidden !important;
        box-shadow: 0 5px 16px rgba(15, 23, 42, 0.16) !important;
    }
    [data-baseweb="tab"] { color: #334155 !important; font-weight: 700 !important; }
    [aria-selected="true"][data-baseweb="tab"] { color: #1d4ed8 !important; }
    [data-testid="stAlert"] p,
    [data-testid="stAlert"] span { color: #0f172a !important; font-weight: 600 !important; }
    .hoca-hero {
        background: linear-gradient(125deg, var(--hoca-koyu), var(--hoca-ana) 62%, var(--hoca-acik));
        color: #ffffff;
        border-radius: 24px;
        padding: 28px 32px;
        margin: .25rem 0 1.6rem;
        box-shadow: 0 14px 34px rgba(6,78,59,.20);
        border: 1px solid rgba(255,255,255,.25);
    }
    .hoca-hero h1, .hoca-hero p { color: #ffffff !important; margin: 0; }
    .hoca-hero h1 { font-size: clamp(1.7rem, 4vw, 2.6rem); margin-bottom: .45rem; }
    .hoca-hero p { font-size: 1.05rem; opacity: .94; }
    [data-testid="stForm"],
    [data-testid="stExpander"],
    [data-testid="stVerticalBlockBorderWrapper"] {
        background: rgba(255,255,255,.94) !important;
        border: 1px solid #a7f3d0 !important;
        border-radius: 18px !important;
        box-shadow: 0 8px 22px rgba(6,78,59,.08) !important;
    }
    [data-testid="stForm"] { padding: 1.2rem !important; }
    h2, h3 { color: var(--hoca-koyu) !important; }
    div[data-baseweb="tab-list"] {
        background: rgba(255,255,255,.88);
        border: 1px solid #a7f3d0;
        border-radius: 14px;
        padding: .25rem .45rem;
    }
    [aria-selected="true"][data-baseweb="tab"] {
        color: #047857 !important;
        border-bottom-color: #10b981 !important;
    }
    @media (max-width: 720px) {
        .hoca-hero { padding: 22px 20px; border-radius: 18px; }
        .hoca-hero h1 { font-size: 1.65rem; }
        [data-testid="column"] { min-width: 100% !important; }
    }
    </style>
    """.replace("__HOCA_ARKA_PLAN__", _hoca_arka_plan),
    unsafe_allow_html=True,
)


def pdf_fontunu_hazirla():
    font_yollari = [
        "C:/Windows/Fonts/arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]

    for font_yolu in font_yollari:
        if os.path.exists(font_yolu):
            pdfmetrics.registerFont(TTFont("RaporFont", font_yolu))
            return "RaporFont"

    return "Helvetica"


def pdf_olustur(veriler, baslik):
    tampon = BytesIO()
    font = pdf_fontunu_hazirla()

    belge = SimpleDocTemplate(
        tampon,
        pagesize=landscape(A4),
        rightMargin=1.2 * cm,
        leftMargin=1.2 * cm,
        topMargin=1.2 * cm,
        bottomMargin=1.2 * cm,
    )

    stiller = getSampleStyleSheet()
    baslik_stili = ParagraphStyle(
        "RaporBasligi",
        parent=stiller["Title"],
        fontName=font,
        fontSize=18,
        textColor=colors.HexColor("#172033"),
        alignment=TA_CENTER,
        spaceAfter=12,
    )

    toplam = int(veriler["Toplam"].sum())
    dogru = int(veriler["Dogru"].sum())
    hatali = int(veriler["Hatali"].sum())
    basari = dogru / toplam * 100 if toplam else 0

    elemanlar = [
        Paragraph(baslik, baslik_stili),
        Paragraph(
            f"Toplam tekrar: {toplam} &nbsp;&nbsp; "
            f"Doğru: {dogru} &nbsp;&nbsp; Hatalı: {hatali} &nbsp;&nbsp; "
            f"Başarı: %{basari:.1f}",
            ParagraphStyle(
                "Ozet",
                parent=stiller["Normal"],
                fontName=font,
                fontSize=11,
                alignment=TA_CENTER,
                spaceAfter=14,
            ),
        ),
        Spacer(1, 0.2 * cm),
    ]

    tablo = [[
        "Sporcu", "Tarih", "Hareket", "Süre", "Toplam",
        "Doğru", "Hatalı", "Başarı"
    ]]

    for _, satir in veriler.iterrows():
        tarih = satir["Tarih"]
        if pd.notna(tarih):
            tarih = tarih.strftime("%d.%m.%Y %H:%M")
        else:
            tarih = "-"

        saniye = int(satir["Sure_Saniye"])
        tablo.append([
            str(satir["Sporcu"]),
            tarih,
            str(satir["Hareket"]),
            f"{saniye // 60} dk {saniye % 60} sn",
            str(int(satir["Toplam"])),
            str(int(satir["Dogru"])),
            str(int(satir["Hatali"])),
            f"%{float(satir['Basari_Yuzdesi']):.1f}",
        ])

    rapor_tablosu = Table(
        tablo,
        repeatRows=1,
        colWidths=[3.2 * cm, 3.7 * cm, 3.5 * cm, 2.8 * cm,
                   2.1 * cm, 2.1 * cm, 2.1 * cm, 2.3 * cm],
    )
    rapor_tablosu.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), font),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#172033")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("BACKGROUND", (0, 1), (-1, -1), colors.HexColor("#f8fafc")),
        ("TEXTCOLOR", (0, 1), (-1, -1), colors.HexColor("#172033")),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ("ALIGN", (3, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [
            colors.white, colors.HexColor("#f1f5f9")
        ]),
    ]))
    elemanlar.append(rapor_tablosu)

    belge.build(elemanlar)
    tampon.seek(0)
    return tampon.getvalue()


def ozet_kutulari(veriler):
    toplam = int(veriler["Toplam"].sum())
    dogru = int(veriler["Dogru"].sum())
    hatali = int(veriler["Hatali"].sum())
    basari = dogru / toplam * 100 if toplam else 0

    kolonlar = st.columns(4)
    kolonlar[0].metric("Toplam Tekrar", toplam)
    kolonlar[1].metric("Doğru Tekrar", dogru)
    kolonlar[2].metric("Hatalı Tekrar", hatali)
    kolonlar[3].metric("Başarı Oranı", f"%{basari:.1f}")


def tabloyu_goster(veriler):
    tablo = veriler.copy()
    tablo["Tarih"] = tablo["Tarih"].dt.strftime("%d.%m.%Y %H:%M")
    tablo["Sure_Saniye"] = tablo["Sure_Saniye"].apply(
        lambda x: f"{int(x) // 60} dk {int(x) % 60} sn"
    )
    tablo["Basari_Yuzdesi"] = tablo["Basari_Yuzdesi"].apply(
        lambda x: f"%{float(x):.1f}"
    )
    tablo = tablo.rename(columns={
        "Sure_Saniye": "Süre",
        "Dogru": "Doğru",
        "Hatali": "Hatalı",
        "Basari_Yuzdesi": "Başarı",
    })
    st.dataframe(tablo, use_container_width=True, hide_index=True)


_hoca_adi = st.session_state.hoca_kullanici.get("ad_soyad") or "Hocam"
st.markdown(
    f"""
    <div class="hoca-hero">
        <h1>Hoş geldin, {_hoca_adi}! 👋</h1>
        <p>Sporcularını takip et, ödevlerini yönet ve gelişimlerini tek ekrandan incele.</p>
    </div>
    """,
    unsafe_allow_html=True,
)

st.sidebar.success(
    f"Hoca: {st.session_state.hoca_kullanici['ad_soyad']}"
)

istemci = yeni_istemci()
hoca_profili = (
    istemci.table("profiles").select(
        "id,ad_soyad,email,rol,hoca_kodu,created_at"
    )
    .eq("id", st.session_state.hoca_kullanici["id"]).single().execute().data
)
st.sidebar.info(f"Hoca kodunuz: {hoca_profili.get('hoca_kodu', '-')}")

st.subheader("🔔 Bağlantı İstekleri")
istekler = (
    istemci.table("hoca_sporcu")
    .select("sporcu_id,durum,profiles!hoca_sporcu_sporcu_id_fkey(ad_soyad)")
    .eq("hoca_id", st.session_state.hoca_kullanici["id"])
    .eq("durum", "bekliyor").execute().data
)

if not istekler:
    st.caption("Bekleyen bağlantı isteği yok.")
else:
    for istek in istekler:
        sporcu = istek.get("profiles") or {}
        ad = sporcu.get("ad_soyad", "İsimsiz sporcu")
        with st.container(border=True):
            ad_kolonu, onay_kolonu, red_kolonu = st.columns([4, 1, 1])
            ad_kolonu.markdown(f"### 👤 {ad}")
            if onay_kolonu.button("Onayla", key=f"onay-{istek['sporcu_id']}", use_container_width=True):
                istemci.table("hoca_sporcu").update({"durum": "onaylandi"}).eq(
                    "hoca_id", st.session_state.hoca_kullanici["id"]
                ).eq("sporcu_id", istek["sporcu_id"]).execute()
                st.rerun()
            if red_kolonu.button("Reddet", key=f"red-{istek['sporcu_id']}", use_container_width=True):
                istemci.table("hoca_sporcu").delete().eq(
                    "hoca_id", st.session_state.hoca_kullanici["id"]
                ).eq("sporcu_id", istek["sporcu_id"]).execute()
                st.rerun()

st.subheader("👥 Bağlı Sporcular")
bagli_sporcular = (
    istemci.table("hoca_sporcu")
    .select("sporcu_id,durum,profiles!hoca_sporcu_sporcu_id_fkey(ad_soyad)")
    .eq("hoca_id", st.session_state.hoca_kullanici["id"])
    .eq("durum", "onaylandi").execute().data
)

if not bagli_sporcular:
    st.caption("Henüz onaylanmış bir sporcu bağlantısı yok.")
else:
    for baglanti in bagli_sporcular:
        sporcu = baglanti.get("profiles") or {}
        ad = sporcu.get("ad_soyad", "İsimsiz sporcu")
        with st.container(border=True):
            ad_kolonu, kaldir_kolonu = st.columns([5, 1])
            ad_kolonu.markdown(
                f'<div class="bagli-sporcu-adi">✅ {ad}</div>'
                '<div class="bagli-sporcu-aciklama">Bağlantı onaylandı · Program ve geri bildirim gönderebilirsiniz.</div>',
                unsafe_allow_html=True,
            )
            if kaldir_kolonu.button(
                "Kaldır", key=f"kaldir-{baglanti['sporcu_id']}", use_container_width=True
            ):
                istemci.table("hoca_sporcu").delete().eq(
                    "hoca_id", st.session_state.hoca_kullanici["id"]
                ).eq("sporcu_id", baglanti["sporcu_id"]).execute()
                st.rerun()

st.subheader("🗓️ Sporcuya Program Ata")
sporcu_secenekleri = {}
for baglanti in bagli_sporcular:
    sporcu = baglanti.get("profiles") or {}
    sporcu_secenekleri[sporcu.get("ad_soyad", "İsimsiz sporcu")] = baglanti["sporcu_id"]

programlar = (
    istemci.table("programlar").select("*")
    .eq("hoca_id", st.session_state.hoca_kullanici["id"])
    .order("tarih").execute().data
)

if not sporcu_secenekleri:
    st.caption("Program atamak için önce bir sporcu bağlantısını onaylayın.")
else:
    with st.form("program_atama_formu", clear_on_submit=True):
        p1, p2, p3 = st.columns(3)
        secilen_sporcu_adi = p1.selectbox("Sporcu", list(sporcu_secenekleri.keys()))
        baslangic_tarihi = p2.date_input("Başlangıç tarihi")
        bitis_tarihi = p3.date_input(
            "Son teslim tarihi", value=datetime.now().date() + timedelta(days=7)
        )
        st.markdown("#### Ödeve eklenecek hareketler")
        st.caption("Birden fazla hareket seçebilir, her birine ayrı hedef verebilirsiniz.")

        hareket_hedefleri = {}
        hareket_secimleri = {}
        for sira, hareket_adi in enumerate(
            ["Squat", "Şınav", "Barfiks", "Aç-Kapa Zıplama", "Gövde Çevirme"]
        ):
            secim_kolonu, hedef_kolonu = st.columns([2, 1])
            hareket_secimleri[hareket_adi] = secim_kolonu.checkbox(
                hareket_adi,
                key=f"program_hareket_{sira}",
            )
            hareket_hedefleri[hareket_adi] = hedef_kolonu.number_input(
                f"{hareket_adi} hedefi",
                min_value=1,
                max_value=500,
                value=10,
                key=f"program_hedef_{sira}",
            )
        program_notu = st.text_area(
            "Hoca notu", placeholder="Örnek: Hareketi yavaş ve kontrollü yap."
        )
        program_gonder = st.form_submit_button(
            "Ödevi sporcuya gönder", type="primary"
        )

    if program_gonder:
        secilen_hareketler = [
            hareket for hareket, secili in hareket_secimleri.items() if secili
        ]
        if bitis_tarihi < baslangic_tarihi:
            st.warning("Son teslim tarihi başlangıç tarihinden önce olamaz.")
        elif not secilen_hareketler:
            st.warning("Ödevi göndermek için en az bir hareket seçin.")
        else:
            secilen_sporcu_id = sporcu_secenekleri[secilen_sporcu_adi]
            sporcunun_odevleri = [
                int(program.get("odev_no") or 0)
                for program in programlar
                if program.get("sporcu_id") == secilen_sporcu_id
            ]
            yeni_odev_no = max(sporcunun_odevleri, default=0) + 1
            yeni_programlar = [
                {
                    "hoca_id": st.session_state.hoca_kullanici["id"],
                    "sporcu_id": secilen_sporcu_id,
                    "odev_no": yeni_odev_no,
                    "tarih": bitis_tarihi.isoformat(),
                    "baslangic_tarihi": baslangic_tarihi.isoformat(),
                    "bitis_tarihi": bitis_tarihi.isoformat(),
                    "hareket": hareket,
                    "hedef_tekrar": int(hareket_hedefleri[hareket]),
                    "notlar": program_notu.strip(),
                }
                for hareket in secilen_hareketler
            ]
            istemci.table("programlar").insert(yeni_programlar).execute()
            st.success(
                f"Ödev {yeni_odev_no} gönderildi: "
                f"{len(yeni_programlar)} hareket eklendi."
            )
            st.rerun()

    if programlar:
        program_df = pd.DataFrame(programlar)
        ad_haritasi = {v: k for k, v in sporcu_secenekleri.items()}
        program_df["Sporcu"] = program_df["sporcu_id"].map(ad_haritasi)
        program_df = program_df.rename(columns={
            "odev_no": "Ödev",
            "baslangic_tarihi": "Başlangıç", "bitis_tarihi": "Son Tarih",
            "tarih": "Eski Tarih", "hareket": "Hareket",
            "hedef_tekrar": "Hedef", "notlar": "Not", "durum": "Durum",
        })
        st.dataframe(
            program_df[["Sporcu", "Ödev", "Başlangıç", "Son Tarih", "Hareket", "Hedef", "Not", "Durum"]],
            use_container_width=True,
            hide_index=True,
        )

st.subheader("💬 Sporcuya Geri Bildirim Gönder")
if not sporcu_secenekleri:
    st.caption("Mesaj göndermek için önce bir sporcu bağlantısını onaylayın.")
else:
    bildirim_sporcusu = st.selectbox(
        "Geri bildirim gönderilecek sporcu",
        list(sporcu_secenekleri.keys()),
        key="bildirim_sporcusu",
    )
    bildirim_sporcu_id = sporcu_secenekleri[bildirim_sporcusu]
    sporcunun_programlari = [
        program for program in programlar
        if program.get("sporcu_id") == bildirim_sporcu_id
    ]
    odev_secenekleri = {}
    for odev_no in sorted({
        int(program.get("odev_no") or 0) for program in sporcunun_programlari
    }, reverse=True):
        odev_programlari = [
            program for program in sporcunun_programlari
            if int(program.get("odev_no") or 0) == odev_no
        ]
        hareket_ozeti = ", ".join(
            program.get("hareket", "-") for program in odev_programlari
        )
        baslangic_ozeti = odev_programlari[0].get("baslangic_tarihi") or "-"
        tarih_ozeti = odev_programlari[0].get("bitis_tarihi") or odev_programlari[0].get("tarih", "-")
        odev_secenekleri[
            f"Ödev {odev_no} · {baslangic_ozeti}–{tarih_ozeti} · {hareket_ozeti}"
        ] = odev_no

    with st.form("geri_bildirim_formu", clear_on_submit=True):
        secilen_odev_etiketi = st.selectbox(
            "Geri bildirimin ait olduğu ödev",
            list(odev_secenekleri.keys()),
            disabled=not odev_secenekleri,
            placeholder="Önce bu sporcuya bir ödev atayın",
        )
        bildirim_mesaji = st.text_area(
            "Mesaj",
            placeholder="Örnek: Squat formun iyi. Dizlerini ayak yönünde tutmaya devam et.",
            max_chars=1000,
        )
        bildirim_gonder = st.form_submit_button(
            "Bildirimi gönder", type="primary"
        )

    if bildirim_gonder:
        temiz_mesaj = bildirim_mesaji.strip()
        if not odev_secenekleri:
            st.warning("Bu sporcuya geri bildirim göndermek için önce ödev atayın.")
        elif not temiz_mesaj:
            st.warning("Önce sporcuya göndereceğiniz mesajı yazın.")
        else:
            try:
                istemci.table("bildirimler").insert({
                    "hoca_id": st.session_state.hoca_kullanici["id"],
                    "sporcu_id": bildirim_sporcu_id,
                    "odev_no": odev_secenekleri[secilen_odev_etiketi],
                    "mesaj": temiz_mesaj,
                }).execute()
                st.success("Bildirim sporcuya gönderildi.")
                st.rerun()
            except Exception as hata:
                st.error(f"Bildirim gönderilemedi: {hata}")

    gonderilenler = (
        istemci.table("bildirimler")
        .select("id,odev_no,mesaj,okundu,created_at,profiles!bildirimler_sporcu_id_fkey(ad_soyad)")
        .eq("hoca_id", st.session_state.hoca_kullanici["id"])
        .order("created_at", desc=True).limit(20).execute().data
    )
    if gonderilenler:
        st.markdown("#### Son gönderilen bildirimler")
        bildirim_tablosu = pd.DataFrame(gonderilenler)
        bildirim_tablosu["Sporcu"] = bildirim_tablosu["profiles"].apply(
            lambda p: (p or {}).get("ad_soyad", "-")
        )
        bildirim_tablosu["Tarih"] = (
            pd.to_datetime(bildirim_tablosu["created_at"], utc=True)
            .dt.tz_convert("Europe/Istanbul").dt.strftime("%d.%m.%Y %H:%M")
        )
        bildirim_tablosu["Durum"] = bildirim_tablosu["okundu"].map(
            {True: "Okundu", False: "Okunmadı"}
        )
        bildirim_tablosu = bildirim_tablosu.rename(columns={
            "odev_no": "Ödev", "mesaj": "Mesaj"
        })
        st.dataframe(
            bildirim_tablosu[["Sporcu", "Ödev", "Tarih", "Mesaj", "Durum"]],
            use_container_width=True,
            hide_index=True,
        )
if st.sidebar.button("Çıkış yap"):
    try:
        yeni_istemci().auth.sign_out()
    except Exception:
        pass
    oturumu_temizle("hoca")
    st.session_state.hoca_kullanici = None
    st.rerun()

with st.expander("👤 Hoca Profilim", expanded=False):
    st.caption("Hesap bilgileriniz ve salon özetiniz")
    hp1, hp2, hp3 = st.columns(3)
    hp1.metric("Bağlı Sporcu", len(bagli_sporcular))
    hp2.metric("Atanan Program", len(programlar) if programlar else 0)
    hp3.metric("Hoca Kodu", hoca_profili.get("hoca_kodu") or "-")

    yeni_hoca_adi = st.text_input(
        "Ad soyad",
        value=hoca_profili.get("ad_soyad") or "",
        key="hoca_profil_ad_soyad",
    )
    st.text_input(
        "E-posta",
        value=hoca_profili.get("email")
        or st.session_state.hoca_kullanici.get("email", ""),
        disabled=True,
        key="hoca_profil_email",
    )
    st.text_input(
        "Hesap türü", value="Hoca", disabled=True, key="hoca_profil_rol"
    )
    hoca_kayit_tarihi = hoca_profili.get("created_at")
    if hoca_kayit_tarihi:
        hoca_kayit_tarihi = pd.to_datetime(hoca_kayit_tarihi, errors="coerce")
        if not pd.isna(hoca_kayit_tarihi):
            st.caption(
                f"Kayıt tarihi: {hoca_kayit_tarihi.strftime('%d.%m.%Y')}"
            )

    if st.button("Profilimi kaydet", type="primary", key="hoca_profil_kaydet"):
        temiz_hoca_adi = yeni_hoca_adi.strip()
        if len(temiz_hoca_adi) < 2:
            st.warning("Ad soyad en az 2 karakter olmalıdır.")
        else:
            try:
                istemci.table("profiles").update({
                    "ad_soyad": temiz_hoca_adi
                }).eq("id", st.session_state.hoca_kullanici["id"]).execute()
                st.session_state.hoca_kullanici["ad_soyad"] = temiz_hoca_adi
                st.success("Profil bilgileriniz kaydedildi.")
                st.rerun()
            except Exception as hata:
                st.error(f"Profil güncellenemedi: {hata}")

    st.info("Profil fotoğrafı kullanılmaz; yalnızca gerekli hesap ve salon bilgileri saklanır.")

veri = (
    yeni_istemci().table("antrenmanlar")
    .select("*, profiles!antrenmanlar_sporcu_id_fkey(ad_soyad)")
    .order("tarih", desc=True).execute().data
)
df = pd.DataFrame(veri)

if df.empty:
    st.info("Henüz size bağlı sporcuların antrenman kaydı bulunmuyor.")
    st.stop()

df["Sporcu"] = df["profiles"].apply(
    lambda profil: profil.get("ad_soyad", "-") if profil else "-"
)
df = df.rename(columns={
    "tarih": "Tarih", "hareket": "Hareket",
    "sure_saniye": "Sure_Saniye", "toplam": "Toplam",
    "dogru": "Dogru", "hatali": "Hatali",
    "basari_yuzdesi": "Basari_Yuzdesi",
})
# Supabase zamanları UTC saklar; hoca panelinde Türkiye saatini göster.
df["Tarih"] = (
    pd.to_datetime(df["Tarih"], errors="coerce", utc=True)
    .dt.tz_convert("Europe/Istanbul")
)
df = df[[
    "Sporcu", "Tarih", "Hareket", "Sure_Saniye",
    "Toplam", "Dogru", "Hatali", "Basari_Yuzdesi"
]]

genel_sekme, sporcu_sekmesi = st.tabs([
    "📊 Genel Bakış", "👤 Sporcu Detayı"
])

with genel_sekme:
    st.subheader("Tüm Sporcular")
    ozet_kutulari(df)

    st.subheader("Hareketlere Göre Sonuçlar")
    genel_grafik = df.groupby("Hareket")[["Dogru", "Hatali"]].sum()
    st.bar_chart(genel_grafik, color=["#22c55e", "#ef4444"], height=320)

    st.subheader("Tüm Antrenmanlar")
    tabloyu_goster(df)

    st.download_button(
        "📄 Genel raporu PDF olarak indir",
        data=pdf_olustur(df, "Akıllı Spor Salonu - Genel Rapor"),
        file_name="genel_antrenman_raporu.pdf",
        mime="application/pdf",
    )

with sporcu_sekmesi:
    sporcular = sorted(df["Sporcu"].dropna().unique().tolist())
    secilen_sporcu = st.selectbox("Sporcu seçin", sporcular)
    sporcu_df = df[df["Sporcu"] == secilen_sporcu].copy()

    hareketler = ["Tümü"] + sorted(
        sporcu_df["Hareket"].dropna().unique().tolist()
    )
    secilen_hareket = st.selectbox("Hareket filtresi", hareketler)

    if secilen_hareket != "Tümü":
        sporcu_df = sporcu_df[sporcu_df["Hareket"] == secilen_hareket]

    ozet_kutulari(sporcu_df)

    st.subheader(f"{secilen_sporcu} - Başarı Grafiği")
    gelisim = sporcu_df.dropna(subset=["Tarih"]).set_index("Tarih")
    if not gelisim.empty:
        st.line_chart(gelisim[["Basari_Yuzdesi"]], height=280)

    st.subheader("Antrenman Geçmişi")
    tabloyu_goster(sporcu_df)

    guvenli_ad = str(secilen_sporcu).replace(" ", "_")
    st.download_button(
        "📄 Sporcu raporunu PDF olarak indir",
        data=pdf_olustur(
            sporcu_df, f"Sporcu Antrenman Raporu - {secilen_sporcu}"
        ),
        file_name=f"{guvenli_ad}_antrenman_raporu.pdf",
        mime="application/pdf",
    )

if st.sidebar.button("Verileri yenile"):
    st.rerun()