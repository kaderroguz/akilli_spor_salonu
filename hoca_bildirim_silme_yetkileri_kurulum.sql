-- Hoca panelinden gonderilen bildirimleri silebilmek icin.
-- Supabase > SQL Editor icinde bir kez calistirin.

alter table public.bildirimler enable row level security;

drop policy if exists "hoca gonderdigini siler" on public.bildirimler;
create policy "hoca gonderdigini siler" on public.bildirimler
for delete using (
  hoca_id = auth.uid()
);
