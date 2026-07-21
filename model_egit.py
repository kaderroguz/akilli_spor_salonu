import pandas as pd
import joblib

from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report

# Veri setini yükle
df = pd.read_csv("exercise_angles.csv")

print("Veri seti yüklendi.")
print("Veri boyutu:", df.shape)

# Side sütununda yalnızca tek değer olduğu için kullanmıyoruz
ozellik_sutunlari = [
    "Shoulder_Angle",
    "Elbow_Angle",
    "Hip_Angle",
    "Knee_Angle",
    "Ankle_Angle"
]

X = df[ozellik_sutunlari]
y = df["Label"]

print("\nKullanılan özellikler:")
print(X.columns.tolist())

print("\nHareketler:")
print(y.value_counts())

# Verileri eğitim ve test olarak ayır
X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.20,
    random_state=42,
    stratify=y
)

print("\nEğitim verisi:", X_train.shape)
print("Test verisi:", X_test.shape)

# Random Forest modelini oluştur
model = RandomForestClassifier(
    n_estimators=200,
    random_state=42,
    n_jobs=-1
)

print("\nModel eğitiliyor...")

model.fit(X_train, y_train)

# Test verisi üzerinde tahmin yap
tahminler = model.predict(X_test)

# Başarı sonuçları
dogruluk = accuracy_score(y_test, tahminler)

print("\nModel eğitimi tamamlandı.")
print(f"Doğruluk oranı: %{dogruluk * 100:.2f}")

print("\nAyrıntılı sonuçlar:")
print(classification_report(y_test, tahminler))

# Modeli kaydet
joblib.dump(model, "hareket_tanima_modeli.pkl")

# Kamerada aynı sütun sırasını kullanmak için sütunları kaydet
joblib.dump(X.columns.tolist(), "model_sutunlari.pkl")

print("\nModel kaydedildi: hareket_tanima_modeli.pkl")
print("Sütunlar kaydedildi: model_sutunlari.pkl")