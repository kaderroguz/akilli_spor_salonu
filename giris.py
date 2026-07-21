import base64
from pathlib import Path

import streamlit as st


st.set_page_config(
    page_title="Akıllı Spor Salonu - Giriş",
    page_icon="🏋️",
    layout="centered",
)


arkaplan_dosyasi = Path(__file__).with_name("spor_salonu_arka_plan.png")
arkaplan_verisi = base64.b64encode(arkaplan_dosyasi.read_bytes()).decode("utf-8")


st.markdown(
    """
    <style>
    .stApp {
        position: relative;
        min-height: 100vh;
        overflow: hidden;
        background: #06111f;
        color: #f8fafc;
    }

    .stApp::before {
        content: "";
        position: fixed;
        inset: -18px;
        z-index: 0;
        background-image:
            linear-gradient(135deg, rgba(3, 12, 25, .78), rgba(5, 31, 50, .68)),
            url("data:image/png;base64,__ARKAPLAN_VERISI__");
        background-position: center;
        background-size: cover;
        filter: blur(5px);
        transform: scale(1.04);
    }

    .stApp > div {
        position: relative;
        z-index: 1;
    }

    .block-container {
        max-width: 820px;
        padding-top: 64px;
        padding-bottom: 60px;
    }

    .giris-baslik {
        text-align: center;
        margin-bottom: 32px;
    }

    .giris-baslik h1 {
        margin: 0 0 10px;
        color: #ffffff;
        font-size: 42px;
        font-weight: 800;
        letter-spacing: -.8px;
    }

    .giris-baslik p {
        margin: 0;
        color: #cbd5e1;
        font-size: 18px;
    }

    .panel-karti {
        display: block;
        padding: 27px 30px;
        margin: 18px 0;
        border: 1px solid rgba(191, 219, 254, .22);
        border-radius: 20px;
        color: #ffffff !important;
        text-decoration: none !important;
        box-shadow: 0 14px 32px rgba(0, 0, 0, .34);
        backdrop-filter: blur(14px);
        -webkit-backdrop-filter: blur(14px);
        transition: transform .2s ease, box-shadow .2s ease, background .2s ease;
    }

    .panel-karti:hover {
        color: #ffffff !important;
        transform: translateY(-5px);
        box-shadow: 0 22px 40px rgba(0, 0, 0, .42);
    }

    .sporcu {
        background: linear-gradient(135deg, rgba(30, 64, 175, .72), rgba(14, 116, 144, .55));
    }

    .hoca {
        background: linear-gradient(135deg, rgba(8, 82, 104, .68), rgba(13, 148, 136, .48));
    }

    .kart-baslik {
        font-size: 26px;
        font-weight: 800;
    }

    .kart-aciklama {
        margin-top: 8px;
        color: #ecfeff;
        font-size: 15px;
        line-height: 1.5;
    }

    .kayit-alani {
        display: flex;
        justify-content: flex-end;
        margin: -6px 4px 20px 0;
    }

    .kayit-buton {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        padding: 10px 16px;
        border: 1px solid rgba(125, 211, 252, .62);
        border-radius: 999px;
        background: rgba(8, 47, 73, .68);
        color: #e0f2fe !important;
        font-size: 13px;
        font-weight: 800;
        text-decoration: none !important;
        box-shadow: 0 7px 18px rgba(0, 0, 0, .28);
        backdrop-filter: blur(10px);
        transition: transform .18s ease, background .18s ease;
    }

    .kayit-buton:hover {
        background: rgba(14, 116, 144, .78);
        transform: translateY(-2px);
    }

    .admin-baglanti {
        margin-top: 34px;
        text-align: center;
    }

    .admin-baglanti a {
        color: #cbd5e1 !important;
        font-size: 14px;
        text-decoration: none;
    }

    .admin-baglanti a:hover {
        color: #ffffff !important;
        text-decoration: underline;
    }
    </style>

    <div class="giris-baslik">
        <h1>🏋️ Akıllı Spor Salonu</h1>
        <p>Devam etmek istediğiniz paneli seçin</p>
    </div>

    <a class="panel-karti sporcu" href="http://localhost:8502" target="_self">
        <div class="kart-baslik">🏃 Sporcu Girişi</div>
        <div class="kart-aciklama">Antrenmanınızı başlatın, programınızı ve sonuçlarınızı görüntüleyin.</div>
    </a>

    <div class="kayit-alani">
        <a class="kayit-buton" href="http://localhost:8502/?kayit=1" target="_self">✚ Yeni sporcu kaydı</a>
    </div>

    <a class="panel-karti hoca" href="http://localhost:8501" target="_self">
        <div class="kart-baslik">🧑‍🏫 Hoca Girişi</div>
        <div class="kart-aciklama">Sporcularınızı takip edin ve antrenman programı oluşturun.</div>
    </a>

    <div class="admin-baglanti">
        <a href="http://localhost:8503" target="_self">🛡️ Yönetici girişi</a>
    </div>
    """.replace("__ARKAPLAN_VERISI__", arkaplan_verisi),
    unsafe_allow_html=True,
)