import { useState } from "react";
import { EventDetails, RulesAndRegulations } from "../components/EventInfo";
import { useBoardContext } from "../lib/BoardProvider";
import { useAction } from "../lib/api";
import { supabase } from "../lib/supabase";

const field =
  "mt-1 w-full rounded-xl border border-slate/40 bg-slate/10 px-4 py-3 outline-none focus:border-copper";

/** Checkboxes are tapped on a phone at the venue, so the whole row is the target. */
const check =
  "flex cursor-pointer items-start gap-3 rounded-xl border border-slate/30 bg-slate/10 px-4 py-3 text-sm";
const box = "mt-0.5 size-5 shrink-0 accent-copper";

export default function Register() {
  const { categories, outlets, loading } = useBoardContext();
  const { busy, error, setError, run } = useAction();

  const [categoryId, setCategoryId] = useState("");
  const [outletId, setOutletId] = useState("");
  const [player1, setPlayer1] = useState("");
  const [player2, setPlayer2] = useState("");
  const [player1OwnRacket, setPlayer1OwnRacket] = useState(false);
  const [player2OwnRacket, setPlayer2OwnRacket] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [done, setDone] = useState(false);

  const category = categories.find((c) => c.id === categoryId);
  const isDoubles = category?.is_doubles ?? false;

  if (done) {
    return (
      <div className="rounded-2xl border border-copper/40 bg-copper/10 p-6">
        <h2 className="text-lg font-semibold">You're on the list</h2>
        <p className="mt-2 text-sm text-slate">
          Your entry has been sent to the organisers. Once it's approved you'll appear in the
          bracket — check the Brackets tab on tournament day.
        </p>
        <button
          type="button"
          onClick={() => {
            setDone(false);
            setPlayer1("");
            setPlayer2("");
            setPlayer1OwnRacket(false);
            setPlayer2OwnRacket(false);
            setAgreed(false);
          }}
          className="mt-4 rounded-xl border border-copper px-4 py-2 text-sm text-copper"
        >
          Register someone else
        </button>
      </div>
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();

    // The DB cannot see the category from a registrations row alone, so the
    // doubles rule is enforced here and again before seeding.
    if (isDoubles && !player2.trim()) {
      setError("Doubles needs both players' names.");
      return;
    }
    // Not stored — the committee wants the entrant to have seen the walkover and
    // check-in rules, not a record of it.
    if (!agreed) {
      setError("Please confirm you have read the rules.");
      return;
    }
    if (!category) return;

    void run(async () => {
      const { error: insertError } = await supabase.from("registrations").insert({
        tournament_id: category.tournament_id,
        category_id: category.id,
        outlet_id: outletId,
        player_1_name: player1.trim(),
        player_2_name: isDoubles ? player2.trim() : null,
        player_1_own_racket: player1OwnRacket,
        // Null rather than false for singles, mirroring player_2_name: there is
        // no second player to count a racket for.
        player_2_own_racket: isDoubles ? player2OwnRacket : null,
        status: "pending",
      });
      if (insertError) throw new Error(insertError.message);
    }).then((ok) => ok && setDone(true));
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg uppercase tracking-[0.06em]">Enter the tournament</h2>
        <p className="mt-1 text-sm text-slate">
          One entry per outlet, per category. The organisers approve entries before the draw.
        </p>
      </div>

      {/* Details and rules are static copy, so they render while the category
          and outlet lists are still in flight — venue wifi is what it is, and
          an entrant should never be looking at "Loading…" alone. */}
      <EventDetails />
      <RulesAndRegulations />

      {loading && <p className="text-slate">Loading the entry form…</p>}

      {!loading && (
        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="font-display text-xs uppercase tracking-[0.12em] text-slate">Category</span>
            <select
              required
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className={field}
            >
              <option value="">Choose a category…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="font-display text-xs uppercase tracking-[0.12em] text-slate">Outlet</span>
            <select
              required
              value={outletId}
              onChange={(e) => setOutletId(e.target.value)}
              className={field}
            >
              <option value="">Choose your outlet…</option>
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="font-display text-xs uppercase tracking-[0.12em] text-slate">{isDoubles ? "Player 1" : "Your name"}</span>
            <input
              required
              value={player1}
              onChange={(e) => setPlayer1(e.target.value)}
              className={field}
              placeholder="Full name"
            />
          </label>

          {isDoubles && (
            <label className="block">
              <span className="font-display text-xs uppercase tracking-[0.12em] text-slate">Player 2</span>
              <input
                required
                value={player2}
                onChange={(e) => setPlayer2(e.target.value)}
                className={field}
                placeholder="Partner's full name"
              />
            </label>
          )}

          {/* Per player, not per entry: the committee rents a racket for each
              player who does not tick, and a pair can split. */}
          <fieldset className="space-y-2">
            <legend className="font-display text-xs uppercase tracking-[0.12em] text-slate">
              Rackets
            </legend>

            <label className={check}>
              <input
                type="checkbox"
                checked={player1OwnRacket}
                onChange={(e) => setPlayer1OwnRacket(e.target.checked)}
                className={box}
              />
              {/* Before a name is typed the singles slot reads "You", which needs
                  "your" rather than "their". */}
              <span>
                {player1.trim() || (isDoubles ? "Player 1" : "You")} will bring{" "}
                {!player1.trim() && !isDoubles ? "your" : "their"} own racket
              </span>
            </label>

            {isDoubles && (
              <label className={check}>
                <input
                  type="checkbox"
                  checked={player2OwnRacket}
                  onChange={(e) => setPlayer2OwnRacket(e.target.checked)}
                  className={box}
                />
                <span>{player2.trim() || "Player 2"} will bring their own racket</span>
              </label>
            )}

            <p className="text-xs text-slate">
              Leave unticked and the committee prepares a racket for that player.
            </p>
          </fieldset>

          <label className={check}>
            <input
              type="checkbox"
              required
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className={box}
            />
            <span>I have read and agree to the tournament rules above.</span>
          </label>

          {error && <p className="text-sm text-copper">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-copper px-4 py-3.5 font-display text-base uppercase tracking-[0.12em] text-navy transition disabled:opacity-40"
          >
            {busy ? "Sending…" : "Submit entry"}
          </button>
        </form>
      )}
    </div>
  );
}
