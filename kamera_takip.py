import cv2
import mediapipe as mp
import numpy as np
import pandas as pd
import joblib

# Eğitilmiş modeli ve sütun isimlerini yükle
model = joblib.load("hareket_tanima_modeli.pkl")
model_sutunlari = joblib.load("model_sutunlari.pkl")

# MediaPipe Pose ayarları
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
    """
    Ortadaki b noktası için açıyı hesaplar.
    Örneğin diz açısında:
    a = kalça
    b = diz
    c = ayak bileği
    """

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

if not kamera.isOpened():
    print("Hata: Kamera açılamadı.")
    exit()

print("Kamera açıldı. Kapatmak için q tuşuna basın.")

while True:
    basarili, goruntu = kamera.read()

    if not basarili:
        print("Kameradan görüntü alınamadı.")
        break

    # Görüntüyü ayna görünümüne çevir
    goruntu = cv2.flip(goruntu, 1)

    # OpenCV BGR, MediaPipe RGB kullanır
    rgb_goruntu = cv2.cvtColor(goruntu, cv2.COLOR_BGR2RGB)
    sonuc = pose.process(rgb_goruntu)

    hareket = "Vucut algilanamadi"
    guven = 0

    if sonuc.pose_landmarks:
        noktalar = sonuc.pose_landmarks.landmark

        # Sol taraftaki vücut noktaları
        sol_omuz = [
            noktalar[mp_pose.PoseLandmark.LEFT_SHOULDER.value].x,
            noktalar[mp_pose.PoseLandmark.LEFT_SHOULDER.value].y
        ]

        sol_dirsek = [
            noktalar[mp_pose.PoseLandmark.LEFT_ELBOW.value].x,
            noktalar[mp_pose.PoseLandmark.LEFT_ELBOW.value].y
        ]

        sol_bilek = [
            noktalar[mp_pose.PoseLandmark.LEFT_WRIST.value].x,
            noktalar[mp_pose.PoseLandmark.LEFT_WRIST.value].y
        ]

        sol_kalca = [
            noktalar[mp_pose.PoseLandmark.LEFT_HIP.value].x,
            noktalar[mp_pose.PoseLandmark.LEFT_HIP.value].y
        ]

        sol_diz = [
            noktalar[mp_pose.PoseLandmark.LEFT_KNEE.value].x,
            noktalar[mp_pose.PoseLandmark.LEFT_KNEE.value].y
        ]

        sol_ayak_bilegi = [
            noktalar[mp_pose.PoseLandmark.LEFT_ANKLE.value].x,
            noktalar[mp_pose.PoseLandmark.LEFT_ANKLE.value].y
        ]

        sol_ayak_ucu = [
            noktalar[mp_pose.PoseLandmark.LEFT_FOOT_INDEX.value].x,
            noktalar[mp_pose.PoseLandmark.LEFT_FOOT_INDEX.value].y
        ]

        # Beş eklem açısını hesapla
        omuz_acisi = aci_hesapla(sol_dirsek, sol_omuz, sol_kalca)
        dirsek_acisi = aci_hesapla(sol_omuz, sol_dirsek, sol_bilek)
        kalca_acisi = aci_hesapla(sol_omuz, sol_kalca, sol_diz)
        diz_acisi = aci_hesapla(sol_kalca, sol_diz, sol_ayak_bilegi)
        ayak_bilegi_acisi = aci_hesapla(
            sol_diz,
            sol_ayak_bilegi,
            sol_ayak_ucu
        )

        # Model için veriyi hazırla
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

        # Vücut iskeletini çiz
        mp_drawing.draw_landmarks(
            goruntu,
            sonuc.pose_landmarks,
            mp_pose.POSE_CONNECTIONS
        )

        # Açıları ekranda göster
        cv2.putText(
            goruntu,
            f"Omuz: {omuz_acisi:.0f}",
            (20, 110),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            (255, 255, 0),
            2
        )

        cv2.putText(
            goruntu,
            f"Dirsek: {dirsek_acisi:.0f}",
            (20, 140),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            (255, 255, 0),
            2
        )

        cv2.putText(
            goruntu,
            f"Kalca: {kalca_acisi:.0f}",
            (20, 170),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            (255, 255, 0),
            2            
        )

        cv2.putText(
            goruntu,
            f"Diz: {diz_acisi:.0f}",
            (20, 200),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            (255, 255, 0),
            2
        )

    # Tahmin edilen hareketi göster
    cv2.rectangle(goruntu, (10, 10), (500, 85), (0, 0, 0), -1)

    cv2.putText(
        goruntu,
        f"Hareket: {hareket}",
        (20, 40),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.55,
        (0, 255, 0),
        2
    )

    cv2.putText(
        goruntu,
        f"Guven: %{guven:.1f}",
        (20, 40),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.50,
        (0, 255, 0),
        1
    )

    cv2.imshow("Akilli Spor Salonu", goruntu)

    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

kamera.release()
pose.close()
cv2.destroyAllWindows()