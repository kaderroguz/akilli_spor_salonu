-- Sporcu panelinde odev/program ve antrenman sonucu silebilmek icin.
-- Supabase > SQL Editor icinde bir kez calistirin.

alter table public.programlar enable row level security;
alter table public.antrenmanlar enable row level security;

drop policy if exists "sporcu program siler" on public.programlar;
create policy "sporcu program siler" on public.programlar
for delete using (
  sporcu_id = auth.uid()
);

drop policy if exists "sporcu antrenman siler" on public.antrenmanlar;
create policy "sporcu antrenman siler" on public.antrenmanlar
for delete using (
  sporcu_id = auth.uid()
);
