import pandas as pd

df = pd.read_csv("exercise_angles.csv")

print("Sütunlar:")
print(df.columns.tolist())

print("\nİlk 5 satır:")
print(df.head())

print("\nSatır ve sütun sayısı:")
print(df.shape)

print("\nHer sütundaki farklı değer sayısı:")
print(df.nunique())

print("\nHareketler ve örnek sayıları:")
print(df["Label"].value_counts())
print("\nGround Angle sütunlarının değerleri:")

ground_sutunlari = [
    "Shoulder_Ground_Angle",
    "Elbow_Ground_Angle",
    "Hip_Ground_Angle",
    "Knee_Ground_Angle",
    "Ankle_Ground_Angle"
]

for sutun in ground_sutunlari:
    print(sutun, ":", df[sutun].unique())