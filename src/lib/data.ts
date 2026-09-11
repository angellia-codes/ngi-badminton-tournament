import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";
import type { Category, Match, MatchSet, Outlet, Registration, Tournament } from "./types";

/**
 * The whole board in one hook.
 *
 * Four categories of at most four entrants each caps this at ~24 matches and
 * ~70 set rows, so fetching everything and re-fetching on any realtime event is
 * cheaper — in code and in round trips — than per-page queries with narrow
 * subscriptions. Revisit only if a tournament ever grows past a few hundred rows.
 */
export type Board = {
  tournament: Tournament | null;
  categories: Category[];
  outlets: Outlet[];
  registrations: Registration[];
  matches: Match[];
  sets: MatchSet[];
  registrationsById: Record<string, Registration>;
  setsByMatch: Record<string, MatchSet[]>;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

export function useBoard(): Board {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [sets, setSets] = useState<MatchSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [t, c, o, r, m, s] = await Promise.all([
        supabase.from("tournaments").select("*").order("year", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("categories").select("*").order("display_order"),
        supabase.from("outlets").select("*").order("display_order"),
        // RLS scopes this to approved entries for the public anon key.
        supabase.from("registrations").select("*"),
        supabase.from("matches").select("*").order("round_number").order("position"),
        supabase.from("match_sets").select("*").order("set_number"),
      ]);

      const failed = [t, c, o, r, m, s].find((x) => x.error);
      if (failed?.error) throw new Error(failed.error.message);

      setTournament(t.data as Tournament | null);
      setCategories((c.data ?? []) as Category[]);
      setOutlets((o.data ?? []) as Outlet[]);
      setRegistrations((r.data ?? []) as Registration[]);
      setMatches((m.data ?? []) as Match[]);
      setSets((s.data ?? []) as MatchSet[]);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the tournament");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();

    const channel = supabase
      .channel("board")
      .on("postgres_changes", { event: "*", schema: "public", table: "match_sets" }, () => void refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, () => void refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "registrations" }, () => void refresh())
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [refresh]);

  const registrationsById = useMemo(
    () => Object.fromEntries(registrations.map((r) => [r.id, r])),
    [registrations],
  );

  const setsByMatch = useMemo(() => {
    const grouped: Record<string, MatchSet[]> = {};
    for (const s of sets) (grouped[s.match_id] ??= []).push(s);
    return grouped;
  }, [sets]);

  return {
    tournament,
    categories,
    outlets,
    registrations,
    matches,
    sets,
    registrationsById,
    setsByMatch,
    loading,
    error,
    refresh,
  };
}

/** The match that decides a category. */
export function finalMatch(matches: Match[], categoryId: string): Match | undefined {
  return matches.find((m) => m.category_id === categoryId && m.bracket_type === "grand_final");
}

/**
 * The one game a match consists of. Every match has exactly one row in
 * match_sets, created lazily by the first point; until then there is none.
 */
export function gameOf(sets: MatchSet[] = []): MatchSet | undefined {
  return sets[0];
}
