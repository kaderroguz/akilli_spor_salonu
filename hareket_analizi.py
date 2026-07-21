import cv2
import mediapipe as mp
import numpy as np
import pandas as pd
import joblib
import csv
import os
import time
from datetime import datetime


# Eğitilmiş modeli yükle
model = joblib.load("hareket_tanima_modeli.pkl")
model_sutunlari = joblib.load("model_sutunlari.pkl")


# Model sonuçlarının ekranda gösterilecek Türkçe isimleri
hareket_isimleri = {
    "Squats": "Squat",
    "Push Ups": "Sinav",
    "Pull ups": "Barfiks",
    "Jumping Jacks": "Ac-Kapa Ziplama",
    "Russian twists": "Govde Cevirme"
}


# Hoca tarafından seçilecek hareket
hareket_secenekleri = {
    "1": "Squats",
    "2": "Push Ups",
    "3": "Pull ups",
    "4": "Jumping Jacks",
    "5": "Russian twists"
}

print("\nYapilacak hareketi secin:")
print("1 - Squat")
print("2 - Sinav")
print("3 - Barfiks")
print("4 - Ac-Kapa Ziplama")
print("5 - Govde Cevirme")

while True:
    secim = input("Seciminiz (1-5): ").strip()

    if secim in hareket_secenekleri:
        istenen_hareket = hareket_secenekleri[secim]
        break

    print("Hatali secim. Lutfen 1 ile 5 arasinda bir sayi girin.")

print(
    "Secilen hareket:",
    hareket_isimleri[istenen_hareket]
)

sporcu_adi = input("Sporcunun adi: ").strip()

if not sporcu_adi:
    sporcu_adi = "Isimsiz Sporcu"


def pozitif_sayi_al(mesaj, varsayilan):
    while True:
        deger = input(mesaj).strip()

        if not deger:
            return varsayilan

        if deger.isdigit() and int(deger) > 0:
            return int(deger)

        print("Lutfen sifirdan buyuk bir sayi girin.")


hedef_set = pozitif_sayi_al(
    "Set sayisi (varsayilan 3): ",
    3
)
hedef_tekrar = pozitif_sayi_al(
    "Her setteki tekrar (varsayilan 10): ",
    10
)
dinlenme_suresi = pozitif_sayi_al(
    "Set arasi dinlenme saniyesi (varsayilan 30): ",
    30
)


# MediaPipe ayarları
mp_pose = mp.solutions.pose
mp_drawing = mp.solutions.drawing_utils

pose = mp_pose.Pose(
    static_image_mode=False,
    model_complexity=1,
    smooth_landmarks=True,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5
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

    if aci > 180:
        aci = 360 - aci

    return aci


# Kamerayı aç
kamera = cv2.VideoCapture(0)

kamera.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
kamera.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)

cv2.namedWindow(
    "Akilli Spor Salonu",
    cv2.WINDOW_NORMAL
)

cv2.resizeWindow(
    "Akilli Spor Salonu",
    1280,
    720
)

if not kamera.isOpened():
    print("Hata: Kamera açılamadı.")
    exit()

print("Kamera açıldı. Kapatmak için q tuşuna basın.")

antrenman_baslangic = datetime.now()
kayit_mesaji = "S: Kaydet | Q: Cik"
tamamlanan_set = 0
set_baslangic_tekrari = 0
dinlenme_bitis = None
antrenman_tamamlandi = False


# Squat değişkenleri
squat_sayisi = 0
squat_asamasi = "yukari"
squat_durumu = "Squat bekleniyor"
dogru_squat = 0
hatali_squat = 0


# Şınav değişkenleri
sinav_sayisi = 0
sinav_asamasi = "yukari"
sinav_durumu = "Sinav bekleniyor"
dogru_sinav = 0
hatali_sinav = 0


# Barfiks değişkenleri
barfiks_sayisi = 0
barfiks_asamasi = "asagi"
barfiks_durumu = "Barfiks bekleniyor"
dogru_barfiks = 0
hatali_barfiks = 0


