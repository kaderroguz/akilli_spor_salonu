import hashlib
import hmac
import secrets
import sqlite3


VERITABANI = "kullanicilar.db"


def baglanti_ac():
    return sqlite3.connect(VERITABANI)


def veritabanini_hazirla():
    with baglanti_ac() as baglanti:
        baglanti.execute(
            """
            CREATE TABLE IF NOT EXISTS kullanicilar (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                kullanici_adi TEXT UNIQUE NOT NULL,
                ad_soyad TEXT NOT NULL,
                sifre_ozeti BLOB NOT NULL,
                salt BLOB NOT NULL,
                rol TEXT NOT NULL CHECK (rol IN ('sporcu', 'hoca'))
            )
            """
        )


def sifre_ozeti_olustur(sifre, salt):
    return hashlib.pbkdf2_hmac(
        "sha256",
        sifre.encode("utf-8"),
        salt,
        200_000,
    )


def kullanici_olustur(kullanici_adi, ad_soyad, sifre, rol):
    kullanici_adi = kullanici_adi.strip().lower()
    ad_soyad = ad_soyad.strip()

    if len(kullanici_adi) < 3:
        return False, "Kullanıcı adı en az 3 karakter olmalı."
    if len(ad_soyad) < 2:
        return False, "Ad soyad boş bırakılamaz."
    if len(sifre) < 6:
        return False, "Şifre en az 6 karakter olmalı."
    if rol not in {"sporcu", "hoca"}:
        return False, "Geçersiz kullanıcı rolü."

    salt = secrets.token_bytes(16)
    sifre_ozeti = sifre_ozeti_olustur(sifre, salt)

    try:
        with baglanti_ac() as baglanti:
            baglanti.execute(
                """
                INSERT INTO kullanicilar
                (kullanici_adi, ad_soyad, sifre_ozeti, salt, rol)
                VALUES (?, ?, ?, ?, ?)
                """,
                (kullanici_adi, ad_soyad, sifre_ozeti, salt, rol),
            )
        return True, "Hesap oluşturuldu."
    except sqlite3.IntegrityError:
        return False, "Bu kullanıcı adı zaten kullanılıyor."


def giris_kontrol(kullanici_adi, sifre, gerekli_rol=None):
    kullanici_adi = kullanici_adi.strip().lower()

    with baglanti_ac() as baglanti:
        satir = baglanti.execute(
            """
            SELECT kullanici_adi, ad_soyad, sifre_ozeti, salt, rol
            FROM kullanicilar
            WHERE kullanici_adi = ?
            """,
            (kullanici_adi,),
        ).fetchone()

    if satir is None:
        return None

    kayitli_kullanici, ad_soyad, kayitli_ozet, salt, rol = satir
    girilen_ozet = sifre_ozeti_olustur(sifre, salt)

    if not hmac.compare_digest(kayitli_ozet, girilen_ozet):
        return None
    if gerekli_rol and rol != gerekli_rol:
        return None

    return {
        "kullanici_adi": kayitli_kullanici,
        "ad_soyad": ad_soyad,
        "rol": rol,
    }


def hoca_var_mi():
    with baglanti_ac() as baglanti:
        sonuc = baglanti.execute(
            "SELECT 1 FROM kullanicilar WHERE rol = 'hoca' LIMIT 1"
        ).fetchone()
    return sonuc is not None


veritabanini_hazirla()