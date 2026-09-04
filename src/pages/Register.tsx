import { useState } from "react";
import { useBoardContext } from "../lib/BoardProvider";
import { useAction } from "../lib/api";
import { supabase } from "../lib/supabase";

const field =
  "mt-1 w-full rounded-xl border border-slate/40 bg-slate/10 px-4 py-3 outline-none focus:border-copper";

export default function Register() {
  const { categories, outlets, loading } = useBoardContext();
  const { busy, error, setError, run } = useAction();

  const [categoryId, setCategoryId] = useState("");
  const [outletId, setOutletId] = useState("");
  const [player1, setPlayer1] = useState("");
  const [player2, setPlayer2] = useState("");
  const [done, setDone] = useState(false);

  const category = categories.find((c) => c.id === categoryId);
  const isDoubles = category?.is_doubles ?? false;

  if (loading) return <p className="text-slate">Loading…</p>;

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
    if (!category) return;

    void run(async () => {
      const { error: insertError } = await supabase.from("registrations").insert({
        tournament_id: category.tournament_id,
        category_id: category.id,
        outlet_id: outletId,
        player_1_name: player1.trim(),
        player_2_name: isDoubles ? player2.trim() : null,
        status: "pending",
      });
      if (insertError) throw new Error(insertError.message);
    }).then((ok) => ok && setDone(true));
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <h2 className="text-lg uppercase tracking-[0.06em]">Enter the tournament</h2>
        <p className="mt-1 text-sm text-slate">
          One entry per outlet, per category. The organisers approve entries before the draw.
        </p>
      </div>

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

      {error && <p className="text-sm text-copper">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-xl bg-copper px-4 py-3.5 font-display text-base uppercase tracking-[0.12em] text-navy transition disabled:opacity-40"
      >
        {busy ? "Sending…" : "Submit entry"}
      </button>
    </form>
  );
}
