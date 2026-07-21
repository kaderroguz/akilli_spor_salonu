import json
from datetime import datetime, timedelta

import extra_streamlit_components as stx
import streamlit as st
from supabase import create_client


_cookie_manager = None


def _cerez_yoneticisi():
    global _cookie_manager
    if _cookie_manager is None:
        _cookie_manager = stx.CookieManager(key="akilli_spor_cerezleri")
    return _cookie_manager


def yeni_istemci():
    istemci = create_client(
        st.secrets["SUPABASE_URL"],
        st.secrets["SUPABASE_KEY"],
    )

    access = st.session_state.get("sb_access_token")
    refresh = st.session_state.get("sb_refresh_token")
    if access and refresh:
        istemci.auth.set_session(access, refresh)

    return istemci


def oturumu_kaydet(oturum, panel="genel"):
    st.session_state.sb_access_token = oturum.access_token
    st.session_state.sb_refresh_token = oturum.refresh_token
    veri = json.dumps({
        "access_token": oturum.access_token,
        "refresh_token": oturum.refresh_token,
    })
    _cerez_yoneticisi().set(
        f"akilli_spor_{panel}_oturumu",
        veri,
        expires_at=datetime.now() + timedelta(days=14),
        same_site="lax",
    )


def oturumu_cerezden_yukle(panel="genel"):
    if st.session_state.get("sb_access_token") and st.session_state.get("sb_refresh_token"):
        return True

    ham_veri = _cerez_yoneticisi().get(f"akilli_spor_{panel}_oturumu")
    if not ham_veri:
        return False

    try:
        veri = json.loads(ham_veri)
        st.session_state.sb_access_token = veri["access_token"]
        st.session_state.sb_refresh_token = veri["refresh_token"]
        return True
    except Exception:
        return False


def oturumu_temizle(panel="genel"):
    st.session_state.pop("sb_access_token", None)
    st.session_state.pop("sb_refresh_token", None)
    try:
        _cerez_yoneticisi().delete(f"akilli_spor_{panel}_oturumu")
    except Exception:
        pass
    def sifre_sifirlama_baglantisi_gonder(eposta):
     return yeni_istemci().auth.reset_password_for_email(
        eposta.strip(),
        options={"redirect_to": "http://localhost:8504"}
    )