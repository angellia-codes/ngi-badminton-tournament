import { useState } from "react";
import { PinGate } from "../components/PinGate";
import { useBoardContext } from "../lib/BoardProvider";
import { callApi, useAction } from "../lib/api";
import { setsWon } from "../lib/data";
import { teamName, type Match } from "../lib/types";

/** The set being played: the last unfinished one, else the next one to start. */
function currentSetNumber(sets: { set_number: number; is_complete: boolean }[]) {
  const open = sets.filter((s) => !s.is_complete).at(-1);
  if (open) return open.set_number;
  return sets.length === 0 ? 1 : Math.max(...sets.map((s) => s.set_number)) + 1;
}

function Scoreboard({ match, onDone }: { match: Match; onDone: () => void }) {
  const { registrationsById, setsByMatch, categories } = useBoardContext();
  const { busy, error, run } = useAction();
  const [winnerId, setWinnerId] = useState("");

  const sets = setsByMatch[match.id] ?? [];
  const setNumber = currentSetNumber(sets);
  const current = sets.find((s) => s.set_number === setNumber);
  const tally = setsWon(sets);

  const a = registrationsById[match.registration_a_id!];
  const b = registrationsById[match.registration_b_id!];
  const categoryName = categories.find((c) => c.id === match.category_id)?.name;

  const bump = (side: "a" | "b", delta: 1 | -1) =>
    void run(() =>
      callApi("update_score", {
        match_id: match.id,
        set_number: setNumber,
        side,
        delta,
      }),
    );

  const sideRow = (side: "a" | "b") => {
    const reg = side === "a" ? a : b;
    const score = (side === "a" ? current?.score_a : current?.score_b) ?? 0;
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
          {match.label} · Set {setNumber} · Sets won {tally.a}–{tally.b}
        </p>
      </header>

      {sideRow("a")}
      {sideRow("b")}

      {error && <p className="text-sm text-copper">{error}</p>}

      <button
        type="button"
        disabled={busy || !current}
        onClick={() =>
          void run(() => callApi("complete_set", { match_id: match.id, set_number: setNumber }))
        }
        className="w-full rounded-xl border border-slate/40 px-4 py-3 font-display text-sm uppercase tracking-[0.1em] disabled:opacity-40"
      >
        Finish set {setNumber}
      </button>

      <div className="rounded-xl border border-copper/40 bg-copper/5 p-3">
        <p className="text-sm font-medium">Submit match result</p>
        <p className="mt-1 text-xs text-slate">
          The referee decides the winner — the app does not infer it from the scores.
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
            if (!confirm(`Confirm ${teamName(registrationsById[winnerId])} wins? This advances the bracket.`)) return;
            void run(() =>
              callApi("submit_result", {
                match_id: match.id,
                winner_registration_id: winnerId,
              }),
            ).then((ok) => ok && onDone());
          }}
          className="mt-3 w-full rounded-xl bg-copper px-4 py-3.5 font-display text-base uppercase tracking-[0.12em] text-navy disabled:opacity-40"
        >
          Submit result
        </button>
      </div>
    </div>
  );
}

function RefereeBody() {
  const { matches, categories, registrationsById, loading } = useBoardContext();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (loading) return <p className="text-slate">Loading…</p>;

  const selected = matches.find((m) => m.id === selectedId);
  if (selected) return <Scoreboard match={selected} onDone={() => setSelectedId(null)} />;

  const ready = matches.filter(
    (m) => !m.is_complete && m.registration_a_id && m.registration_b_id,
  );

  if (ready.length === 0) {
    return (
      <p className="text-sm text-slate">
        No match is ready to score. A match becomes available once both sides are decided.
      </p>
    );
  }

  return (
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
  );
}

export default function Referee() {
  return (
    <PinGate role="referee" title="Referee access">
      <RefereeBody />
    </PinGate>
  );
}
