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
  result match_sets;
begin
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

  return result;
end;
$$;

-- Only the service role (i.e. the tournament-api Edge Function, after it has
-- verified a referee token) may move a score.
revoke execute on function bump_score(uuid, int, match_slot, int) from anon, authenticated;
