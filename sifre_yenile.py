import streamlit as st
import streamlit.components.v1 as components
from supabase import create_client


st.set_page_config(
    page_title="Şifre Yenileme | Akıllı Spor Salonu",
    page_icon="🔐",
    layout="centered",
)

st.markdown(
    """
    <style>
    .stApp {
        background: linear-gradient(145deg, #f8fdff 0%, #eaf8ff 100%);
        color: #0f2942;
    }
    .block-container { max-width: 680px; padding-top: 4rem; }
    [data-testid="stButton"] button {
        color: white !important;
        border: 0 !important;
        border-radius: 14px !important;
        background: linear-gradient(90deg, #0891b2, #2563eb) !important;
        font-weight: 700 !important;
    }
    [data-testid="stTextInput"] input {
        color: #102a43 !important;
        background: white !important;
        border: 1px solid #0891b2 !important;
    }
    </style>
    """,
    unsafe_allow_html=True,
)


def supabase_istemcisi():
    return create_client(
        st.secrets["SUPABASE_URL"],
        st.secrets["SUPABASE_KEY"],
    )


# Supabase kurtarma bilgilerini URL'nin # bölümünde gönderir. Tarayıcı bu
# bölümü sunucuya iletmediği için, aşağıdaki küçük kod onu sorgu parametresine
# çevirir ve Streamlit sayfasını yeniden açar.
components.html(
    """
    <script>
    const parentUrl = new URL(window.parent.location.href);
    if (parentUrl.hash && parentUrl.hash.length > 1) {
        const hashParams = new URLSearchParams(parentUrl.hash.substring(1));
        for (const [key, value] of hashParams.entries()) {
            parentUrl.searchParams.set(key, value);
        }
        parentUrl.hash = "";
        window.parent.location.replace(parentUrl.toString());
    }
    </script>
    """,
    height=0,
)

st.title("🔐 Yeni Şifre Belirle")
st.caption("Hesabınız için yeni bir şifre oluşturun.")

access_token = st.query_params.get("access_token")
refresh_token = st.query_params.get("refresh_token")

if access_token and refresh_token:
    try:
        istemci = supabase_istemcisi()
        istemci.auth.set_session(access_token, refresh_token)

        yeni_sifre = st.text_input(
            "Yeni şifre",
            type="password",
            placeholder="En az 6 karakter",
        )
        yeni_sifre_tekrar = st.text_input(
            "Yeni şifre tekrar",
            type="password",
            placeholder="Yeni şifrenizi tekrar yazın",
        )

        if st.button("Şifremi güncelle", type="primary", use_container_width=True):
            if len(yeni_sifre) < 6:
                st.warning("Şifreniz en az 6 karakter olmalıdır.")
            elif yeni_sifre != yeni_sifre_tekrar:
                st.warning("Yazdığınız iki şifre aynı değil.")
            else:
                istemci.auth.update_user({"password": yeni_sifre})
                st.success("Şifreniz başarıyla yenilendi. Artık giriş yapabilirsiniz.")
                st.link_button(
                    "Sporcu girişine dön",
                    "http://localhost:8502",
                    use_container_width=True,
                )
    except Exception as hata:
        st.error(f"Şifre yenileme bağlantısı geçersiz veya süresi dolmuş: {hata}")
else:
    st.info("Şifre yenilemek için e-postanıza gönderilen bağlantıyı açın.")