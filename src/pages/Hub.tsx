import { Link } from "react-router-dom";
import { useBoardContext } from "../lib/BoardProvider";

/** 20px line icons, sized and coloured by the tile that wraps them. */
const ICONS = {
  register: (
    <>
      <path d="M15 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20" />
      <circle cx="8.5" cy="7" r="3.75" />
      <path d="M19 7v6M22 10h-6" />
    </>
  ),
  // Two seeds feeding a merge, feeding the final: reads as a draw at 20px.
  brackets: (
    <>
      <rect x="2" y="3.5" width="5" height="4" rx="1.25" />
      <rect x="2" y="16.5" width="5" height="4" rx="1.25" />
      <rect x="17" y="10" width="5" height="4" rx="1.25" />
      <path d="M7 5.5h3.5V12H17M7 18.5h3.5V12" />
    </>
  ),
  live: (
    <>
      <path d="M3 12h3l2.5-6 4 13 2.5-7h6" />
    </>
  ),
  winners: (
    <>
      <path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" />
      <path d="M8 6H5.5A2.5 2.5 0 0 0 8 8.5M16 6h2.5A2.5 2.5 0 0 1 16 8.5" />
      <path d="M12 13v3M9 19h6" />
    </>
  ),
  referee: (
    <>
      <circle cx="12" cy="13" r="6" />
      <path d="M12 13v-3M9.5 4h5" />
    </>
  ),
  // Sliders rather than a cog — this is a control panel, not settings.
  admin: (
    <>
      <path d="M3 6h9M17 6h4M3 12h4M12 12h9M3 18h9M17 18h4" />
      <circle cx="14.5" cy="6" r="2.25" />
      <circle cx="9.5" cy="12" r="2.25" />
      <circle cx="14.5" cy="18" r="2.25" />
    </>
  ),
} as const;

type ModuleCard = {
  to: string;
  title: string;
  blurb: string;
  icon: keyof typeof ICONS;
  /** Staff modules get the cooler slate accent; competitor-facing ones copper. */
  staff?: boolean;
};

const MODULES: ModuleCard[] = [
  { to: "/register", title: "Register", blurb: "Competitor sign-up & intake", icon: "register" },
  { to: "/brackets", title: "Brackets", blurb: "Single-elimination draw", icon: "brackets" },
  { to: "/live", title: "Live", blurb: "Court-side score board", icon: "live" },
  { to: "/hall-of-fame", title: "Winners", blurb: "Champions & hall of fame", icon: "winners" },
  { to: "/referee", title: "Referee", blurb: "Match scoring tablet", icon: "referee", staff: true },
  { to: "/admin", title: "Admin", blurb: "Organiser control panel", icon: "admin", staff: true },
];

/** tournament.status is draft | active | completed; the pill mirrors it. */
const STATUS_LABEL: Record<string, string> = {
  draft: "Registration open",
  active: "Tournament in progress",
  completed: "Tournament complete",
};

function StatusPill() {
  const { tournament, loading } = useBoardContext();
  if (loading || !tournament) return null;

  const label = STATUS_LABEL[tournament.status] ?? tournament.status;
  const live = tournament.status === "active";

  return (
    <span className="mt-7 inline-flex items-center gap-2.5 rounded-full border border-slate/25 bg-white/[0.04] px-4 py-2 font-display text-xs uppercase tracking-[0.14em] text-mist">
      <span
        className={`size-1.5 rounded-full ${live ? "bg-copper" : "bg-slate"}`}
        // A quiet pulse only while matches are actually running.
        style={live ? { animation: "hub-pulse 2s ease-in-out infinite" } : undefined}
      />
      {label}
    </span>
  );
}

function Card({ mod }: { mod: ModuleCard }) {
  const accent = mod.staff ? "text-slate" : "text-copper";
  const tile = mod.staff ? "bg-slate/15" : "bg-copper/15";

  return (
    <Link
      to={mod.to}
      className="group rounded-2xl border border-slate/20 bg-white/[0.03] p-5 transition hover:border-copper/45 hover:bg-white/[0.06] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper"
    >
      <span className={`flex size-11 items-center justify-center rounded-xl ${tile} ${accent}`}>
        <svg
          viewBox="0 0 24 24"
          className="size-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {ICONS[mod.icon]}
        </svg>
      </span>
      {/* Generous gap mirrors the reference on desktop; tightened on a phone,
          where six single-column cards would otherwise be a long scroll. */}
      <h2 className="mt-5 text-lg uppercase tracking-[0.05em] text-cream transition group-hover:text-copper sm:mt-9">
        {mod.title}
      </h2>
      <p className="mt-1 text-sm text-slate">{mod.blurb}</p>
    </Link>
  );
}

export default function Hub() {
  return (
    <div className="px-4 py-12 sm:py-16">
      <style>{`@keyframes hub-pulse{0%,100%{opacity:1}50%{opacity:.35}}`}</style>

      <header className="text-center">
        <p className="font-display text-[11px] uppercase tracking-[0.4em] text-mist/70">
          Nourish Group Indonesia
        </p>

        <h1 className="mt-6 text-4xl leading-[1.05] uppercase tracking-[0.02em] sm:text-6xl">
          <span className="block text-cream">Badminton</span>
          <span className="block text-copper">Tournament 2026</span>
        </h1>

        <p className="mx-auto mt-6 max-w-md text-sm leading-relaxed text-slate">
          Internal badminton competition across Nourish Group Indonesia outlets.
          Registration → Single Elimination → Final → Champion.
        </p>

        <StatusPill />
      </header>

      <div className="mx-auto mt-14 grid max-w-3xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MODULES.map((mod) => (
          <Card key={mod.to} mod={mod} />
        ))}
      </div>
    </div>
  );
}
