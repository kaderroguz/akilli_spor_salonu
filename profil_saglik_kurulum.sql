-- Sporcu profilindeki isteğe bağlı spor ve sağlık alanları.
-- Supabase > SQL Editor içinde bir kez çalıştırın.
alter table public.profiles
  add column if not exists dogum_tarihi date,
  add column if not exists boy_cm integer,
  add column if not exists kilo_kg numeric(5,1),
  add column if not exists seviye text,
  add column if not exists sakatlik_notu text,
  add column if not exists saglik_verisi_onayi boolean not null default false,
  add column if not exists profil_guncelleme_zamani timestamptz;

alter table public.profiles
  drop constraint if exists profiles_boy_cm_check,
  add constraint profiles_boy_cm_check
    check (boy_cm is null or boy_cm between 80 and 250),
  drop constraint if exists profiles_kilo_kg_check,
  add constraint profiles_kilo_kg_check
    check (kilo_kg is null or kilo_kg between 20 and 400),
  drop constraint if exists profiles_seviye_check,
  add constraint profiles_seviye_check
    check (seviye is null or seviye in ('Başlangıç', 'Orta', 'İleri'));
