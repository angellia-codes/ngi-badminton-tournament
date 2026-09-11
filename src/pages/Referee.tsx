import { useState } from "react";
import { PinGate } from "../components/PinGate";
import { useBoardContext } from "../lib/BoardProvider";
import { callApi, useAction } from "../lib/api";
import { gameOf } from "../lib/data";
import { teamName, type Match } from "../lib/types";

/** A match is one game, so there is only ever set number 1. */
const SET_NUMBER = 1;

function Scoreboard({ match, onDone }: { match: Match; onDone: () => void }) {
  const { registrationsById, setsByMatch, categories } = useBoardContext();
  const { busy, error, run } = useAction();
  const [winnerId, setWinnerId] = useState("");

  const game = gameOf(setsByMatch[match.id]);

  const a = registrationsById[match.registration_a_id!];
  const b = registrationsById[match.registration_b_id!];
  const categoryName = categories.find((c) => c.id === match.category_id)?.name;

  const bump = (side: "a" | "b", delta: 1 | -1) =>
    void run(() =>
      callApi("update_score", {
        match_id: match.id,
        set_number: SET_NUMBER,
        side,
        delta,
      }),
    );

  const sideRow = (side: "a" | "b") => {
    const reg = side === "a" ? a : b;
    const score = (side === "a" ? game?.score_a : game?.score_b) ?? 0;
    return (
      <div className="rounded-xl border border-slate/30 bg-slate/10 p-3">
        <p className="truncate text-sm font-medium">{teamName(reg)}</p>
        <div className="mt-2 flex items-center justify-between gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => bump(side, -1)}
            aria-label={`Minus one for ${teamName(reg)}`}
            className="h-14 w-16 rounded-xl border border-slate/40 text-2xl text-slate disabled:opacity-40"
          >
            −
          </button>
          <span className="score text-6xl text-copper">{score}</span>
          <button
            type="button"
            disabled={busy}
            onClick={() => bump(side, 1)}
            aria-label={`Plus one for ${teamName(reg)}`}
            className="h-14 w-16 rounded-xl bg-copper text-2xl font-semibold text-navy disabled:opacity-40"
          >
            +
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={onDone}
        className="font-display text-sm uppercase tracking-[0.1em] text-slate hover:text-copper"
      >
        ← All matches
      </button>

      <header>
        <h2 className="text-lg uppercase tracking-[0.06em]">{categoryName}</h2>
        <p className="font-display text-xs uppercase tracking-[0.1em] text-slate">
          {match.label} · First to 21, win by 2, cap 30
        </p>
      </header>

      {sideRow("a")}
      {sideRow("b")}

      {error && <p className="text-sm text-copper">{error}</p>}

      <p className="text-xs text-slate">
        The match closes itself the moment the game is won, and the bracket advances.
      </p>

      <details className="rounded-xl border border-copper/40 bg-copper/5 p-3">
        <summary className="cursor-pointer text-sm font-medium">Walkover or retirement</summary>
        <p className="mt-1 text-xs text-slate">
          Only for a match that never finishes on court — a walkover, a retirement or an injury.
          A game played out to 21 needs nothing here.
        </p>
        <div className="mt-2 space-y-1">
          {[a, b].map((reg) => (
            <label key={reg?.id} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="winner"
                value={reg?.id ?? ""}
                checked={winnerId === reg?.id}
                onChange={() => setWinnerId(reg?.id ?? "")}
              />
              {teamName(reg)}
            </label>
          ))}
        </div>
        <button
          type="button"
          disabled={busy || !winnerId}
          onClick={() => {
            if (!confirm(`Award the match to ${teamName(registrationsById[winnerId])}? This advances the bracket.`)) return;
            void run(() =>
              callApi("submit_result", {
                match_id: match.id,
                winner_registration_id: winnerId,
              }),
            ).then((ok) => ok && onDone());
          }}
          className="mt-3 w-full rounded-xl bg-copper px-4 py-3.5 font-display text-base uppercase tracking-[0.12em] text-navy disabled:opacity-40"
        >
          Award match
        </button>
      </details>
    </div>
  );
}

/**
 * The score decides the match now, so a mistapped +1 ends it. Finished matches
 * stay listed with a way back, until the next match has been played.
 */
function Finished({ matches }: { matches: Match[] }) {
  const { registrationsById, categories } = useBoardContext();
  const { busy, error, run } = useAction();

  if (matches.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate">Finished</h2>
      {error && <p className="mt-2 text-sm text-copper">{error}</p>}
      <ul className="mt-3 space-y-2">
        {matches.map((m) => (
          <li
            key={m.id}
            className="flex items-center gap-3 rounded-xl border border-slate/30 bg-slate/10 p-3"
          >
            <div className="min-w-0 flex-1">
              <p className="font-display text-xs uppercase tracking-[0.1em] text-slate">
                {categories.find((c) => c.id === m.category_id)?.name} · {m.label}
              </p>
              <p className="mt-1 truncate text-sm">
                {teamName(registrationsById[m.winner_registration_id!])} won
              </p>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (!confirm("Undo this result? The bracket rolls back and the match reopens.")) return;
                void run(() => callApi("undo_result", { match_id: m.id }));
              }}
              className="shrink-0 rounded-lg border border-copper px-3 py-1.5 text-sm text-copper disabled:opacity-40"
            >
              Undo
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function RefereeBody() {
  const { matches, categories, registrationsById, loading } = useBoardContext();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (loading) return <p className="text-slate">Loading…</p>;

  // Dropping a finished match here is what returns the referee to the list the
  // moment the game closes itself.
  const selected = matches.find((m) => m.id === selectedId && !m.is_complete);
  if (selected) return <Scoreboard match={selected} onDone={() => setSelectedId(null)} />;

  const ready = matches.filter(
    (m) => !m.is_complete && m.registration_a_id && m.registration_b_id,
  );
  const finished = matches.filter((m) => m.is_complete);

  return (
    <>
      {ready.length === 0 ? (
        <p className="text-sm text-slate">
          No match is ready to score. A match becomes available once both sides are decided.
        </p>
      ) : (
        <ul className="space-y-2">
          {ready.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => setSelectedId(m.id)}
                className="w-full rounded-xl border border-slate/30 bg-slate/10 p-3 text-left transition hover:border-copper"
              >
                <p className="font-display text-xs uppercase tracking-[0.1em] text-slate">
                  {categories.find((c) => c.id === m.category_id)?.name} · {m.label}
                </p>
                <p className="mt-1 truncate text-sm">
                  {teamName(registrationsById[m.registration_a_id!])}
                  <span className="px-2 text-slate">vs</span>
                  {teamName(registrationsById[m.registration_b_id!])}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Finished matches={finished} />
    </>
  );
}

export default function Referee() {
  return (
    <PinGate role="referee" title="Referee access">
      <RefereeBody />
    </PinGate>
  );
}
