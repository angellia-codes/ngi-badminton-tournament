import { useCallback, useEffect, useState } from "react";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./supabase";
import type { Role } from "./types";

const STORAGE_KEY = "nbt.session";
const ENDPOINT = `${SUPABASE_URL}/functions/v1/tournament-api`;

type Session = { token: string; role: Role };

function readSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

// sessionStorage only fires "storage" in other tabs, so components in this tab
// need their own nudge when the session changes.
const listeners = new Set<() => void>();
function broadcast() {
  for (const l of listeners) l();
}

export function setSession(session: Session | null) {
  if (session) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  else sessionStorage.removeItem(STORAGE_KEY);
  broadcast();
}

export function useSession(): Session | null {
  const [session, setLocal] = useState<Session | null>(readSession);
  useEffect(() => {
    const sync = () => setLocal(readSession());
    listeners.add(sync);
    window.addEventListener("storage", sync);
    return () => {
      listeners.delete(sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return session;
}

/**
 * Calls the tournament-api Edge Function. The anon key satisfies the function's
 * own JWT gate; the PIN-issued token in x-session-token is what actually grants
 * the role.
 */
export async function callApi<T = unknown>(
  action: string,
  payload: Record<string, unknown> = {},
): Promise<T> {
  const session = readSession();
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      ...(session ? { "x-session-token": session.token } : {}),
    },
    body: JSON.stringify({ action, ...payload }),
  });

  const body = await res.json().catch(() => ({}) as { error?: string });
  if (!res.ok) {
    // An expired or rejected token should drop the stale session so the PIN
    // screen comes back instead of every action failing silently.
    if (res.status === 401) setSession(null);
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return body as T;
}

export async function login(pin: string): Promise<Role> {
  const { token, role } = await callApi<{ token: string; role: Role }>("login", { pin });
  setSession({ token, role });
  return role;
}

export function logout() {
  setSession(null);
}

/** Wraps an async action with pending/error state, so pages don't each re-do it. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  return { busy, error, setError, run };
}
