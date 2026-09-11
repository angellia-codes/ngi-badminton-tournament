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
// Bracket templates — single elimination.
//
// The "one approved registration per (tournament, category, outlet)" rule plus
// exactly four outlets caps a category at four entrants, so a general N-team
// generator would be dead weight. These are the only three shapes that can
// occur, written out literally.
//
// No template has a loser_to: losing once eliminates you, and the
// matches_route_result trigger already treats a null next_match_loser_id as
// elimination.
//
// ponytail: hardcoded N=2..4. Write a real generator only if the outlet count
// grows past four.
// ---------------------------------------------------------------------------

type PlanMatch = {
  key: string;
  bracket_type: "upper" | "grand_final";
  round_number: number;
  position: number;
  label: string;
  a?: number; // index into the admin-ordered seed list
  b?: number;
  winner_to?: [string, Slot];
};

const TEMPLATES: Record<number, PlanMatch[]> = {
  2: [
    { key: "f", bracket_type: "grand_final", round_number: 1, position: 1, label: "Final", a: 0, b: 1 },
  ],
  // Seed 1 draws the bye and waits in the final's slot A.
  3: [
    { key: "sf", bracket_type: "upper", round_number: 1, position: 1, label: "Semifinal", a: 1, b: 2, winner_to: ["f", "b"] },
    { key: "f", bracket_type: "grand_final", round_number: 2, position: 1, label: "Final", a: 0 },
  ],
  4: [
    { key: "sf1", bracket_type: "upper", round_number: 1, position: 1, label: "Semifinal 1", a: 0, b: 1, winner_to: ["f", "a"] },
    { key: "sf2", bracket_type: "upper", round_number: 1, position: 2, label: "Semifinal 2", a: 2, b: 3, winner_to: ["f", "b"] },
    { key: "f", bracket_type: "grand_final", round_number: 2, position: 1, label: "Final" },
  ],
};

// ---------------------------------------------------------------------------

const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

async function login(payload: { pin?: string }) {
  // Trimmed on both sides of the comparison. Pasting a PIN into the Supabase
  // dashboard, or setting it with `--env-file`, easily carries a trailing
  // newline; without this the secret can never match and the only symptom is a
  // permanent "Incorrect PIN".
  const adminPin = Deno.env.get("ADMIN_PIN")?.trim();
  const refereePin = Deno.env.get("REFEREE_PIN")?.trim();
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

// A match is one game to 21, so submitting a result by hand is the exception,
// not the rule: bump_score closes the match itself the moment the game is won.
// This path is for a walkover, a retirement or an injury.
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

  return { ok: true };
}

// The score now decides the match, so a mistapped +1 ends it. This is the way
// back: un-route the winner and reopen the match. The scores are left alone —
// a wrong 21-19 is one -1 away from correct once the match is open again.
async function undoResult(payload: { match_id?: string }) {
  const { match_id } = payload;
  if (!match_id) throw new HttpError("match_id is required");

  const { data: match, error } = await db
    .from("matches")
    .select("*")
    .eq("id", match_id)
    .single();
  if (error) throw new HttpError(error.message, 500);
  if (!match.is_complete) throw new HttpError("This match has no result to undo", 409);

  if (match.next_match_winner_id) {
    const { data: next, error: nextError } = await db
      .from("matches")
      .select("id, winner_registration_id")
      .eq("id", match.next_match_winner_id)
      .single();
    if (nextError) throw new HttpError(nextError.message, 500);

    // Once the next match has been played, pulling a player out of it would
    // leave a result that nobody advanced into. Undo that one first.
    if (next.winner_registration_id) {
      throw new HttpError(
        "The next match has already been played. Undo that result first.",
        409,
      );
    }

    const slot = match.next_match_winner_slot === "a"
      ? "registration_a_id"
      : "registration_b_id";
    const { error: clearError } = await db
      .from("matches")
      .update({ [slot]: null })
      .eq("id", next.id);
    if (clearError) throw new HttpError(clearError.message, 500);
  }

  const { error: reopenError } = await db
    .from("matches")
    .update({
      winner_registration_id: null,
      loser_registration_id: null,
      is_complete: false,
    })
    .eq("id", match_id);
  if (reopenError) throw new HttpError(reopenError.message, 500);

  // Reopen the game row too, or bump_score's next write lands on a set the UI
  // still renders as finished.
  const { error: setError } = await db
    .from("match_sets")
    .update({ is_complete: false })
    .eq("match_id", match_id);
  if (setError) throw new HttpError(setError.message, 500);

  return { ok: true };
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

      case "submit_result":
        await requireRole(req, "referee", "admin");
        return json(await submitResult(payload));

      case "undo_result":
        await requireRole(req, "referee", "admin");
        return json(await undoResult(payload));

      default:
        return fail(`Unknown action: ${action}`, 404);
    }
  } catch (e) {
    if (e instanceof HttpError) return fail(e.message, e.status);
    console.error(e);
    return fail(e instanceof Error ? e.message : "Unexpected error", 500);
  }
});
