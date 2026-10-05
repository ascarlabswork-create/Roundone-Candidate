import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { AccessToken } from "npm:livekit-server-sdk@2.13.3";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TOKEN_TTL_SECONDS = 60 * 60;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function livekitSocketUrl(value: string) {
  const url = value.trim().replace(/\/+$/, "");
  if (url.startsWith("https://")) return `wss://${url.slice("https://".length)}`;
  if (url.startsWith("http://")) return `ws://${url.slice("http://".length)}`;
  return url;
}

function readUuid(value: unknown) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)
    ? text
    : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const livekitUrl = livekitSocketUrl(Deno.env.get("LIVEKIT_URL") ?? "");
  const livekitKey = Deno.env.get("LIVEKIT_API_KEY") ?? "";
  const livekitSecret = Deno.env.get("LIVEKIT_API_SECRET") ?? "";
  const authorization = req.headers.get("Authorization") ?? "";

  if (!supabaseUrl || !anonKey || !authorization.toLowerCase().startsWith("bearer ")) {
    return json(401, { error: "not_authenticated" });
  }
  const socketUrlReady = livekitUrl.startsWith("wss://") || livekitUrl.startsWith("ws://");
  if (!socketUrlReady || !livekitKey || !livekitSecret) {
    console.log(JSON.stringify({ event: "interview_token_unconfigured" }));
    return json(503, { error: "unconfigured" });
  }

  let body: Record<string, unknown>;
  try {
    const parsed = asRecord(await req.json());
    if (!parsed) throw new Error("invalid_body");
    body = parsed;
  } catch {
    return json(400, { error: "invalid_body" });
  }

  const bookingId = readUuid(body.booking_id ?? body.bookingId);
  const sessionId = readUuid(body.interview_session_id ?? body.interviewSessionId ?? body.session_id);
  if (!bookingId && !sessionId) return json(400, { error: "invalid_body" });

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return json(401, { error: "not_authenticated" });

  const { data, error } = await supabase.rpc("prepare_interview_call", {
    p_booking_id: bookingId,
    p_session_id: sessionId,
  });
  // Server clock: now() must be in [starts_at - 15 minutes, starts_at + 15 minutes],
  // the booking confirmed or in progress, and this auth user a participant.
  if (error || !data) {
    const message = error?.message ?? "not_authorized";
    const status = message.includes("not_authenticated") ? 401 : 403;
    console.log(JSON.stringify({ event: "interview_token_denied" }));
    return json(status, { error: message.includes("join_window_closed")
      ? "JOIN_WINDOW_CLOSED"
      : message.includes("interview_not_started")
      ? "INTERVIEW_NOT_STARTED"
      : message.includes("booking_not_confirmed")
      ? "booking_not_confirmed"
      : message.includes("session_expired")
      ? "session_expired"
      : message.includes("session_not_found") || message.includes("booking_not_found")
      ? "session_not_found"
      : "not_authorized" });
  }

  const access = asRecord(data);
  const roomName = typeof access?.room_name === "string" ? access.room_name : "";
  const identity = typeof access?.participant_identity === "string" ? access.participant_identity : "";
  const role = access?.role === "interviewer" ? "interviewer" : access?.role === "candidate" ? "candidate" : "";
  if (!roomName.startsWith("roundone-interview-") || !identity || !role) {
    return json(403, { error: "not_authorized" });
  }
  if (identity !== `${role}:${userData.user.id}`) {
    return json(403, { error: "not_authorized" });
  }

  const token = new AccessToken(livekitKey, livekitSecret, {
    identity,
    ttl: TOKEN_TTL_SECONDS,
  });
  token.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: false,
  });
  const jwt = await token.toJwt();

  console.log(JSON.stringify({
    event: "interview_token_ok",
    role,
    room_name: roomName,
  }));

  return json(200, {
    livekit_url: livekitUrl,
    token: jwt,
    room_name: roomName,
    participant_identity: identity,
  });
});
