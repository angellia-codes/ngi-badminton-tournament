import { NavLink, Route, BrowserRouter as Router, Routes } from "react-router-dom";
import { BoardProvider } from "./lib/BoardProvider";
import Admin from "./pages/Admin";
import Brackets from "./pages/Brackets";
import HallOfFame from "./pages/HallOfFame";
import Live from "./pages/Live";
import Referee from "./pages/Referee";
import Register from "./pages/Register";

const NAV = [
  { to: "/", label: "Register", end: true },
  { to: "/brackets", label: "Brackets" },
  { to: "/live", label: "Live" },
  { to: "/hall-of-fame", label: "Winners" },
];

function Nav() {
  return (
    // Scrolls sideways rather than wrapping on a narrow phone.
    <nav className="flex gap-1 overflow-x-auto border-b border-slate/25 px-3 pb-2">
      {NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            `shrink-0 rounded-lg px-3.5 py-2 font-display text-sm uppercase tracking-[0.08em] transition ${
              isActive ? "bg-copper text-navy" : "text-slate hover:text-cream"
            }`
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

export default function App() {
  return (
    <Router>
      <BoardProvider>
        <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col">
          <header className="px-4 pt-6 pb-4">
            <p className="font-display text-[11px] uppercase tracking-[0.35em] text-copper">
              Nourish Group Indonesia
            </p>
            <h1 className="mt-0.5 text-2xl uppercase tracking-[0.06em]">
              Badminton Tournament <span className="text-slate">2026</span>
            </h1>
          </header>

          <Nav />

          <main className="flex-1 px-4 py-5">
            <Routes>
              <Route path="/" element={<Register />} />
              <Route path="/brackets" element={<Brackets />} />
              <Route path="/live" element={<Live />} />
              <Route path="/hall-of-fame" element={<HallOfFame />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/referee" element={<Referee />} />
            </Routes>
          </main>

          <footer className="border-t border-slate/15 px-4 pb-7 pt-4 font-display text-xs uppercase tracking-[0.12em] text-slate">
            <NavLink to="/admin" className="hover:text-copper">
              Organiser
            </NavLink>
            <span className="px-2 text-slate/50">·</span>
            <NavLink to="/referee" className="hover:text-copper">
              Referee
            </NavLink>
          </footer>
        </div>
      </BoardProvider>
    </Router>
  );
}
