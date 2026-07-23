-- Admin panelinden hoca/sporcu profil kayitlarini silebilmek icin.
-- Supabase > SQL Editor icinde bir kez calistirin.

create or replace function public.admin_miyim()
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and rol = 'admin'
  );
$$;

drop policy if exists "admin profil siler" on public.profiles;
create policy "admin profil siler" on public.profiles
for delete using (
  public.admin_miyim()
  and id <> auth.uid()
  and rol in ('sporcu', 'hoca')
);

create or replace function public.admin_kullanici_sil(hedef_kullanici uuid)
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  hedef_rol text;
begin
  if not public.admin_miyim() then
    raise exception 'Bu islemi yalnizca admin yapabilir.';
  end if;

  if hedef_kullanici = auth.uid() then
    raise exception 'Admin kendi kaydini silemez.';
  end if;

  select rol into hedef_rol
  from public.profiles
  where id = hedef_kullanici;

  if hedef_rol not in ('sporcu', 'hoca') then
    raise exception 'Yalnizca sporcu veya hoca kaydi silinebilir.';
  end if;

  delete from public.bildirimler
  where hoca_id = hedef_kullanici
     or sporcu_id = hedef_kullanici;

  delete from public.programlar
  where hoca_id = hedef_kullanici
     or sporcu_id = hedef_kullanici;

  delete from public.antrenmanlar
  where sporcu_id = hedef_kullanici;

  delete from public.hoca_sporcu
  where hoca_id = hedef_kullanici
     or sporcu_id = hedef_kullanici;

  delete from public.rol_talepleri
  where kullanici_id = hedef_kullanici;

  delete from public.profiles
  where id = hedef_kullanici;
end;
$$;

grant execute on function public.admin_kullanici_sil(uuid) to authenticated;
