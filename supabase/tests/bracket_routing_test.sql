-- Self-check for the matches_route_result trigger and the 4-entry bracket
-- shape used by tournament-api's seed_category.
--
-- Run it against the project (Supabase SQL editor, or psql). It raises an
-- exception on the first wrong routing and cleans up after itself, so a silent
-- run means every assertion passed.
--
-- The 3-entry and 2-entry shapes are the same wiring with fewer matches; if
-- this one is right, a broken one of those shows up immediately in the app as a
-- side that never fills.

do $$
declare
  t uuid; cat uuid; o uuid[]; r uuid[]; chk uuid;
  m1 uuid := gen_random_uuid(); m2 uuid := gen_random_uuid(); m3 uuid := gen_random_uuid();
  m4 uuid := gen_random_uuid(); m5 uuid := gen_random_uuid(); gf uuid := gen_random_uuid();
begin
  select id into t from tournaments where year = 2026;
  select id into cat from categories where tournament_id = t and name = 'Single Man';
  select array_agg(id order by display_order) into o from outlets;

  insert into registrations (tournament_id, category_id, outlet_id, player_1_name, status)
  select t, cat, o[i], 'ZZTest P' || i, 'approved' from generate_series(1, 4) i;

  select array_agg(id order by player_1_name) into r
  from registrations where category_id = cat and player_1_name like 'ZZTest%';

  -- Same wiring seed_category writes for four entrants, inserted in reverse
  -- order so each next_match_* target already exists.
  insert into matches (id, tournament_id, category_id, bracket_type, round_number, position, label,
                       registration_a_id, registration_b_id,
                       next_match_winner_id, next_match_winner_slot,
                       next_match_loser_id, next_match_loser_slot) values
    (gf, t, cat, 'grand_final', 1, 1, 'Grand Final', null, null, null, null, null, null),
    (m5, t, cat, 'lower', 2, 1, 'LB Final', null, null, gf, 'b', null, null),
    (m4, t, cat, 'lower', 1, 1, 'LB R1', null, null, m5, 'a', null, null),
    (m3, t, cat, 'upper', 2, 1, 'UB Final', null, null, gf, 'a', m5, 'b'),
    (m2, t, cat, 'upper', 1, 2, 'UB R1 M2', r[3], r[4], m3, 'b', m4, 'b'),
    (m1, t, cat, 'upper', 1, 1, 'UB R1 M1', r[1], r[2], m3, 'a', m4, 'a');

  update matches set winner_registration_id = r[1], loser_registration_id = r[2], is_complete = true where id = m1;
  select registration_a_id into chk from matches where id = m3;
  if chk is distinct from r[1] then raise exception 'FAIL: UB final slot a should hold P1'; end if;
  select registration_a_id into chk from matches where id = m4;
  if chk is distinct from r[2] then raise exception 'FAIL: LB R1 slot a should hold P2'; end if;

  update matches set winner_registration_id = r[3], loser_registration_id = r[4], is_complete = true where id = m2;
  select registration_b_id into chk from matches where id = m3;
  if chk is distinct from r[3] then raise exception 'FAIL: UB final slot b should hold P3'; end if;
  select registration_b_id into chk from matches where id = m4;
  if chk is distinct from r[4] then raise exception 'FAIL: LB R1 slot b should hold P4'; end if;

  update matches set winner_registration_id = r[1], loser_registration_id = r[3], is_complete = true where id = m3;
  select registration_a_id into chk from matches where id = gf;
  if chk is distinct from r[1] then raise exception 'FAIL: GF slot a should hold the UB champion'; end if;
  select registration_b_id into chk from matches where id = m5;
  if chk is distinct from r[3] then raise exception 'FAIL: LB final slot b should hold the UB final loser'; end if;

  update matches set winner_registration_id = r[2], loser_registration_id = r[4], is_complete = true where id = m4;
  select registration_a_id into chk from matches where id = m5;
  if chk is distinct from r[2] then raise exception 'FAIL: LB final slot a should hold the LB R1 winner'; end if;

  update matches set winner_registration_id = r[3], loser_registration_id = r[2], is_complete = true where id = m5;
  select registration_b_id into chk from matches where id = gf;
  if chk is distinct from r[3] then raise exception 'FAIL: GF slot b should hold the LB champion'; end if;

  delete from matches where category_id = cat;
  delete from registrations where category_id = cat and player_1_name like 'ZZTest%';

  raise notice 'PASS: 4-entry double elimination routed correctly end to end';
end $$;
