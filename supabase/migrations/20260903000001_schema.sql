-- Nourish Badminton Tournament — core schema
-- Multi-tournament by design: categories/registrations/matches all carry tournament_id
-- so future years reuse the same tables and a cross-year Hall of Fame stays possible.

create type tournament_status as enum ('draft', 'active', 'completed');
create type registration_status as enum ('pending', 'approved', 'rejected');
create type bracket_type as enum ('upper', 'lower', 'grand_final', 'grand_final_reset');
create type match_slot as enum ('a', 'b');

create table tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  year int not null,
  status tournament_status not null default 'draft',
  created_at timestamptz not null default now()
);

create table outlets (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  display_order int not null default 0
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments (id) on delete cascade,
  name text not null,
  is_doubles boolean not null default false,
  display_order int not null default 0,
  unique (tournament_id, name)
);

-- player_2_name is nullable at the DB level; the app requires it when
-- category.is_doubles, since the DB cannot see the category from this row alone
-- without a trigger that would buy little over the form + Edge Function checks.
create table registrations (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments (id) on delete cascade,
  category_id uuid not null references categories (id) on delete cascade,
  outlet_id uuid not null references outlets (id),
  player_1_name text not null,
  player_2_name text,
  status registration_status not null default 'pending',
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create table matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments (id) on delete cascade,
  category_id uuid not null references categories (id) on delete cascade,
  bracket_type bracket_type not null,
  round_number int not null,
  position int not null default 0,
  label text,
  registration_a_id uuid references registrations (id),
  registration_b_id uuid references registrations (id),
  winner_registration_id uuid references registrations (id),
  loser_registration_id uuid references registrations (id),
  -- Winner/loser routing. The _slot column says which side of the next match
  -- the player lands in; without it the routing cannot resolve.
  -- A null next_match_loser_id means elimination.
  next_match_winner_id uuid references matches (id) on delete set null,
  next_match_winner_slot match_slot,
  next_match_loser_id uuid references matches (id) on delete set null,
  next_match_loser_slot match_slot,
  is_complete boolean not null default false,
  created_at timestamptz not null default now()
);

create table match_sets (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches (id) on delete cascade,
  set_number int not null,
  score_a int not null default 0,
  score_b int not null default 0,
  is_complete boolean not null default false,
  unique (match_id, set_number)
);

create index registrations_category_status_idx on registrations (category_id, status);
create index matches_category_idx on matches (category_id, bracket_type, round_number, position);
create index match_sets_match_idx on match_sets (match_id, set_number);
