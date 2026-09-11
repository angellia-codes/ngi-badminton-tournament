export type Slot = "a" | "b";
export type Role = "admin" | "referee";
export type RegistrationStatus = "pending" | "approved" | "rejected";
/**
 * Mirrors the DB enum. Single elimination only uses `upper` (earlier rounds)
 * and `grand_final` (the final); `lower` and `grand_final_reset` are leftovers
 * from the double-elimination format, kept because rewriting an enum on a
 * foreign-keyed table buys nothing.
 */
export type BracketType = "upper" | "lower" | "grand_final" | "grand_final_reset";

export type Tournament = {
  id: string;
  name: string;
  year: number;
  status: "draft" | "active" | "completed";
};

export type Outlet = {
  id: string;
  name: string;
  display_order: number;
};

export type Category = {
  id: string;
  tournament_id: string;
  name: string;
  is_doubles: boolean;
  display_order: number;
};

export type Registration = {
  id: string;
  tournament_id: string;
  category_id: string;
  outlet_id: string;
  player_1_name: string;
  player_2_name: string | null;
  status: RegistrationStatus;
  submitted_at: string;
  reviewed_at: string | null;
  // Present only on the admin listing, which joins them in.
  outlet?: { name: string } | null;
  category?: { name: string; is_doubles: boolean } | null;
};

export type Match = {
  id: string;
  tournament_id: string;
  category_id: string;
  bracket_type: BracketType;
  round_number: number;
  position: number;
  label: string | null;
  registration_a_id: string | null;
  registration_b_id: string | null;
  winner_registration_id: string | null;
  loser_registration_id: string | null;
  next_match_winner_id: string | null;
  next_match_winner_slot: Slot | null;
  next_match_loser_id: string | null;
  next_match_loser_slot: Slot | null;
  is_complete: boolean;
};

export type MatchSet = {
  id: string;
  match_id: string;
  set_number: number;
  score_a: number;
  score_b: number;
  is_complete: boolean;
};

/** "Ayu & Putri" for doubles, "Ayu" for singles. */
export function teamName(reg: Registration | undefined | null): string {
  if (!reg) return "—";
  return reg.player_2_name ? `${reg.player_1_name} & ${reg.player_2_name}` : reg.player_1_name;
}
