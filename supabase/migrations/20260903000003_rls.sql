-- Access model: no Supabase Auth. The anon key is read-only everywhere except
-- a single scoped INSERT on registrations. Every privileged write goes through
-- the tournament-api Edge Function, which uses the service role key and
-- verifies a PIN-issued JWT first. The service role bypasses RLS entirely,
-- so nothing below needs a policy for it.

alter table tournaments enable row level security;
alter table outlets enable row level security;
alter table categories enable row level security;
alter table registrations enable row level security;
alter table matches enable row level security;
alter table match_sets enable row level security;

create policy public_read_tournaments on tournaments
  for select to anon, authenticated using (true);

create policy public_read_outlets on outlets
  for select to anon, authenticated using (true);

create policy public_read_categories on categories
  for select to anon, authenticated using (true);

create policy public_read_matches on matches
  for select to anon, authenticated using (true);

create policy public_read_match_sets on match_sets
  for select to anon, authenticated using (true);

-- Pending and rejected registrations are admin-only; the public sees the
-- approved roster only. The submitter gets a local confirmation, not a row read.
create policy public_read_approved_registrations on registrations
  for select to anon, authenticated using (status = 'approved');

-- Anyone may submit, but only as 'pending'. A client cannot self-approve.
create policy public_submit_registration on registrations
  for insert to anon, authenticated with check (status = 'pending');
