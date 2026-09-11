# Design Spec: Nourish Badminton Tournament App
**Date:** 2026-09-03
**Source PRD:** Nourish_Badminton_Tournament_PRD.md
**Status:** Approved by Angel (HR Manager, NGI) — pending final schema/commands/folder structure generation

## Tech Stack
- Frontend: React + Vite + TypeScript
- Styling: Tailwind CSS (theme colors mapped to brand palette) — inferred from "strict color palette" requirement; not explicitly confirmed, flagged for review
- Icons/Animation: animateicons
- Backend/DB: Supabase (PostgreSQL, Realtime, Edge Functions)
- Precedent: NGI's Engineering Command Center (ECC) already runs on Supabase — this follows established internal convention

## Corrected Brand Palette
| Name | Hex |
|---|---|
| Midnight Navy | #18202F |
| Slate Blue | #68748A |
| Mist Gray | #DCE1E6 |
| Warm White | #F4F7F2 |
| Copper Accent | #B8734F |

(Original PRD had #1820F and #dc1e6 — both invalid 5-character hex codes. Corrected values confirmed by Angel.)

## Architecture Decisions (in order resolved)

1. **Multi-tournament schema.** `tournaments` table; `categories`, `registrations`, `matches` all carry `tournament_id`. Enables reuse across future years and a cross-year Hall of Fame, per NGI's growth trajectory.

2. **Access control: shared PIN, not Supabase Auth.** Two PINs (`ADMIN_PIN`, `REFEREE_PIN`) stored as Supabase Edge Function secrets (env vars) — no `auth.users`, no accounts. Decided after rejecting a client-side-only PIN check (does not protect direct Supabase API writes) in favor of routing all privileged writes through Edge Functions that verify a signed session token server-side.

3. **Doubles players: free text, not normalized.** `registrations.player_1_name` / `player_2_name`, no `players` table. A normalized player entity was rejected because the form has no unique identifier (e.g. employee ID) to reliably match names across submissions/years — building the join would create false confidence, not real cross-year tracking.

4. **Bracket progression: a Postgres trigger.** The winner goes into their pre-assigned next match; there is no loser destination, and the trigger already reads a null one as elimination. Living in the database keeps it correct even under manual DB edits. (Superseded: the format was double elimination with a Grand Final Reset, which needed a matching Edge Function conditional. Single elimination removed both.)

5. **Business rule: one approved registration per (tournament, category, outlet).** Enforced via partial unique index on `registrations` WHERE status='approved'. Multiple pending submissions from the same outlet/category are allowed; only approval is blocked — admin must explicitly choose/reject rather than first-submission-wins.

6. **PIN role split.**
   - Admin PIN → approve/reject registrations, seed Round 1 matches
   - Referee PIN → update live scores, submit match results (which triggers bracket progression)

## Data Model

### tournaments
| Column | Type | Notes |
|---|---|---|
| id | uuid, pk | |
| name | text | |
| year | int | |
| status | enum(draft/active/completed) | |

### outlets
| Column | Type | Notes |
|---|---|---|
| id | uuid, pk | |
| name | text | Seeded: Nourish Ungasan / Nourish Uluwatu + The Bakery Uluwatu / Nourish Berawa + The Bakery Kitchen / BOH + Wholefood |
| display_order | int | |

### categories
| Column | Type | Notes |
|---|---|---|
| id | uuid, pk | |
| tournament_id | fk | |
| name | text | Single Man / Single Woman / Double Men / Double Women |
| is_doubles | boolean | |

### registrations
| Column | Type | Notes |
|---|---|---|
| id | uuid, pk | |
| tournament_id, category_id, outlet_id | fk | |
| player_1_name | text, not null | |
| player_2_name | text, nullable | Required by app-level validation when category.is_doubles |
| status | enum(pending/approved/rejected), default pending | |
| submitted_at, reviewed_at | timestamptz | |

Constraint:
```sql
CREATE UNIQUE INDEX one_approved_slot_per_outlet_category
ON registrations (tournament_id, category_id, outlet_id)
WHERE status = 'approved';
```

### matches
| Column | Type | Notes |
|---|---|---|
| id | uuid, pk | |
| tournament_id, category_id | fk | |
| bracket_type | enum(upper/lower/grand_final/grand_final_reset) | Single elimination uses `upper` for earlier rounds and `grand_final` for the final; `lower` and `grand_final_reset` are left in the enum unused. |
| round_number | int | |
| registration_a_id, registration_b_id | fk, nullable | null = bye or unfilled |
| winner_registration_id, loser_registration_id | fk, nullable | |
| next_match_winner_id, next_match_winner_slot | fk + enum(a/b), nullable | slot field added beyond PRD spec — required for routing to actually resolve which side of the next match |
| next_match_loser_id, next_match_loser_slot | fk + enum(a/b), nullable | null = elimination |
| is_complete | boolean | |

### match_sets (Realtime enabled)
| Column | Type | Notes |
|---|---|---|
| id | uuid, pk | |
| match_id | fk | |
| set_number | int | Always 1 — a match is one game to 21. Column kept rather than dropped. |
| score_a, score_b | int | |
| is_complete | boolean | |

## Auth & Security Model
- `ADMIN_PIN`, `REFEREE_PIN`, `SESSION_SECRET` as Supabase Edge Function secrets.
- Login Edge Functions (`admin-login`, `referee-login`) verify PIN, return signed short-lived JWT with `{ role, exp }`.
- All admin/referee write Edge Functions verify token signature + role before writing.
- RLS: anon key is SELECT-only on all tables, EXCEPT a scoped INSERT policy on `registrations` that forces `status = 'pending'`.
- Public SELECT on `registrations` is scoped to `status = 'approved'` only (pending queue not publicly visible — flagged assumption).

## Mechanics
- Format: single elimination, one game to 21 per match.
- Bracket routing: `AFTER UPDATE` trigger on `matches`, fires on winner transition from null → set.
- Winner selection: derived from the score in `bump_score` — first to 21, win by two, hard cap at 30. The winning increment closes the match in the same statement, which fires the routing trigger.
- Byes: with three entrants the top seed is placed directly in the final's slot A at seed time.
- Seeding: manual, admin-only, no auto-shuffle.
- Escape hatches: `submit_result` awards a walkover/retirement; `undo_result` reopens a finished match and pulls its winner back out of the next match (refused once that next match has been played).

## Explicit Non-Goals (this iteration)
- No cross-year player identity tracking (would require an Employee ID field on the form — not requested)
- No best-of-3. A match is a single game; the 21 / win-by-2 / 30-cap rule is enforced in `bump_score`
- No 3rd place playoff — semifinal losers are eliminated
- No random/automated Round 1 seeding
- No separate PINs for "approve registrations" vs "seed matches" (both are Admin-scoped) or for "score" vs "submit result" (both Referee-scoped) — single PIN per role as confirmed

## Open Items for Angel to Confirm Before Build
1. Tailwind vs. another styling approach (inferred, not explicitly confirmed)
2. Whether pending registrations should be visible to the submitter/public at all
