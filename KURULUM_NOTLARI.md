# Güncelleme kurulumu

Bu pakette sporcu ekranına şunlar eklendi:

- Şifremi unuttum bağlantısı
- Gelişmiş antrenman istatistikleri
- İsteğe bağlı boy, kilo, seviye ve sakatlık notu alanları
- Bir ödevde birden fazla hareket
- Ödev başlangıç ve son teslim tarihi
- Süresi geçen ödevin kilitlenmesi ve “Yapılmadı” görünmesi
- Ödeve bağlı hoca geri bildirimi ve sporcu bildirimleri

## Bir kez yapılacak Supabase işlemleri

Supabase içindeki **SQL Editor** bölümünde sırayla çalıştırın:

1. `odev_bildirim_kurulum.sql`
2. `profil_saglik_kurulum.sql`

Ardından uygulamayı kapatıp `baslat.bat` dosyasını yeniden çalıştırın.

`Success. No rows returned` mesajı hata değildir; kurulumun başarıyla çalıştığını gösterir.
