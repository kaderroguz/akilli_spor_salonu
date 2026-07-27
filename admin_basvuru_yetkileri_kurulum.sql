-- Admin panelinden hoca basvurularini onaylamak/reddetmek icin.
-- Supabase > SQL Editor icinde bir kez calistirin.

alter table public.rol_talepleri enable row level security;
alter table public.profiles enable row level security;

drop policy if exists "admin rol taleplerini gorur" on public.rol_talepleri;
create policy "admin rol taleplerini gorur" on public.rol_talepleri
for select using (
  exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and rol in ('admin', 'yonetici')
  )
);

drop policy if exists "admin rol taleplerini gunceller" on public.rol_talepleri;
create policy "admin rol taleplerini gunceller" on public.rol_talepleri
for update using (
  exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and rol in ('admin', 'yonetici')
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and rol in ('admin', 'yonetici')
  )
);

drop policy if exists "admin profil rolu gunceller" on public.profiles;
create policy "admin profil rolu gunceller" on public.profiles
for update using (
  exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and rol in ('admin', 'yonetici')
  )
)
with check (true);
