alter table public.profiles
add column if not exists hoca_kodu text unique;

alter table public.hoca_sporcu
add column if not exists durum text not null default 'onaylandi'
check (durum in ('bekliyor', 'onaylandi'));

alter table public.hoca_sporcu
add column if not exists created_at timestamptz not null default now();

create or replace function public.hoca_kodu_ata()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if new.rol = 'hoca' and new.hoca_kodu is null then
    new.hoca_kodu := 'HCA-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  end if;
  return new;
end;
$$;

drop trigger if exists profile_hoca_kodu_ata on public.profiles;
create trigger profile_hoca_kodu_ata
before insert or update of rol on public.profiles
for each row execute procedure public.hoca_kodu_ata();

update public.profiles
set hoca_kodu = 'HCA-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6))
where rol = 'hoca' and hoca_kodu is null;

create or replace function public.sporcu_bana_bagli_mi(hedef_sporcu uuid)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (
    select 1 from public.hoca_sporcu
    where hoca_id = auth.uid()
      and sporcu_id = hedef_sporcu
      and durum = 'onaylandi'
  );
$$;

create or replace function public.baglanti_bana_ait_mi(hedef uuid)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
  select exists (
    select 1 from public.hoca_sporcu
    where (hoca_id = auth.uid() and sporcu_id = hedef)
       or (sporcu_id = auth.uid() and hoca_id = hedef)
  );
$$;

create or replace function public.hoca_istegi_gonder(girilen_kod text)
returns text
language plpgsql
security definer set search_path = ''
as $$
declare
  bulunan_hoca uuid;
begin
  if not exists (
    select 1 from public.profiles where id = auth.uid() and rol = 'sporcu'
  ) then
    raise exception 'Bu işlem yalnızca sporcu hesabıyla yapılabilir.';
  end if;

  select id into bulunan_hoca
  from public.profiles
  where rol = 'hoca' and upper(hoca_kodu) = upper(trim(girilen_kod));

  if bulunan_hoca is null then
    raise exception 'Hoca kodu bulunamadı.';
  end if;

  insert into public.hoca_sporcu (hoca_id, sporcu_id, durum)
  values (bulunan_hoca, auth.uid(), 'bekliyor')
  on conflict (hoca_id, sporcu_id)
  do update set durum = 'bekliyor', created_at = now();

  return 'İstek gönderildi';
end;
$$;

grant execute on function public.hoca_istegi_gonder(text) to authenticated;

drop policy if exists "profilini gör" on public.profiles;
create policy "profilini gör" on public.profiles
for select using (
  id = auth.uid() or public.baglanti_bana_ait_mi(id)
);

drop policy if exists "bağlantıyı hoca günceller" on public.hoca_sporcu;
create policy "bağlantıyı hoca günceller" on public.hoca_sporcu
for update using (hoca_id = auth.uid() and public.hoca_miyim())
with check (hoca_id = auth.uid() and public.hoca_miyim());

drop policy if exists "bağlantı silinir" on public.hoca_sporcu;
create policy "bağlantı silinir" on public.hoca_sporcu
for delete using (hoca_id = auth.uid() or sporcu_id = auth.uid());

