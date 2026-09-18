import { EVENT, RULES } from "../lib/event";

/**
 * The two information blocks on `/register`. Presentational only — the copy
 * lives in `lib/event.ts`.
 *
 * Icons follow the hub's pattern: an inline 24-box path set, sized and coloured
 * by the tile that wraps it, rather than a sprite or an icon dependency.
 */

const CALENDAR = (
  <>
    <rect x="3" y="5" width="18" height="16" rx="2.5" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </>
);

const CLOCK = (
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5.5l3.5 2" />
  </>
);

const PIN = (
  <>
    <path d="M12 21.5s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11Z" />
    <circle cx="12" cy="10.5" r="2.75" />
  </>
);

/** A shuttle in flight — the mark that heads each rules group. */
const SHUTTLE = <path d="M5 19 19 5M19 5l-8.5 1.5L9 11l4 4 4.5-1.5L19 5Z" />;

function Icon({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3.5">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-copper/15 text-copper">
        <Icon className="size-5">{icon}</Icon>
      </span>
      <div className="min-w-0">
        <p className="font-display text-[11px] uppercase tracking-[0.16em] text-slate">{label}</p>
        <p className="text-sm text-cream">{value}</p>
      </div>
    </div>
  );
}

export function EventDetails() {
  return (
    <section className="rounded-2xl border border-slate/25 bg-white/[0.03] p-5">
      <h2 className="text-lg uppercase tracking-[0.06em]">Event details</h2>
      <div className="mt-4 space-y-3.5">
        <DetailRow icon={CALENDAR} label="Date" value={EVENT.date} />
        <DetailRow icon={CLOCK} label="Time" value={EVENT.time} />
        <DetailRow icon={PIN} label="Venue" value={EVENT.venue} />
      </div>
    </section>
  );
}

/**
 * Open by default — an entrant should not have to ask for the rules — but
 * collapsible, so a phone is not five groups of scrolling away from the form.
 */
export function RulesAndRegulations() {
  return (
    <details open className="group rounded-2xl border border-slate/25 bg-white/[0.03] p-5">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <h2 className="text-lg uppercase tracking-[0.06em]">Rules &amp; regulations</h2>
        <span className="font-display text-xs uppercase tracking-[0.12em] text-slate">
          <span className="group-open:hidden">Show</span>
          <span className="hidden group-open:inline">Hide</span>
        </span>
      </summary>

      <div className="mt-4 space-y-5">
        {RULES.map((group) => (
          <div key={group.title} className="flex gap-3.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-copper/15 text-copper">
              <Icon className="size-4">{SHUTTLE}</Icon>
            </span>
            <div className="min-w-0">
              <h3 className="text-sm uppercase tracking-[0.08em] text-copper">{group.title}</h3>
              <ul className="mt-1.5 space-y-1.5">
                {group.items.map((item) => (
                  <li key={item} className="flex gap-2 text-sm leading-relaxed text-mist">
                    <span aria-hidden="true" className="text-slate">
                      •
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}
