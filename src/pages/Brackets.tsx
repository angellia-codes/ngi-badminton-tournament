import { useEffect, useState } from "react";
import { MatchCard } from "../components/MatchCard";
import { useBoardContext } from "../lib/BoardProvider";
import type { Match } from "../lib/types";

function Section({
  title,
  matches,
  registrationsById,
  setsByMatch,
}: {
  title: string;
  matches: Match[];
  registrationsById: ReturnType<typeof useBoardContext>["registrationsById"];
  setsByMatch: ReturnType<typeof useBoardContext>["setsByMatch"];
}) {
  if (matches.length === 0) return null;

  const rounds = [...new Set(matches.map((m) => m.round_number))].sort((a, b) => a - b);

  return (
    <section className="mt-6">
      <h3 className="mb-2 flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-slate">
        {title}
        <span className="h-px flex-1 bg-slate/20" />
      </h3>
      {/* One column per round. The container scrolls, not the page. */}
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2">
        {rounds.map((round) => (
          <div key={round} className="flex flex-col justify-around gap-3">
            {matches
              .filter((m) => m.round_number === round)
              .map((m) => (
                <MatchCard
                  key={m.id}
                  match={m}
                  registrationsById={registrationsById}
                  sets={setsByMatch[m.id]}
                />
              ))}
          </div>
        ))}
      </div>
    </section>
  );
}

export default function Brackets() {
  const { categories, matches, registrationsById, setsByMatch, loading, error } = useBoardContext();
  const [categoryId, setCategoryId] = useState("");

  useEffect(() => {
    if (!categoryId && categories.length) setCategoryId(categories[0].id);
  }, [categories, categoryId]);

  if (loading) return <p className="text-slate">Loading…</p>;
  if (error) return <p className="text-copper">{error}</p>;

  const inCategory = matches.filter((m) => m.category_id === categoryId);

  return (
    <>
      <div className="-mx-4 flex gap-1 overflow-x-auto px-4">
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCategoryId(c.id)}
            className={`shrink-0 border-b-2 px-3 py-2 font-display text-sm uppercase tracking-[0.08em] transition ${
              c.id === categoryId
                ? "border-copper text-cream"
                : "border-transparent text-slate hover:text-cream"
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {inCategory.length === 0 ? (
        <p className="mt-8 text-sm text-slate">
          This category hasn't been drawn yet. The bracket appears here once the organisers seed it.
        </p>
      ) : (
        <>
          <Section
            title="Bracket"
            matches={inCategory.filter((m) => m.bracket_type === "upper")}
            registrationsById={registrationsById}
            setsByMatch={setsByMatch}
          />
          <Section
            title="Final"
            matches={inCategory.filter((m) => m.bracket_type === "grand_final")}
            registrationsById={registrationsById}
            setsByMatch={setsByMatch}
          />
        </>
      )}
    </>
  );
}
