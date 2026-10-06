import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  EgressClient,
  EncodedFileOutput,
  EncodedFileType,
  S3Upload,
} from "npm:livekit-server-sdk@2.13.3";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

function readUuid(value: unknown) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)
    ? text
    : null;
}

function livekitHttpUrl(value: string) {
  const url = value.trim().replace(/\/+$/, "");
  if (url.startsWith("wss://")) return `https://${url.slice("wss://".length)}`;
  if (url.startsWith("ws://")) return `http://${url.slice("ws://".length)}`;
  return url;
}

function storageConfig() {
  const endpoint = Deno.env.get("RECORDING_S3_ENDPOINT") ?? "";
  const bucket = Deno.env.get("RECORDING_S3_BUCKET") ?? "";
  const accessKey = Deno.env.get("RECORDING_S3_ACCESS_KEY") ?? "";
  const secret = Deno.env.get("RECORDING_S3_SECRET_KEY") ?? "";
  const region = Deno.env.get("RECORDING_S3_REGION") ?? "us-east-1";
  if (!endpoint || !bucket || !accessKey || !secret) return null;
  return { endpoint, bucket, accessKey, secret, region };
}

function errorCode(error: { message?: string }) {
  const message = error.message ?? "";
  if (message.includes("not_authenticated")) return "not_authenticated";
  if (message.includes("not_authorized")) return "not_authorized";
  if (message.includes("booking_not_confirmed")) return "booking_not_confirmed";
  if (message.includes("session_expired")) return "session_expired";
  if (message.includes("session_not_found")) return "session_not_found";
  if (message.includes("invalid_payload")) return "invalid_body";
  return "recording_failed";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const livekitUrl = livekitHttpUrl(Deno.env.get("LIVEKIT_URL") ?? "");
  const livekitKey = Deno.env.get("LIVEKIT_API_KEY") ?? "";
  const livekitSecret = Deno.env.get("LIVEKIT_API_SECRET") ?? "";
  const authorization = req.headers.get("Authorization") ?? "";

  if (!supabaseUrl || !anonKey || !authorization.toLowerCase().startsWith("bearer ")) {
    return json(401, { error: "not_authenticated" });
  }

  let body: Record<string, unknown>;
  try {
    const parsed = asRecord(await req.json());
    if (!parsed) throw new Error("invalid_body");
    body = parsed;
  } catch {
    return json(400, { error: "invalid_body" });
  }

  const sessionId = readUuid(body.interview_session_id ?? body.interviewSessionId ?? body.session_id);
  const action = body.action === "start" || body.action === "stop" ? body.action : null;
  if (!sessionId || !action) return json(400, { error: "invalid_body" });

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return json(401, { error: "not_authenticated" });

  const { data: access, error: accessError } = await supabase.rpc("assert_interview_recording_access", {
    p_session_id: sessionId,
  });
  if (accessError) {
    const code = errorCode(accessError);
    const status = code === "not_authenticated" ? 401 : code === "recording_failed" ? 500 : 403;
    return json(status, { error: code });
  }
  const accessRow = asRecord(access);
  const roomName = typeof accessRow?.room_name === "string" ? accessRow.room_name : "";
  if (!roomName.startsWith("roundone-interview-")) return json(403, { error: "not_authorized" });

  if (!serviceKey || !livekitUrl.startsWith("http") || !livekitKey || !livekitSecret || !storageConfig()) {
    console.log(JSON.stringify({ event: "interview_recording_unconfigured" }));
    return json(503, { error: "recording_unconfigured" });
  }
  const storage = storageConfig()!;

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: existing, error: existingError } = await admin
    .from("interview_recordings")
    .select("status, egress_id")
    .eq("interview_session_id", sessionId)
    .maybeSingle();
  if (existingError) return json(500, { error: "recording_failed" });

  const egress = new EgressClient(livekitUrl, livekitKey, livekitSecret);

  if (action === "start") {
    if (existing?.status === "recording" && existing.egress_id) {
      return json(200, { status: "recording" });
    }
    try {
      const output = new EncodedFileOutput({
        fileType: EncodedFileType.MP4,
        filepath: `interviews/${sessionId}/${crypto.randomUUID()}.mp4`,
        output: {
          case: "s3",
          value: new S3Upload({
            accessKey: storage.accessKey,
            secret: storage.secret,
            bucket: storage.bucket,
            region: storage.region,
            endpoint: storage.endpoint,
            forcePathStyle: true,
          }),
        },
      });
      const info = await egress.startRoomCompositeEgress(roomName, output, { layout: "grid" });
      const { error: writeError } = await admin.from("interview_recordings").upsert(
        {
          interview_session_id: sessionId,
          started_by: userData.user.id,
          status: "recording",
          egress_id: info.egressId,
          started_at: new Date().toISOString(),
          stopped_at: null,
        },
        { onConflict: "interview_session_id" },
      );
      if (writeError) {
        if (info.egressId) await egress.stopEgress(info.egressId).catch(() => undefined);
        return json(500, { error: "recording_failed" });
      }
      return json(200, { status: "recording" });
    } catch {
      console.log(JSON.stringify({ event: "interview_recording_start_failed", session_id: sessionId }));
      await admin.from("interview_recordings").upsert(
        {
          interview_session_id: sessionId,
          started_by: userData.user.id,
          status: "failed",
          egress_id: null,
          stopped_at: new Date().toISOString(),
        },
        { onConflict: "interview_session_id" },
      );
      return json(502, { error: "recording_failed" });
    }
  }

  if (existing?.status !== "recording" || !existing.egress_id) {
    return json(409, { error: "not_recording" });
  }
  try {
    await egress.stopEgress(existing.egress_id);
  } catch {
    console.log(JSON.stringify({ event: "interview_recording_stop_failed", session_id: sessionId }));
    return json(502, { error: "recording_failed" });
  }
  const { error: stopError } = await admin
    .from("interview_recordings")
    .update({ status: "stopped", stopped_at: new Date().toISOString() })
    .eq("interview_session_id", sessionId);
  if (stopError) return json(500, { error: "recording_failed" });
  return json(200, { status: "stopped" });
});
