-- Switch from double elimination to single elimination, one game to 21.
--
-- Two changes live here; the bracket *shape* lives in tournament-api's
-- templates, not in SQL.
--
--   1. Every existing bracket is wiped. The old draws are double-elimination
--      shapes with lower-bracket rows that no longer have a meaning; admins
--      re-seed from /admin.
--   2. bump_score now decides the match itself under BWF rally scoring.
--
-- Deliberately untouched: the bracket_type enum (its 'lower' and
-- 'grand_final_reset' values simply go unused — rewriting an enum used by a
-- foreign-keyed table buys nothing), the matches/match_sets schema, RLS,
-- realtime, and the matches_route_result trigger. That trigger already treats
-- a null next_match_loser_id as elimination, which is exactly what single
-- elimination needs.
--
-- match_sets.set_number stays in the schema but is always 1 now: a match is one
-- game. Dropping the column is a bigger diff than pinning the value.

delete from matches;

-- First to 21, win by two, hard cap at 30. The cap needs no separate clause:
-- play stops at 29-29 plus one point, so 30 is only ever reached at 30-29.
create or replace function game_won(x int, y int)
returns boolean
language sql
immutable
as $$
  select x >= 30 or (x >= 21 and x - y >= 2);
$$;

-- Referees tap +1 fast, sometimes on two devices. A read-modify-write from the
-- Edge Function would drop points under that race, so the increment happens in
-- one statement here instead.
-- Scores floor at 0 so -1 on a fresh set cannot go negative.
create or replace function bump_score(
  p_match_id uuid,
  p_set_number int,
  p_side match_slot,
  p_delta int
)
returns match_sets
language plpgsql
security definer
set search_path = public
as $$
declare
  m matches;
  result match_sets;
  a_won boolean;
begin
  select * into m from matches where id = p_match_id;
  if not found then
    raise exception 'Unknown match';
  end if;
  -- A decided match has a frozen score. Correcting one goes through
  -- undo_result first, so the bracket un-routes before the score moves.
  if m.is_complete then
    raise exception 'This match is already finished — undo the result before changing the score';
  end if;

  insert into match_sets (match_id, set_number, score_a, score_b)
  values (
    p_match_id,
    p_set_number,
    case when p_side = 'a' then greatest(0, p_delta) else 0 end,
    case when p_side = 'b' then greatest(0, p_delta) else 0 end
  )
  on conflict (match_id, set_number) do update
    set score_a = case
          when p_side = 'a' then greatest(0, match_sets.score_a + p_delta)
          else match_sets.score_a
        end,
        score_b = case
          when p_side = 'b' then greatest(0, match_sets.score_b + p_delta)
          else match_sets.score_b
        end
  returning * into result;

  if game_won(result.score_a, result.score_b) or game_won(result.score_b, result.score_a) then
    a_won := result.score_a > result.score_b;

    update match_sets set is_complete = true where id = result.id;
    result.is_complete := true;

    -- The `winner_registration_id is null` guard keeps this a null -> set
    -- transition, which is what matches_route_result fires on. Without it a
    -- re-run could route the same winner twice.
    update matches set
      winner_registration_id = case when a_won then registration_a_id else registration_b_id end,
      loser_registration_id  = case when a_won then registration_b_id else registration_a_id end,
      is_complete = true
    where id = p_match_id and winner_registration_id is null;
  end if;

  return result;
end;
$$;

-- Only the service role (i.e. the tournament-api Edge Function, after it has
-- verified a referee token) may move a score.
revoke execute on function bump_score(uuid, int, match_slot, int) from anon, authenticated;
