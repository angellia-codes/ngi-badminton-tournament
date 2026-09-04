-- Bracket progression lives in the database rather than the application so it
-- stays correct even if a match is edited directly in the Supabase dashboard.
-- The Grand Final Reset rule is deliberately NOT here — it is conditional
-- match *creation*, which does not belong in a routing trigger. See the
-- tournament-api Edge Function.

create or replace function route_match_result()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only fire on the null -> set transition, so re-saving a completed match
  -- does not re-route anyone.
  if new.winner_registration_id is null or old.winner_registration_id is not null then
    return null;
  end if;

  if new.next_match_winner_id is not null then
    if new.next_match_winner_slot = 'a' then
      update matches set registration_a_id = new.winner_registration_id
      where id = new.next_match_winner_id;
    else
      update matches set registration_b_id = new.winner_registration_id
      where id = new.next_match_winner_id;
    end if;
  end if;

  -- A null next_match_loser_id means the loser is eliminated.
  if new.loser_registration_id is not null and new.next_match_loser_id is not null then
    if new.next_match_loser_slot = 'a' then
      update matches set registration_a_id = new.loser_registration_id
      where id = new.next_match_loser_id;
    else
      update matches set registration_b_id = new.loser_registration_id
      where id = new.next_match_loser_id;
    end if;
  end if;

  return null;
end;
$$;

create trigger matches_route_result
after update on matches
for each row
execute function route_match_result();
