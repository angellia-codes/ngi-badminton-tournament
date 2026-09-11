import { gameOf } from "../lib/data";
import { teamName, type Match, type MatchSet, type Registration } from "../lib/types";

function Side({
  reg,
  won,
  lost,
  score,
}: {
  reg: Registration | undefined;
  won: boolean;
  lost: boolean;
  score: number | undefined;
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
      <span className="score w-7 shrink-0 text-center text-sm">{score ?? ""}</span>
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
  const game = gameOf(sets);
  const live = !match.is_complete && !!game;

  return (
    <article className="w-64 shrink-0 rounded-xl border border-slate/30 bg-slate/10 p-2">
      <header
        className={`flex items-center justify-between px-1 pb-1.5 font-display text-[11px] uppercase tracking-[0.1em] ${
          match.bracket_type === "grand_final" ? "text-copper" : "text-slate"
        }`}
      >
        <span className="truncate">{match.label ?? "Match"}</span>
        {live && (
          <span className="ml-2 flex shrink-0 items-center gap-1 text-copper">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-copper" />
            Live
          </span>
        )}
      </header>

      <Side
        reg={a}
        score={game?.score_a}
        won={!!match.winner_registration_id && match.winner_registration_id === match.registration_a_id}
        lost={!!match.winner_registration_id && match.winner_registration_id !== match.registration_a_id}
      />
      <Side
        reg={b}
        score={game?.score_b}
        won={!!match.winner_registration_id && match.winner_registration_id === match.registration_b_id}
        lost={!!match.winner_registration_id && match.winner_registration_id !== match.registration_b_id}
      />
    </article>
  );
}
