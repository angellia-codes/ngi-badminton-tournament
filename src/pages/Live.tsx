import { useBoardContext } from "../lib/BoardProvider";
import { gameOf } from "../lib/data";
import { teamName } from "../lib/types";

/**
 * Spectator scoreboard. A match counts as "on court" once both sides are known
 * and it hasn't been finished, so it appears here the moment the referee opens
 * it rather than only after the first point.
 */
export default function Live() {
  const { matches, categories, registrationsById, setsByMatch, loading, error } = useBoardContext();

  if (loading) return <p className="text-slate">Loading…</p>;
  if (error) return <p className="text-copper">{error}</p>;

  const onCourt = matches.filter(
    (m) => !m.is_complete && m.registration_a_id && m.registration_b_id,
  );

  if (onCourt.length === 0) {
    return <p className="text-sm text-slate">No matches on court right now.</p>;
  }

  return (
    <div className="space-y-4">
      {onCourt.map((match) => {
        const game = gameOf(setsByMatch[match.id]);
        const a = registrationsById[match.registration_a_id!];
        const b = registrationsById[match.registration_b_id!];
        const categoryName = categories.find((c) => c.id === match.category_id)?.name;

        return (
          <article key={match.id} className="rounded-2xl border border-slate/30 bg-slate/10 p-4">
            <header className="flex items-center justify-between gap-3 font-display text-[11px] uppercase tracking-[0.1em] text-slate">
              <span className="truncate">
                {categoryName} · {match.label}
              </span>
              <span className="shrink-0">First to 21</span>
            </header>

            <div className="mt-3 grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2">
              <span className="truncate font-medium">{teamName(a)}</span>
              <span className="score text-5xl text-copper">{game?.score_a ?? 0}</span>
              <span className="truncate font-medium">{teamName(b)}</span>
              <span className="score text-5xl text-copper">{game?.score_b ?? 0}</span>
            </div>
          </article>
        );
      })}
    </div>
  );
}
