/**
 * Event details and rules as data rather than markup, so `/register` is not the
 * only place they can appear — the hub can pick the same copy up later without
 * a second edit and a second chance to drift.
 */

export const EVENT = {
  date: "Thursday, 15 October 2026",
  time: "6:00 PM – 8:00 PM",
  venue: "LINING Badminton, Jimbaran",
} as const;

export type RuleGroup = { title: string; items: string[] };

export const RULES: RuleGroup[] = [
  {
    title: "Eligibility",
    items: [
      "Open to all active NGI employees across all outlets and departments",
      "Each outlet may register one approved player (or pair, for doubles) per category",
      "Players must check in at least 15 minutes before their scheduled match",
    ],
  },
  {
    title: "Format",
    items: [
      "Single-elimination per category — 4 outlet representatives (or pairs, for doubles)",
      "Selection round (semifinals): 4 entrants play down to 2",
      "Final: the 2 semifinal winners play for Winner and Runner-up",
      "A single loss eliminates a player/team — no lower bracket",
      // Not in the original design, but it is what bump_score enforces and an
      // entrant has no other way to find out.
      "One game to 21 points — win by two, hard cap at 30",
    ],
  },
  {
    title: "Walkover & Withdrawal",
    items: [
      "A no-show after the grace period results in an automatic walkover loss",
      "Report withdrawals to the tournament admin as early as possible so the bracket can be adjusted",
    ],
  },
  {
    title: "Equipment",
    items: [
      "Rackets and shuttlecocks are provided by the tournament committee",
      "Players may use their own racket if preferred",
    ],
  },
  {
    title: "Decisions",
    items: [
      "The Tournament Committee has final authority on all bracket, scoring, and eligibility disputes",
    ],
  },
];
