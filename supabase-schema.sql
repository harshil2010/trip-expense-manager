create table if not exists public.trip_store (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.trip_store enable row level security;

drop policy if exists "Anyone can read trip data" on public.trip_store;
create policy "Anyone can read trip data"
  on public.trip_store for select
  to anon, authenticated
  using (true);

drop policy if exists "Anyone can write trip data" on public.trip_store;
create policy "Anyone can write trip data"
  on public.trip_store for insert
  to anon, authenticated
  with check (true);

drop policy if exists "Anyone can update trip data" on public.trip_store;
create policy "Anyone can update trip data"
  on public.trip_store for update
  to anon, authenticated
  using (true)
  with check (true);

alter table public.trip_store replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_rel pr
    join pg_class c on c.oid = pr.prrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_publication p on p.oid = pr.prpubid
    where p.pubname = 'supabase_realtime'
      and n.nspname = 'public'
      and c.relname = 'trip_store'
  ) then
    alter publication supabase_realtime add table public.trip_store;
  end if;
end
$$;
