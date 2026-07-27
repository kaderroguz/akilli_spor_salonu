-- Hoca panelinden gonderilen bildirimleri silebilmek icin.
-- Supabase > SQL Editor icinde bir kez calistirin.

alter table public.bildirimler enable row level security;

drop policy if exists "hoca gonderdigini siler" on public.bildirimler;
create policy "hoca gonderdigini siler" on public.bildirimler
for delete using (
  hoca_id = auth.uid()
);

create or replace function public.hoca_bildirimi_sil(hedef_bildirim_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.bildirimler
  where id = hedef_bildirim_id
    and hoca_id = auth.uid();

  if not found then
    raise exception 'Silinecek bildirim bulunamadi veya bu bildirim size ait degil.';
  end if;
end;
$$;

revoke all on function public.hoca_bildirimi_sil(bigint) from public;
grant execute on function public.hoca_bildirimi_sil(bigint) to authenticated;
