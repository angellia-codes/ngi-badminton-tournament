import { useBoardContext } from "../lib/BoardProvider";
import { finalMatch } from "../lib/data";
import { teamName } from "../lib/types";

export default function HallOfFame() {
  const { categories, matches, registrationsById, loading, error } = useBoardContext();

  if (loading) return <p className="text-slate">Loading…</p>;
  if (error) return <p className="text-copper">{error}</p>;

  return (
    <div className="space-y-3">
      {categories.map((category) => {
        // The decider is the reset match when one was played, otherwise the
        // grand final.
        const decider = finalMatch(matches, category.id);
        const winner = decider?.winner_registration_id
          ? registrationsById[decider.winner_registration_id]
          : undefined;
        const runnerUp = decider?.loser_registration_id
          ? registrationsById[decider.loser_registration_id]
          : undefined;

        return (
          <article
            key={category.id}
            className={`rounded-2xl border p-4 ${
              winner ? "border-copper/50 bg-copper/10" : "border-slate/25 bg-slate/5"
            }`}
          >
            <h3 className="text-base uppercase tracking-[0.12em]">🏆 {category.name}</h3>

            {winner ? (
              <dl className="mt-3 space-y-2">
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="font-display text-xs uppercase tracking-[0.14em] text-copper">
                    1st place
                  </dt>
                  <dd className="truncate text-right font-display text-lg tracking-[0.02em]">
                    {teamName(winner)}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="font-display text-xs uppercase tracking-[0.14em] text-slate">
                    Runner-up
                  </dt>
                  <dd className="truncate text-right text-sm">{teamName(runnerUp)}</dd>
                </div>
              </dl>
            ) : (
              <p className="mt-2 text-sm text-slate">Still being played.</p>
            )}
          </article>
        );
      })}
    </div>
  );
}