# Aç-kapa zıplama değişkenleri
jumping_jack_sayisi = 0
jumping_jack_asamasi = "kapali"
jumping_jack_durumu = "Hareket bekleniyor"
dogru_jumping_jack = 0
hatali_jumping_jack = 0


# Gövde çevirme değişkenleri
russian_twist_sayisi = 0
russian_twist_yarim = 0
russian_twist_son_yon = None
russian_twist_durumu = "Hareket bekleniyor"
dogru_russian_twist = 0
hatali_russian_twist = 0

while True:
    basarili, goruntu = kamera.read()

    if not basarili:
        print("Kameradan görüntü alınamadı.")
        break

    # Görüntüyü düzenle
    goruntu = cv2.flip(goruntu, 1)
    goruntu = cv2.resize(goruntu, (1280, 720))

    rgb_goruntu = cv2.cvtColor(
        goruntu,
        cv2.COLOR_BGR2RGB
    )

    sonuc = pose.process(rgb_goruntu)

    hareket = "Vucut algilanamadi"
    guven = 0

    omuz_acisi = 0
    dirsek_acisi = 0
    kalca_acisi = 0
    diz_acisi = 0
    ayak_bilegi_acisi = 0

    simdi = time.time()

    if dinlenme_bitis is not None and simdi >= dinlenme_bitis:
        dinlenme_bitis = None

    hareket_kontrol_aktif = (
        not antrenman_tamamlandi
        and dinlenme_bitis is None
    )

    if sonuc.pose_landmarks:
        noktalar = sonuc.pose_landmarks.landmark

        # Sol omuz
        sol_omuz = [
            noktalar[
                mp_pose.PoseLandmark.LEFT_SHOULDER.value
            ].x,
            noktalar[
                mp_pose.PoseLandmark.LEFT_SHOULDER.value
            ].y
        ]

        # Sol dirsek
        sol_dirsek = [
            noktalar[
                mp_pose.PoseLandmark.LEFT_ELBOW.value
            ].x,
            noktalar[
                mp_pose.PoseLandmark.LEFT_ELBOW.value
            ].y
        ]

        # Sol el bileği
        sol_bilek = [
            noktalar[
                mp_pose.PoseLandmark.LEFT_WRIST.value
            ].x,
            noktalar[
                mp_pose.PoseLandmark.LEFT_WRIST.value
            ].y
        ]

        # Sol kalça
        sol_kalca = [
            noktalar[
                mp_pose.PoseLandmark.LEFT_HIP.value
            ].x,
            noktalar[
                mp_pose.PoseLandmark.LEFT_HIP.value
            ].y
        ]

        # Sol diz
        sol_diz = [
            noktalar[
                mp_pose.PoseLandmark.LEFT_KNEE.value
            ].x,
            noktalar[
                mp_pose.PoseLandmark.LEFT_KNEE.value
            ].y
        ]

        # Sol ayak bileği
        sol_ayak_bilegi = [
            noktalar[
                mp_pose.PoseLandmark.LEFT_ANKLE.value
            ].x,
            noktalar[
                mp_pose.PoseLandmark.LEFT_ANKLE.value
            ].y
        ]

        # Sol ayak ucu
        sol_ayak_ucu = [
            noktalar[
                mp_pose.PoseLandmark.LEFT_FOOT_INDEX.value
            ].x,
            noktalar[
                mp_pose.PoseLandmark.LEFT_FOOT_INDEX.value
            ].y
        ]

        # Sağ omuz
        sag_omuz = [
            noktalar[
                mp_pose.PoseLandmark.RIGHT_SHOULDER.value
            ].x,
            noktalar[
                mp_pose.PoseLandmark.RIGHT_SHOULDER.value
            ].y
        ]

        # Sağ el bileği
        sag_bilek = [
            noktalar[
                mp_pose.PoseLandmark.RIGHT_WRIST.value
            ].x,
            noktalar[
                mp_pose.PoseLandmark.RIGHT_WRIST.value
            ].y
        ]

        # Sağ ayak bileği
        sag_ayak_bilegi = [
            noktalar[
                mp_pose.PoseLandmark.RIGHT_ANKLE.value
            ].x,
            noktalar[
                mp_pose.PoseLandmark.RIGHT_ANKLE.value
            ].y
        ]

        # Sağ kalça
        sag_kalca = [
            noktalar[
                mp_pose.PoseLandmark.RIGHT_HIP.value
            ].x,
            noktalar[
                mp_pose.PoseLandmark.RIGHT_HIP.value
            ].y
        ]

        # Eklem açılarını hesapla
        omuz_acisi = aci_hesapla(
            sol_dirsek,
            sol_omuz,
            sol_kalca
        )

        dirsek_acisi = aci_hesapla(
            sol_omuz,
            sol_dirsek,
            sol_bilek
        )

        kalca_acisi = aci_hesapla(
            sol_omuz,
            sol_kalca,
            sol_diz
        )

        diz_acisi = aci_hesapla(
            sol_kalca,
            sol_diz,
            sol_ayak_bilegi
        )

        ayak_bilegi_acisi = aci_hesapla(
            sol_diz,
            sol_ayak_bilegi,
            sol_ayak_ucu
        )

        # Model girdisini hazırla
        girdi = pd.DataFrame(
            [[
                omuz_acisi,
                dirsek_acisi,
                kalca_acisi,
                diz_acisi,
                ayak_bilegi_acisi
            ]],
            columns=model_sutunlari
        )

        # Hareket tahmini
        hareket = model.predict(girdi)[0]

        olasiliklar = model.predict_proba(girdi)[0]
        guven = np.max(olasiliklar) * 100

        # Squat kontrolü
        if istenen_hareket == "Squats" and hareket_kontrol_aktif:

            if diz_acisi > 155:
                squat_asamasi = "yukari"
                squat_durumu = "Asagi in"

            elif (
                diz_acisi < 105
                and squat_asamasi == "yukari"
            ):
                squat_sayisi += 1
                squat_asamasi = "asagi"

                if (
                    55 <= diz_acisi <= 105
                    and kalca_acisi < 130
                ):
                    dogru_squat += 1
                    squat_durumu = "DOGRU"
                else:
                    hatali_squat += 1
                    squat_durumu = "HATALI"

            elif 105 <= diz_acisi <= 155:
                squat_durumu = "Biraz daha asagi in"

        # Şınav kontrolü
        if istenen_hareket == "Push Ups" and hareket_kontrol_aktif:

            if dirsek_acisi > 150:
                sinav_asamasi = "yukari"
                sinav_durumu = "Asagi in"

            elif (
                dirsek_acisi < 95
                and sinav_asamasi == "yukari"
            ):
                sinav_sayisi += 1
                sinav_asamasi = "asagi"

                if kalca_acisi > 150:
                    dogru_sinav += 1
                    sinav_durumu = "DOGRU"
                else:
                    hatali_sinav += 1
                    sinav_durumu = "Kalcani duzelt"

            elif 95 <= dirsek_acisi <= 150:
                sinav_durumu = "Biraz daha asagi in"

        # Barfiks kontrolü
        if istenen_hareket == "Pull ups" and hareket_kontrol_aktif:

            if dirsek_acisi > 150:
                barfiks_asamasi = "asagi"
                barfiks_durumu = "Yukari cekil"

            elif (
                dirsek_acisi < 75
                and barfiks_asamasi == "asagi"
            ):
                barfiks_sayisi += 1
                barfiks_asamasi = "yukari"

                if dirsek_acisi < 65:
                    dogru_barfiks += 1
                    barfiks_durumu = "DOGRU"
                else:
                    hatali_barfiks += 1
                    barfiks_durumu = "Biraz daha yukari cik"

            elif 75 <= dirsek_acisi <= 150:
                barfiks_durumu = "Yukari cekilmeye devam et"

        # Aç-kapa zıplama kontrolü
        if istenen_hareket == "Jumping Jacks" and hareket_kontrol_aktif:

            el_mesafesi = abs(sol_bilek[0] - sag_bilek[0])
            ayak_mesafesi = abs(
                sol_ayak_bilegi[0] - sag_ayak_bilegi[0]
            )

            kollar_yukarida = (
                sol_bilek[1] < sol_omuz[1]
                and sag_bilek[1] < sag_omuz[1]
            )

            kollar_asagida = (
                sol_bilek[1] > sol_omuz[1]
                and sag_bilek[1] > sag_omuz[1]
            )

            ayaklar_acik = ayak_mesafesi > 0.25
            ayaklar_kapali = ayak_mesafesi < 0.18

            # Başlangıç konumu
            if kollar_asagida and ayaklar_kapali:
                jumping_jack_asamasi = "kapali"
                jumping_jack_durumu = "Kollarini kaldir"

            # Kollar yukarıda ve ayaklar açık
            elif (
                kollar_yukarida
                and ayaklar_acik
                and jumping_jack_asamasi == "kapali"
            ):
                jumping_jack_sayisi += 1
                dogru_jumping_jack += 1
                jumping_jack_asamasi = "acik"
                jumping_jack_durumu = "DOGRU"

            # Yarım yapılan hareket
            elif kollar_yukarida and not ayaklar_acik:
                jumping_jack_durumu = "Ayaklarini daha fazla ac"

            elif ayaklar_acik and not kollar_yukarida:
                jumping_jack_durumu = "Kollarini daha yukari kaldir"

        # Gövde çevirme kontrolü
        if istenen_hareket == "Russian twists" and hareket_kontrol_aktif:

            # İki elin ve iki kalçanın orta noktaları
            el_orta_x = (sol_bilek[0] + sag_bilek[0]) / 2
            kalca_orta_x = (sol_kalca[0] + sag_kalca[0]) / 2

            # Eşik, kişinin kameradaki omuz genişliğine göre ayarlanır
            omuz_genisligi = abs(sol_omuz[0] - sag_omuz[0])
            yon_esigi = max(0.07, omuz_genisligi * 0.40)
            fark = el_orta_x - kalca_orta_x

            yon = None

            if fark < -yon_esigi:
                yon = "sol"
                russian_twist_durumu = "Sola donuldu"

            elif fark > yon_esigi:
                yon = "sag"
                russian_twist_durumu = "Saga donuldu"

            else:
                russian_twist_durumu = "Bir yana daha fazla don"

            # Sağdan sola veya soldan sağa geçiş yarım harekettir
            if (
                yon is not None
                and russian_twist_son_yon is not None
                and yon != russian_twist_son_yon
            ):
                russian_twist_yarim += 1

                # İki yön değişimi bir tam tekrar sayılır
                if russian_twist_yarim % 2 == 0:
                    russian_twist_sayisi += 1

                    if kalca_acisi < 150:
                        dogru_russian_twist += 1
                        russian_twist_durumu = "DOGRU"
                    else:
                        hatali_russian_twist += 1
                        russian_twist_durumu = "Biraz geriye yaslan"

            if yon is not None:
                russian_twist_son_yon = yon

        # Vücut iskeletini çiz
        mp_drawing.draw_landmarks(
            goruntu,
            sonuc.pose_landmarks,
            mp_pose.POSE_CONNECTIONS
        )

    # Seçilen hareketin güncel tekrar sayısı
    guncel_tekrarlar = {
        "Squats": squat_sayisi,
        "Push Ups": sinav_sayisi,
        "Pull ups": barfiks_sayisi,
        "Jumping Jacks": jumping_jack_sayisi,
        "Russian twists": russian_twist_sayisi
    }

    guncel_tekrar = guncel_tekrarlar[istenen_hareket]
    set_ilerleme = guncel_tekrar - set_baslangic_tekrari

    # Hedef tekrar tamamlandığında seti bitir
    if (
        hareket_kontrol_aktif
        and set_ilerleme >= hedef_tekrar
    ):
        tamamlanan_set += 1
        set_baslangic_tekrari = guncel_tekrar

        if tamamlanan_set >= hedef_set:
            antrenman_tamamlandi = True
            kayit_mesaji = "ANTRENMAN TAMAMLANDI - S ile kaydet"
        else:
            dinlenme_bitis = time.time() + dinlenme_suresi
            kayit_mesaji = "Set tamamlandi - Dinlen"

    if antrenman_tamamlandi:
        program_durumu = "ANTRENMAN TAMAMLANDI"
        kalan_dinlenme = 0
    elif dinlenme_bitis is not None:
        kalan_dinlenme = max(
            0,
            int(dinlenme_bitis - time.time()) + 1
        )
        program_durumu = f"Dinlenme: {kalan_dinlenme} sn"
    else:
        kalan_dinlenme = 0
        aktif_set = min(tamamlanan_set + 1, hedef_set)
        program_durumu = (
            f"Set {aktif_set}/{hedef_set} - "
            f"Tekrar {set_ilerleme}/{hedef_tekrar}"
        )

    # Model sonucunu Türkçe göster
    turkce_hareket = hareket_isimleri.get(
        hareket,
        hareket
    )

    turkce_istenen_hareket = hareket_isimleri[
        istenen_hareket
    ]

    if guven >= 60 and hareket == istenen_hareket:
        hareket_uyumu = "Hareket uyumlu"
        uyum_rengi = (0, 255, 0)
    elif guven >= 60:
        hareket_uyumu = "Secilen hareketten farkli"
        uyum_rengi = (0, 0, 255)
    else:
        hareket_uyumu = "Hareket kontrol ediliyor"
        uyum_rengi = (0, 255, 255)

    # Sol panel
    cv2.rectangle(
        goruntu,
        (5, 5),
        (315, 675),
        (0, 0, 0),
        -1
    )

    panel_satirlari = [
        (
            "AKILLI SPOR SALONU",
            (0, 255, 255)
        ),
        (
            "-----------------------------",
            (180, 180, 180)
        ),
        (
            f"Istenen: {turkce_istenen_hareket}",
            (255, 255, 255)
        ),
        (
            f"Algilanan: {turkce_hareket}",
            (0, 255, 0)
        ),
        (
            f"Guven: %{guven:.1f}",
            (0, 255, 255)
        ),
        (
            hareket_uyumu,
            uyum_rengi
        ),
        (
            f"Sporcu: {sporcu_adi}",
            (255, 255, 255)
        ),
        (
            kayit_mesaji,
            (255, 255, 255)
        ),
        (
            program_durumu,
            (0, 255, 255)
        ),
        (
            "",
            (255, 255, 255)
        ),

        # Squat
        (
            "1. SQUAT",
            (255, 255, 0)
        ),
        (
            f"Tekrar: {squat_sayisi}",
            (255, 255, 255)
        ),
        (
            f"Dogru: {dogru_squat}",
            (0, 255, 0)
        ),
        (
            f"Hatali: {hatali_squat}",
            (0, 0, 255)
        ),
        (
            f"Durum: {squat_durumu}",
            (255, 255, 255)
        ),
        (
            "",
            (255, 255, 255)
        ),

        # Şınav
        (
            "2. SINAV",
            (255, 255, 0)
        ),
        (
            f"Tekrar: {sinav_sayisi}",
            (255, 255, 255)
        ),
        (
            f"Dogru: {dogru_sinav}",
            (0, 255, 0)
        ),
        (
            f"Hatali: {hatali_sinav}",
            (0, 0, 255)
        ),
        (
            f"Durum: {sinav_durumu}",
            (255, 255, 255)
        ),
        (
            "",
            (255, 255, 255)
        ),

        # Barfiks
        (
            "3. BARFIKS",
            (255, 255, 0)
        ),
        (
            f"Tekrar: {barfiks_sayisi}",
            (255, 255, 255)
        ),
        (
            f"Dogru: {dogru_barfiks}",
            (0, 255, 0)
        ),
        (
            f"Hatali: {hatali_barfiks}",
            (0, 0, 255)
        ),
        (
            f"Durum: {barfiks_durumu}",
            (255, 255, 255)
        ),
        (
            "",
            (255, 255, 255)
        ),

        # Aç-kapa zıplama
        (
            "4. AC-KAPA ZIPLAMA",
            (255, 255, 0)
        ),
        (
            f"Tekrar: {jumping_jack_sayisi}",
            (255, 255, 255)
        ),
        (
            f"Dogru: {dogru_jumping_jack}",
            (0, 255, 0)
        ),
        (
            f"Hatali: {hatali_jumping_jack}",
            (0, 0, 255)
        ),
        (
            f"Durum: {jumping_jack_durumu}",
            (255, 255, 255)
        ),
        (
            "",
            (255, 255, 255)
        ),

        # Gövde çevirme
        (
            "5. GOVDE CEVIRME",
            (255, 255, 0)
        ),
        (
            f"Tekrar: {russian_twist_sayisi}",
            (255, 255, 255)
        ),
        (
            f"Dogru: {dogru_russian_twist}",
            (0, 255, 0)
        ),
        (
            f"Hatali: {hatali_russian_twist}",
            (0, 0, 255)
        ),
        (
            f"Durum: {russian_twist_durumu}",
            (255, 255, 255)
        )
    ]

    # Panel yazılarını çiz
    y = 25

    for metin, renk in panel_satirlari:
        cv2.putText(
            goruntu,
            metin,
            (15, y),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.38,
            renk,
            1
        )

        y += 15

    cv2.imshow(
        "Akilli Spor Salonu",
        goruntu
    )

    tus = cv2.waitKey(1) & 0xFF

    if tus == ord("s"):
        hareket_sonuclari = {
            "Squats": (
                squat_sayisi,
                dogru_squat,
                hatali_squat
            ),
            "Push Ups": (
                sinav_sayisi,
                dogru_sinav,
                hatali_sinav
            ),
            "Pull ups": (
                barfiks_sayisi,
                dogru_barfiks,
                hatali_barfiks
            ),
            "Jumping Jacks": (
                jumping_jack_sayisi,
                dogru_jumping_jack,
                hatali_jumping_jack
            ),
            "Russian twists": (
                russian_twist_sayisi,
                dogru_russian_twist,
                hatali_russian_twist
            )
        }

        toplam, dogru, hatali = hareket_sonuclari[
            istenen_hareket
        ]

        if toplam > 0:
            basari_yuzdesi = (dogru / toplam) * 100
        else:
            basari_yuzdesi = 0

        kayit_zamani = datetime.now()
        sure_saniye = int(
            (kayit_zamani - antrenman_baslangic).total_seconds()
        )

        dosya_adi = "antrenman_sonuclari.csv"
        dosya_var = os.path.exists(dosya_adi)

        with open(
            dosya_adi,
            "a",
            newline="",
            encoding="utf-8-sig"
        ) as dosya:
            yazici = csv.writer(dosya)

            if not dosya_var:
                yazici.writerow([
                    "Sporcu",
                    "Tarih",
                    "Hareket",
                    "Sure_Saniye",
                    "Toplam",
                    "Dogru",
                    "Hatali",
                    "Basari_Yuzdesi"
                ])

            yazici.writerow([
                sporcu_adi,
                kayit_zamani.strftime("%d.%m.%Y %H:%M:%S"),
                hareket_isimleri[istenen_hareket],
                sure_saniye,
                toplam,
                dogru,
                hatali,
                round(basari_yuzdesi, 2)
            ])

        kayit_mesaji = "Sonuclar CSV dosyasina kaydedildi"
        print(kayit_mesaji)

    if tus == ord("q"):
        break


kamera.release()
pose.close()
cv2.destroyAllWindows()