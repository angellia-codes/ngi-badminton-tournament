-- Realtime: match_sets drives the live scoreboard, matches drives the bracket
-- view updating as results come in.
alter publication supabase_realtime add table match_sets;
alter publication supabase_realtime add table matches;

insert into outlets (name, display_order) values
  ('Nourish Ungasan', 1),
  ('Nourish Uluwatu + The Bakery Uluwatu', 2),
  ('Nourish Berawa + The Bakery Kitchen', 3),
  ('BOH + Wholefood', 4);

insert into tournaments (name, year, status)
values ('Nourish Badminton Tournament 2026', 2026, 'active');

insert into categories (tournament_id, name, is_doubles, display_order)
select t.id, c.name, c.is_doubles, c.display_order
from tournaments t
cross join (values
  ('Single Man', false, 1),
  ('Single Woman', false, 2),
  ('Double Men', true, 3),
  ('Double Women', true, 4)
) as c (name, is_doubles, display_order)
where t.year = 2026;
