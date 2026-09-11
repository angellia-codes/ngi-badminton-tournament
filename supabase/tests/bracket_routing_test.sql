-- Self-check for the matches_route_result trigger, the 4-entry single
-- elimination shape used by tournament-api's seed_category, and the
-- first-to-21 rule bump_score enforces.
--
-- Run it against the project (Supabase SQL editor, or psql). It raises an
-- exception on the first wrong answer and cleans up after itself, so a silent
-- run means every assertion passed.
--
-- The 3-entry and 2-entry shapes are the same wiring with fewer matches; if
-- this one is right, a broken one of those shows up immediately in the app as a
-- side that never fills.

do $$
declare
  t uuid; cat uuid; o uuid[]; r uuid[]; chk uuid; complete boolean; msg text;
  sf1 uuid := gen_random_uuid(); sf2 uuid := gen_random_uuid(); f uuid := gen_random_uuid();
begin
  select id into t from tournaments where year = 2026;
  select id into cat from categories where tournament_id = t and name = 'Single Man';
  select array_agg(id order by display_order) into o from outlets;

  insert into registrations (tournament_id, category_id, outlet_id, player_1_name, status)
  select t, cat, o[i], 'ZZTest P' || i, 'approved' from generate_series(1, 4) i;

  select array_agg(id order by player_1_name) into r
  from registrations where category_id = cat and player_1_name like 'ZZTest%';

  -- Same wiring seed_category writes for four entrants, inserted in reverse
  -- order so each next_match_winner_id target already exists. No loser routing:
  -- losing once eliminates you.
  insert into matches (id, tournament_id, category_id, bracket_type, round_number, position, label,
                       registration_a_id, registration_b_id,
                       next_match_winner_id, next_match_winner_slot) values
    (f,   t, cat, 'grand_final', 2, 1, 'Final',      null, null, null, null),
    (sf2, t, cat, 'upper',       1, 2, 'Semifinal 2', r[3], r[4], f, 'b'),
    (sf1, t, cat, 'upper',       1, 1, 'Semifinal 1', r[1], r[2], f, 'a');

  -- ---------------------------------------------------------------------
  -- Routing
  -- ---------------------------------------------------------------------
  update matches set winner_registration_id = r[1], loser_registration_id = r[2], is_complete = true where id = sf1;
  select registration_a_id into chk from matches where id = f;
  if chk is distinct from r[1] then raise exception 'FAIL: final slot a should hold the Semifinal 1 winner'; end if;

  update matches set winner_registration_id = r[3], loser_registration_id = r[4], is_complete = true where id = sf2;
  select registration_b_id into chk from matches where id = f;
  if chk is distinct from r[3] then raise exception 'FAIL: final slot b should hold the Semifinal 2 winner'; end if;

  -- A semifinal loser goes nowhere: only the two winners are in the final.
  if exists (
    select 1 from matches
    where id = f and (registration_a_id in (r[2], r[4]) or registration_b_id in (r[2], r[4]))
  ) then
    raise exception 'FAIL: a semifinal loser reached the final';
  end if;

  -- ---------------------------------------------------------------------
  -- First to 21, win by 2, cap 30
  --
  -- Each case seeds the scoreline one point short, then plays the point
  -- through bump_score — that single increment is the thing under test.
  -- ---------------------------------------------------------------------

  -- 20-19, a scores: 21-19 decides it.
  insert into match_sets (match_id, set_number, score_a, score_b) values (f, 1, 20, 19);
  perform bump_score(f, 1, 'a', 1);
  select winner_registration_id, is_complete into chk, complete from matches where id = f;
  if chk is distinct from r[1] or not complete then
    raise exception 'FAIL: 21-19 should close the match for slot a';
  end if;
  if not exists (select 1 from match_sets where match_id = f and is_complete) then
    raise exception 'FAIL: 21-19 should close the game row';
  end if;

  -- A decided match has a frozen score.
  begin
    perform bump_score(f, 1, 'a', 1);
    raise exception 'FAIL: bump_score should refuse a finished match';
  exception when others then
    get stacked diagnostics msg = message_text;
    if msg like 'FAIL:%' then raise; end if;
  end;

  -- Deuce: 20-20, a scores. 21-20 is not a win — two clear points are needed.
  delete from match_sets where match_id = f;
  update matches set winner_registration_id = null, loser_registration_id = null, is_complete = false where id = f;
  insert into match_sets (match_id, set_number, score_a, score_b) values (f, 1, 20, 20);

  perform bump_score(f, 1, 'a', 1);
  select is_complete into complete from matches where id = f;
  if complete then raise exception 'FAIL: 21-20 should keep the match open'; end if;

  -- 22-20 is.
  perform bump_score(f, 1, 'a', 1);
  select winner_registration_id, is_complete into chk, complete from matches where id = f;
  if chk is distinct from r[1] or not complete then
    raise exception 'FAIL: 22-20 should close the match for slot a';
  end if;

  -- The 30 cap: 29-29 stays open, the next point ends it regardless of margin.
  delete from match_sets where match_id = f;
  update matches set winner_registration_id = null, loser_registration_id = null, is_complete = false where id = f;
  insert into match_sets (match_id, set_number, score_a, score_b) values (f, 1, 29, 28);

  perform bump_score(f, 1, 'b', 1);
  select is_complete into complete from matches where id = f;
  if complete then raise exception 'FAIL: 29-29 should keep the match open'; end if;

  perform bump_score(f, 1, 'b', 1);
  select winner_registration_id, is_complete into chk, complete from matches where id = f;
  if chk is distinct from r[3] or not complete then
    raise exception 'FAIL: 29-30 should close the match for slot b';
  end if;

  delete from matches where category_id = cat;
  delete from registrations where category_id = cat and player_1_name like 'ZZTest%';

  raise notice 'PASS: 4-entry single elimination routed correctly, and 21/deuce/30 all hold';
end $$;
