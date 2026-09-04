import { setsWon } from "../lib/data";
import { teamName, type Match, type MatchSet, type Registration } from "../lib/types";

const BRACKET_TONE: Record<Match["bracket_type"], string> = {
  upper: "text-slate",
  lower: "text-slate",
  grand_final: "text-copper",
  grand_final_reset: "text-copper",
};

function Side({
  reg,
  won,
  lost,
  sets,
  side,
}: {
  reg: Registration | undefined;
  won: boolean;
  lost: boolean;
  sets: MatchSet[];
  side: "a" | "b";
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 ${
        won ? "bg-copper/20 text-cream" : lost ? "text-slate" : "text-cream"
      }`}
    >
      <span className="min-w-0 flex-1 truncate text-sm font-medium">
        {reg ? teamName(reg) : <span className="text-slate italic">Awaiting result</span>}
      </span>
      <span className="score flex shrink-0 gap-1.5 text-sm">
        {sets.map((s) => (
          <span
            key={s.id}
            className={`w-6 rounded text-center ${
              s.is_complete ? "bg-navy/60 text-cream" : "bg-copper/30 text-cream"
            }`}
          >
            {side === "a" ? s.score_a : s.score_b}
          </span>
        ))}
      </span>
    </div>
  );
}

export function MatchCard({
  match,
  registrationsById,
  sets = [],
}: {
  match: Match;
  registrationsById: Record<string, Registration>;
  sets?: MatchSet[];
}) {
  const a = match.registration_a_id ? registrationsById[match.registration_a_id] : undefined;
  const b = match.registration_b_id ? registrationsById[match.registration_b_id] : undefined;
  const tally = setsWon(sets);
  const live = !match.is_complete && sets.length > 0;

  return (
    <article className="w-64 shrink-0 rounded-xl border border-slate/30 bg-slate/10 p-2">
      <header
        className={`flex items-center justify-between px-1 pb-1.5 font-display text-[11px] uppercase tracking-[0.1em] ${BRACKET_TONE[match.bracket_type]}`}
      >
        <span className="truncate">{match.label ?? "Match"}</span>
        {live && (
          <span className="ml-2 flex shrink-0 items-center gap-1 text-copper">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-copper" />
            Live
          </span>
        )}
        {match.is_complete && (
          <span className="score ml-2 shrink-0">
            {tally.a}–{tally.b}
          </span>
        )}
      </header>

      <Side
        reg={a}
        side="a"
        sets={sets}
        won={!!match.winner_registration_id && match.winner_registration_id === match.registration_a_id}
        lost={!!match.winner_registration_id && match.winner_registration_id !== match.registration_a_id}
      />
      <Side
        reg={b}
        side="b"
        sets={sets}
        won={!!match.winner_registration_id && match.winner_registration_id === match.registration_b_id}
        lost={!!match.winner_registration_id && match.winner_registration_id !== match.registration_b_id}
      />
    </article>
  );
}
