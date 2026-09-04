import { Link, Route, BrowserRouter as Router, Routes } from "react-router-dom";
import { BoardProvider } from "./lib/BoardProvider";
import Admin from "./pages/Admin";
import Brackets from "./pages/Brackets";
import HallOfFame from "./pages/HallOfFame";
import Hub from "./pages/Hub";
import Live from "./pages/Live";
import Referee from "./pages/Referee";
import Register from "./pages/Register";

/**
 * Wrapper for every page other than the hub. There is deliberately no nav bar:
 * `/` is the only way between modules, so the link handed to competitors
 * (`/register`) is a dead end that exposes nothing else. `back` is therefore
 * omitted on the registration page and set everywhere else.
 */
function Shell({ back, children }: { back?: boolean; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col">
      <header className="px-4 pt-6 pb-4">
        <p className="font-display text-[11px] uppercase tracking-[0.35em] text-copper">
          Nourish Group Indonesia
        </p>
        <div className="mt-0.5 flex items-baseline justify-between gap-4">
          <h1 className="text-2xl uppercase tracking-[0.06em]">
            Badminton Tournament <span className="text-slate">2026</span>
          </h1>
          {back && (
            <Link
              to="/"
              className="shrink-0 font-display text-xs uppercase tracking-[0.12em] text-slate transition hover:text-copper"
            >
              ← All modules
            </Link>
          )}
        </div>
      </header>

      <main className="flex-1 px-4 py-5">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <BoardProvider>
        <Routes>
          <Route path="/" element={<Hub />} />

          {/* Competitor-facing and intentionally isolated: no nav, no back link. */}
          <Route
            path="/register"
            element={
              <Shell>
                <Register />
              </Shell>
            }
          />

          <Route
            path="/brackets"
            element={
              <Shell back>
                <Brackets />
              </Shell>
            }
          />
          <Route
            path="/live"
            element={
              <Shell back>
                <Live />
              </Shell>
            }
          />
          <Route
            path="/hall-of-fame"
            element={
              <Shell back>
                <HallOfFame />
              </Shell>
            }
          />
          <Route
            path="/referee"
            element={
              <Shell back>
                <Referee />
              </Shell>
            }
          />
          <Route
            path="/admin"
            element={
              <Shell back>
                <Admin />
              </Shell>
            }
          />
        </Routes>
      </BoardProvider>
    </Router>
  );
}
