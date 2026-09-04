# Nourish Badminton Tournament 2026

Registration, double-elimination brackets, live scoring and a Hall of Fame for
the internal Nourish badminton tournament.

Built from `docs/Nourish_Badminton_Tournament_PRD.md` and
`docs/badminton-tournament-design.md`.

## Stack

- React + Vite + TypeScript, React Router
- Tailwind CSS v4 (brand palette as `@theme` tokens in `src/index.css`)
- Supabase — Postgres, Realtime, one Edge Function
- Supabase project: `Nourish Badminton Tournament` (`ihlvwvxjirtywndejrtf`)

## Running it

```bash
npm install
cp .env.example .env.local   # already filled in locally
npm run dev
```

## Screens

| Route | Who | What |
|---|---|---|
| `/` | anyone | Registration form. Doubles categories require both names. |
| `/brackets` | anyone | Upper / lower / finals per category, live. |
| `/live` | anyone | Scoreboard for matches on court, live. |
| `/hall-of-fame` | anyone | Winner and runner-up per category. |
| `/admin` | admin PIN | Approve or reject entries, order the draw, seed and clear brackets. |
| `/referee` | referee PIN | `+1` / `-1` scoring, finish a set, submit the match result. |

## How access works

There are no user accounts. Two shared PINs live as Edge Function secrets. The
`login` action trades a PIN for a short-lived signed token (8 hours, one
tournament day); every privileged action requires that token and the right role.

The anon key the browser holds is read-only apart from inserting a `pending`
registration — RLS enforces that, so a client cannot approve itself into a
bracket even with the key in hand. Every write that matters goes through the
`tournament-api` Edge Function using the service role key.

### Required Edge Function secrets

Set these in the Supabase dashboard under **Edge Functions → Secrets** (or with
`supabase secrets set`) before the admin and referee screens will work:

| Secret | What it is |
|---|---|
| `ADMIN_PIN` | Organiser PIN |
| `REFEREE_PIN` | Referee PIN |
| `SESSION_SECRET` | Random string used to sign session tokens |

Rotating `SESSION_SECRET` signs everyone out immediately.

## Brackets

A category is capped at four entrants — one approved entry per outlet, and there
are four outlets — so the seeder holds the three possible shapes (2, 3 and 4
entrants) as literal templates rather than a general algorithm.

Two pieces of logic split deliberately:

- **Routing** (winner up, loser down) is a Postgres trigger, so it stays correct
  even if a match is edited directly in the dashboard.
- **The Grand Final Reset** is in the Edge Function, because it creates a match
  conditionally rather than routing an existing one. Grand final slot A is
  always the upper-bracket champion and slot B the lower-bracket challenger; the
  reset only fires when slot B wins.

The referee picks the winner explicitly — the app never derives it from the
scores, so an unusual finish (retirement, walkover) needs no special case.

## Layout

```
src/
  lib/        supabase client, api client + session, board data hook, types
  pages/      Register, Brackets, Live, HallOfFame, Admin, Referee
  components/ PinGate, MatchCard
supabase/
  migrations/ schema, constraints, RLS, routing trigger, realtime + seed, bump_score
  functions/tournament-api/   the one privileged endpoint
  tests/bracket_routing_test.sql
```

## Checks

`supabase/tests/bracket_routing_test.sql` plays a full four-entrant bracket
through the trigger and asserts every side lands in the right slot. Run it in
the SQL editor; silence means it passed.

## Not built (per the design doc's non-goals)

- No cross-year player identity — the form has no employee ID to match names on.
- No automatic winner from badminton scoring rules.
- No random seeding; the draw order is the organiser's.
- No PINs beyond the two roles.

`animateicons` is installed as a CLI (`npx animateicons add <name>`) rather than
a runtime dependency — it copies icon components into the project on demand, and
pulling its motion dependency into the bundle for decoration is not worth the
weight until an icon is actually wanted.
