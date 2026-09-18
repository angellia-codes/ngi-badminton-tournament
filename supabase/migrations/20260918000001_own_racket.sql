-- Who brings their own racket, so the committee knows how many to prepare or rent.
--
-- Rackets are per person, not per entry: a doubles pair where one player owns a
-- racket and the other does not must still produce a count of 1. A single flag
-- on the row could not express that.
--
-- player_2_own_racket is nullable and mirrors player_2_name — null means the
-- entry is a singles one, the same signal the app already reads to decide
-- whether a second player exists.
alter table registrations
  add column player_1_own_racket boolean not null default false,
  add column player_2_own_racket boolean;
