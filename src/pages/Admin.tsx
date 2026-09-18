import { useCallback, useEffect, useState } from "react";
import { PinGate } from "../components/PinGate";
import { useBoardContext } from "../lib/BoardProvider";
import { callApi, useAction, useSession } from "../lib/api";
import {
  playerCount,
  racketsNeeded,
  teamName,
  type Category,
  type Registration,
} from "../lib/types";

function Queue({
  registrations,
  reload,
}: {
  registrations: Registration[];
  reload: () => void;
}) {
  const { busy, error, run } = useAction();
  const pending = registrations.filter((r) => r.status === "pending");

  return (
    <section>
      <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate">
        Pending entries ({pending.length})
      </h2>
      {error && <p className="mt-2 text-sm text-copper">{error}</p>}

      {pending.length === 0 ? (
        <p className="mt-2 text-sm text-slate">Nothing waiting for review.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {pending.map((r) => (
            <li
              key={r.id}
              className="rounded-xl border border-slate/30 bg-slate/10 p-3 text-sm"
            >
              <p className="font-medium">{teamName(r)}</p>
              <p className="text-xs text-slate">
                {r.category?.name} · {r.outlet?.name}
              </p>
              <p className="text-xs text-slate">
                {racketsNeeded(r) === 0
                  ? `Brings own racket${playerCount(r) > 1 ? "s" : ""}`
                  : `Needs ${racketsNeeded(r)} racket${racketsNeeded(r) > 1 ? "s" : ""}`}
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void run(() =>
                      callApi("approve_registration", { registration_id: r.id }),
                    ).then((ok) => ok && reload())
                  }
                  className="rounded-lg bg-copper px-3 py-1.5 font-medium text-navy disabled:opacity-40"
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void run(() =>
                      callApi("reject_registration", { registration_id: r.id }),
                    ).then((ok) => ok && reload())
                  }
                  className="rounded-lg border border-slate/40 px-3 py-1.5 text-slate disabled:opacity-40"
                >
                  Reject
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * What the committee has to bring or rent on the day. Counted per player, not
 * per entry, so a pair where one player owns a racket counts as one.
 *
 * Approved entries are the number to book against; pending entries are shown
 * separately so the booking can be sized before the queue is cleared.
 */
function Equipment({ registrations }: { registrations: Registration[] }) {
  const approved = registrations.filter((r) => r.status === "approved");
  const pending = registrations.filter((r) => r.status === "pending");

  const total = (rows: Registration[], of: (r: Registration) => number) =>
    rows.reduce((sum, r) => sum + of(r), 0);

  const rackets = total(approved, racketsNeeded);
  const players = total(approved, playerCount);
  const pendingRackets = total(pending, racketsNeeded);

  const byOutlet = approved.reduce<Record<string, number>>((acc, r) => {
    const name = r.outlet?.name ?? "Unknown outlet";
    acc[name] = (acc[name] ?? 0) + racketsNeeded(r);
    return acc;
  }, {});

  return (
    <section>
      <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate">Equipment</h2>

      <div className="mt-3 rounded-xl border border-slate/30 bg-slate/10 p-3">
        <p className="text-sm">
          <span className="font-display text-2xl text-copper">{rackets}</span>{" "}
          <span className="text-slate">
            racket{rackets === 1 ? "" : "s"} to prepare — {players} approved player
            {players === 1 ? "" : "s"}
          </span>
        </p>

        {Object.keys(byOutlet).length > 0 && (
          <ul className="mt-2 space-y-0.5">
            {Object.entries(byOutlet).map(([name, count]) => (
              <li key={name} className="flex justify-between gap-3 text-xs text-slate">
                <span className="min-w-0 truncate">{name}</span>
                <span>{count}</span>
              </li>
            ))}
          </ul>
        )}

        {pendingRackets > 0 && (
          <p className="mt-2 text-xs text-slate">
            +{pendingRackets} more if every pending entry is approved.
          </p>
        )}
      </div>
    </section>
  );
}

function SeedPanel({
  category,
  approved,
  seeded,
  reload,
}: {
  category: Category;
  approved: Registration[];
  seeded: boolean;
  reload: () => void;
}) {
  const { busy, error, run } = useAction();
  // Seeding is deliberately manual — the order below is the draw.
  const [order, setOrder] = useState<string[]>([]);

  useEffect(() => {
    setOrder(approved.map((r) => r.id));
  }, [approved]);

  const move = (index: number, by: number) => {
    const next = [...order];
    const target = index + by;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setOrder(next);
  };

  const byId = Object.fromEntries(approved.map((r) => [r.id, r]));

  return (
    <article className="rounded-xl border border-slate/30 bg-slate/10 p-3">
      <header className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{category.name}</h3>
        <span className="text-xs text-slate">
          {seeded ? "Seeded" : `${approved.length} approved`}
        </span>
      </header>

      {!seeded && (
        <ol className="mt-2 space-y-1">
          {order.map((id, i) => (
            <li key={id} className="flex items-center gap-2 text-sm">
              <span className="w-5 text-xs text-slate">{i + 1}.</span>
              <span className="min-w-0 flex-1 truncate">{teamName(byId[id])}</span>
              <button
                type="button"
                onClick={() => move(i, -1)}
                aria-label="Move up"
                className="rounded border border-slate/40 px-2 text-slate"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                aria-label="Move down"
                className="rounded border border-slate/40 px-2 text-slate"
              >
                ↓
              </button>
            </li>
          ))}
        </ol>
      )}

      {error && <p className="mt-2 text-sm text-copper">{error}</p>}

      <div className="mt-3 flex gap-2">
        {seeded ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (!confirm(`Clear the ${category.name} bracket? All its matches and scores are deleted.`)) return;
              void run(() => callApi("clear_category", { category_id: category.id })).then(
                (ok) => ok && reload(),
              );
            }}
            className="rounded-lg border border-copper px-3 py-1.5 text-sm text-copper disabled:opacity-40"
          >
            Clear bracket
          </button>
        ) : (
          <button
            type="button"
            disabled={busy || order.length < 2 || order.length > 4}
            onClick={() =>
              void run(() =>
                callApi("seed_category", { category_id: category.id, registration_ids: order }),
              ).then((ok) => ok && reload())
            }
            className="rounded-lg bg-copper px-3 py-1.5 text-sm font-medium text-navy disabled:opacity-40"
          >
            Seed bracket
          </button>
        )}
      </div>

      {!seeded && approved.length < 2 && (
        <p className="mt-2 text-xs text-slate">Needs at least 2 approved entries.</p>
      )}
    </article>
  );
}

function AdminBody() {
  const { categories, matches, refresh } = useBoardContext();
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const session = useSession();

  const reload = useCallback(() => {
    callApi<{ registrations: Registration[] }>("list_registrations")
      .then((r) => {
        setRegistrations(r.registrations);
        setLoadError(null);
      })
      .catch((e: Error) => setLoadError(e.message));
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (session) reload();
  }, [session, reload]);

  if (loadError) return <p className="text-copper">{loadError}</p>;

  return (
    <div className="space-y-8">
      <Queue registrations={registrations} reload={reload} />

      <Equipment registrations={registrations} />

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate">
          Draw
        </h2>
        <p className="mt-1 text-xs text-slate">
          Order the approved entries, then seed. Positions 1 and 2 meet in the first match —
          except with three entries, where position 1 takes a bye straight to the final.
        </p>
        <div className="mt-3 space-y-3">
          {categories.map((c) => (
            <SeedPanel
              key={c.id}
              category={c}
              approved={registrations.filter(
                (r) => r.category_id === c.id && r.status === "approved",
              )}
              seeded={matches.some((m) => m.category_id === c.id)}
              reload={reload}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

export default function Admin() {
  return (
    <PinGate role="admin" title="Organiser access">
      <AdminBody />
    </PinGate>
  );
}
