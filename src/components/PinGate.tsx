import { useState, type ReactNode } from "react";
import { login, logout, useAction, useSession } from "../lib/api";
import type { Role } from "../lib/types";

/**
 * Wraps the admin and referee screens. Admin is deliberately allowed through
 * the referee gate too — the organiser running the desk is often the same
 * person holding the whistle, and the Edge Function accepts either role for
 * scoring actions.
 */
export function PinGate({
  role,
  title,
  children,
}: {
  role: Role;
  title: string;
  children: ReactNode;
}) {
  const session = useSession();
  const [pin, setPin] = useState("");
  const { busy, error, run } = useAction();

  if (session && (session.role === role || session.role === "admin")) {
    return (
      <>
        <div className="mb-4 flex items-center justify-between text-sm text-slate">
          <span>Signed in as {session.role}</span>
          <button
            type="button"
            onClick={logout}
            className="rounded-lg border border-slate/40 px-3 py-1.5 text-cream transition hover:border-copper hover:text-copper"
          >
            Sign out
          </button>
        </div>
        {children}
      </>
    );
  }

  return (
    <form
      className="mx-auto mt-10 w-full max-w-sm rounded-2xl border border-slate/30 bg-slate/10 p-6"
      onSubmit={(e) => {
        e.preventDefault();
        void run(() => login(pin)).then((ok) => ok && setPin(""));
      }}
    >
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-slate">Enter the PIN you were given by the organiser.</p>

      <input
        type="password"
        inputMode="numeric"
        autoComplete="off"
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        placeholder="PIN"
        className="mt-4 w-full rounded-xl border border-slate/40 bg-navy px-4 py-3 tracking-[0.4em] outline-none focus:border-copper"
      />

      {error && <p className="mt-3 text-sm text-copper">{error}</p>}

      <button
        type="submit"
        disabled={busy || !pin}
        className="mt-4 w-full rounded-xl bg-copper px-4 py-3.5 font-display text-base uppercase tracking-[0.12em] text-navy transition disabled:opacity-40"
      >
        {busy ? "Checking…" : "Continue"}
      </button>
    </form>
  );
}
