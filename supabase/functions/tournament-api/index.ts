// Nourish Badminton Tournament — privileged API.
//
// One function with an action router rather than six separate functions: the
// token check, the CORS preamble and the service-role client are identical for
// every privileged operation, so splitting them would mean copying all three
// five more times.
//
// Auth model: no Supabase Auth and no user accounts. Two shared PINs are held
// as function secrets. `login` trades a PIN for a short-lived signed token;
// every other action requires that token with the right role. The anon key can
// only read, so this function is the only path to a privileged write.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import * as jose from "npm:jose@5";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-session-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TOKEN_TTL = "8h"; // one tournament day

type Role = "admin" | "referee";
type Slot = "a" | "b";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function fail(message: string, status = 400) {
  return json({ error: message }, status);
}

const secret = () => {
  const s = Deno.env.get("SESSION_SECRET");
  if (!s) throw new Error("SESSION_SECRET is not configured");
  return new TextEncoder().encode(s);
};

async function issueToken(role: Role) {
  return await new jose.SignJWT({ role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(TOKEN_TTL)
    .sign(secret());
}

class HttpError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

async function requireRole(req: Request, ...allowed: Role[]): Promise<Role> {
  const token = req.headers.get("x-session-token");
  if (!token) throw new HttpError("Not signed in", 401);
  let role: Role;
  try {
    const { payload } = await jose.jwtVerify(token, secret());
    role = payload.role as Role;
  } catch {
    throw new HttpError("Session expired — sign in again", 401);
  }
  if (!allowed.includes(role)) throw new HttpError("Wrong role for this action", 403);
  return role;
}

// ---------------------------------------------------------------------------
// Bracket templates
//
// The "one approved registration per (tournament, category, outlet)" rule plus
// exactly four outlets caps a category at four entrants, so a general N-team
// double-elimination generator would be dead weight. These are the only three
// shapes that can occur, written out literally.
//
// Convention the Grand Final Reset rule depends on: in every template, grand
// final slot A is the upper-bracket champion and slot B is the lower-bracket
// challenger. The reset only happens when slot B wins.
//
// ponytail: hardcoded N=2..4. Write a real generator only if the outlet count
// grows past four.
// ---------------------------------------------------------------------------

type PlanMatch = {
  key: string;
  bracket_type: "upper" | "lower" | "grand_final";
  round_number: number;
  position: number;
  label: string;
  a?: number; // index into the admin-ordered seed list
  b?: number;
  winner_to?: [string, Slot];
  loser_to?: [string, Slot]; // absent = elimination
};

const TEMPLATES: Record<number, PlanMatch[]> = {
  2: [
    { key: "m1", bracket_type: "upper", round_number: 1, position: 1, label: "Upper Bracket Final", a: 0, b: 1, winner_to: ["gf", "a"], loser_to: ["gf", "b"] },
    { key: "gf", bracket_type: "grand_final", round_number: 1, position: 1, label: "Grand Final" },
  ],
  3: [
    { key: "m1", bracket_type: "upper", round_number: 1, position: 1, label: "Upper Bracket Round 1", a: 0, b: 1, winner_to: ["m2", "a"], loser_to: ["m3", "a"] },
    { key: "m2", bracket_type: "upper", round_number: 2, position: 1, label: "Upper Bracket Final", b: 2, winner_to: ["gf", "a"], loser_to: ["m3", "b"] },
    { key: "m3", bracket_type: "lower", round_number: 1, position: 1, label: "Lower Bracket Final", winner_to: ["gf", "b"] },
    { key: "gf", bracket_type: "grand_final", round_number: 1, position: 1, label: "Grand Final" },
  ],
  4: [
    { key: "m1", bracket_type: "upper", round_number: 1, position: 1, label: "Upper Bracket Round 1 — Match 1", a: 0, b: 1, winner_to: ["m3", "a"], loser_to: ["m4", "a"] },
    { key: "m2", bracket_type: "upper", round_number: 1, position: 2, label: "Upper Bracket Round 1 — Match 2", a: 2, b: 3, winner_to: ["m3", "b"], loser_to: ["m4", "b"] },
    { key: "m3", bracket_type: "upper", round_number: 2, position: 1, label: "Upper Bracket Final", winner_to: ["gf", "a"], loser_to: ["m5", "b"] },
    { key: "m4", bracket_type: "lower", round_number: 1, position: 1, label: "Lower Bracket Round 1", winner_to: ["m5", "a"] },
    { key: "m5", bracket_type: "lower", round_number: 2, position: 1, label: "Lower Bracket Final", winner_to: ["gf", "b"] },
    { key: "gf", bracket_type: "grand_final", round_number: 1, position: 1, label: "Grand Final" },
  ],
};

// ---------------------------------------------------------------------------

const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

async function login(payload: { pin?: string }) {
  const adminPin = Deno.env.get("ADMIN_PIN");
  const refereePin = Deno.env.get("REFEREE_PIN");
  if (!adminPin || !refereePin) throw new HttpError("Server PINs are not configured", 500);

  const pin = (payload.pin ?? "").trim();
  const role: Role | null = pin && pin === adminPin
    ? "admin"
    : pin && pin === refereePin
    ? "referee"
    : null;

  if (!role) {
    // Slow down PIN guessing. Crude, but this is an internal event app with two
    // shared PINs, not an account system worth a rate-limit store.
    await new Promise((r) => setTimeout(r, 600));
    throw new HttpError("Incorrect PIN", 401);
  }
  return { token: await issueToken(role), role };
}

async function reviewRegistration(
  payload: { registration_id?: string },
  status: "approved" | "rejected",
) {
  if (!payload.registration_id) throw new HttpError("registration_id is required");

  const { data, error } = await db
    .from("registrations")
    .update({ status, reviewed_at: new Date().toISOString() })
    .eq("id", payload.registration_id)
    .select()
    .single();

  if (error) {
    // The partial unique index is what enforces one approved entry per outlet
    // per category; turn its raw violation into something an admin can act on.
    if (error.code === "23505") {
      throw new HttpError(
        "That outlet already has an approved entry in this category. Reject the existing one first.",
        409,
      );
    }
    throw new HttpError(error.message, 500);
  }
  return { registration: data };
}

async function seedCategory(payload: {
  category_id?: string;
  registration_ids?: string[];
}) {
  const { category_id, registration_ids } = payload;
  if (!category_id || !Array.isArray(registration_ids)) {
    throw new HttpError("category_id and registration_ids are required");
  }

  const template = TEMPLATES[registration_ids.length];
  if (!template) {
    throw new HttpError(
      `A category needs 2 to 4 approved entries to seed; got ${registration_ids.length}.`,
    );
  }
  if (new Set(registration_ids).size !== registration_ids.length) {
    throw new HttpError("The same entry was listed twice");
  }

  const { count } = await db
    .from("matches")
    .select("id", { count: "exact", head: true })
    .eq("category_id", category_id);
  if (count && count > 0) {
    throw new HttpError("This category is already seeded. Clear it first to re-seed.", 409);
  }

  const { data: regs, error: regError } = await db
    .from("registrations")
    .select("id, tournament_id, category_id, status")
    .in("id", registration_ids);
  if (regError) throw new HttpError(regError.message, 500);

  if (regs.length !== registration_ids.length) throw new HttpError("Unknown entry in the list");
  for (const r of regs) {
    if (r.category_id !== category_id) throw new HttpError("An entry belongs to another category");
    if (r.status !== "approved") throw new HttpError("Every entry must be approved before seeding");
  }
  const tournament_id = regs[0].tournament_id;

  // Ids are minted up front so next_match_* links can be wired in the same
  // insert instead of a second update pass.
  const ids: Record<string, string> = {};
  for (const m of template) ids[m.key] = crypto.randomUUID();

  const rows = template.map((m) => ({
    id: ids[m.key],
    tournament_id,
    category_id,
    bracket_type: m.bracket_type,
    round_number: m.round_number,
    position: m.position,
    label: m.label,
    registration_a_id: m.a === undefined ? null : registration_ids[m.a],
    registration_b_id: m.b === undefined ? null : registration_ids[m.b],
    next_match_winner_id: m.winner_to ? ids[m.winner_to[0]] : null,
    next_match_winner_slot: m.winner_to ? m.winner_to[1] : null,
    next_match_loser_id: m.loser_to ? ids[m.loser_to[0]] : null,
    next_match_loser_slot: m.loser_to ? m.loser_to[1] : null,
  }));

  // Reversed: a match's next_match_* target must already exist to satisfy the
  // self-referencing foreign key. Templates are written in forward order, so
  // reversing puts every target ahead of the match pointing at it.
  const { error: insertError } = await db.from("matches").insert(rows.reverse());
  if (insertError) throw new HttpError(insertError.message, 500);

  return { seeded: rows.length };
}

async function clearCategory(payload: { category_id?: string }) {
  if (!payload.category_id) throw new HttpError("category_id is required");
  const { error } = await db.from("matches").delete().eq("category_id", payload.category_id);
  if (error) throw new HttpError(error.message, 500);
  return { cleared: true };
}

async function updateScore(payload: {
  match_id?: string;
  set_number?: number;
  side?: Slot;
  delta?: number;
}) {
  const { match_id, set_number, side, delta } = payload;
  if (!match_id || !set_number || (side !== "a" && side !== "b")) {
    throw new HttpError("match_id, set_number and side are required");
  }
  if (delta !== 1 && delta !== -1) throw new HttpError("delta must be 1 or -1");

  const { data, error } = await db.rpc("bump_score", {
    p_match_id: match_id,
    p_set_number: set_number,
    p_side: side,
    p_delta: delta,
  });
  if (error) throw new HttpError(error.message, 500);
  return { set: data };
}

async function completeSet(payload: {
  match_id?: string;
  set_number?: number;
  is_complete?: boolean;
}) {
  const { match_id, set_number } = payload;
  if (!match_id || !set_number) throw new HttpError("match_id and set_number are required");

  const { data, error } = await db
    .from("match_sets")
    .update({ is_complete: payload.is_complete ?? true })
    .eq("match_id", match_id)
    .eq("set_number", set_number)
    .select()
    .single();
  if (error) throw new HttpError(error.message, 500);
  return { set: data };
}

async function submitResult(payload: {
  match_id?: string;
  winner_registration_id?: string;
}) {
  const { match_id, winner_registration_id } = payload;
  if (!match_id || !winner_registration_id) {
    throw new HttpError("match_id and winner_registration_id are required");
  }

  const { data: match, error } = await db
    .from("matches")
    .select("*")
    .eq("id", match_id)
    .single();
  if (error) throw new HttpError(error.message, 500);

  if (match.is_complete) throw new HttpError("This match is already finished", 409);
  if (!match.registration_a_id || !match.registration_b_id) {
    throw new HttpError("Both sides must be decided before a result can be submitted");
  }
  if (
    winner_registration_id !== match.registration_a_id &&
    winner_registration_id !== match.registration_b_id
  ) {
    throw new HttpError("The winner must be one of the two sides in this match");
  }

  const loser_registration_id = winner_registration_id === match.registration_a_id
    ? match.registration_b_id
    : match.registration_a_id;

  // Progression to the next match is handled by the matches_route_result
  // trigger, which fires on this update.
  const { error: updateError } = await db
    .from("matches")
    .update({
      winner_registration_id,
      loser_registration_id,
      is_complete: true,
    })
    .eq("id", match_id);
  if (updateError) throw new HttpError(updateError.message, 500);

  // Grand Final Reset: creating a conditional match is not routing, so it does
  // not belong in the trigger. Slot B is the lower-bracket challenger by
  // template convention — if they win, the upper-bracket champion has their
  // first loss and the decider is played.
  let reset_created = false;
  if (
    match.bracket_type === "grand_final" &&
    winner_registration_id === match.registration_b_id
  ) {
    const { count } = await db
      .from("matches")
      .select("id", { count: "exact", head: true })
      .eq("category_id", match.category_id)
      .eq("bracket_type", "grand_final_reset");

    if (!count) {
      const { error: resetError } = await db.from("matches").insert({
        tournament_id: match.tournament_id,
        category_id: match.category_id,
        bracket_type: "grand_final_reset",
        round_number: 2,
        position: 1,
        label: "Grand Final (Reset)",
        registration_a_id: match.registration_a_id,
        registration_b_id: match.registration_b_id,
      });
      if (resetError) throw new HttpError(resetError.message, 500);
      reset_created = true;
    }
  }

  return { ok: true, reset_created };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { action, ...payload } = await req.json();

    switch (action) {
      case "login":
        return json(await login(payload));

      case "approve_registration":
        await requireRole(req, "admin");
        return json(await reviewRegistration(payload, "approved"));

      case "reject_registration":
        await requireRole(req, "admin");
        return json(await reviewRegistration(payload, "rejected"));

      case "seed_category":
        await requireRole(req, "admin");
        return json(await seedCategory(payload));

      case "clear_category":
        await requireRole(req, "admin");
        return json(await clearCategory(payload));

      case "list_registrations": {
        // Admins need to see pending entries, which RLS hides from the anon key.
        await requireRole(req, "admin");
        const { data, error } = await db
          .from("registrations")
          .select("*, outlet:outlets(name), category:categories(name, is_doubles)")
          .order("submitted_at", { ascending: true });
        if (error) throw new HttpError(error.message, 500);
        return json({ registrations: data });
      }

      case "update_score":
        await requireRole(req, "referee", "admin");
        return json(await updateScore(payload));

      case "complete_set":
        await requireRole(req, "referee", "admin");
        return json(await completeSet(payload));

      case "submit_result":
        await requireRole(req, "referee", "admin");
        return json(await submitResult(payload));

      default:
        return fail(`Unknown action: ${action}`, 404);
    }
  } catch (e) {
    if (e instanceof HttpError) return fail(e.message, e.status);
    console.error(e);
    return fail(e instanceof Error ? e.message : "Unexpected error", 500);
  }
});
