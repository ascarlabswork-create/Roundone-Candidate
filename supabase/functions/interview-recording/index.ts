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

const RECORDING_BUCKET = "interview-recordings";

function storageConfig(supabaseUrl: string, anonKey: string, authorization: string) {
  const dedicatedEndpoint = Deno.env.get("RECORDING_S3_ENDPOINT") ?? "";
  const dedicatedKey = Deno.env.get("RECORDING_S3_ACCESS_KEY") ?? "";
  const dedicatedSecret = Deno.env.get("RECORDING_S3_SECRET_KEY") ?? "";
  const region = Deno.env.get("RECORDING_S3_REGION") ?? "ap-northeast-1";
  if (dedicatedEndpoint && dedicatedKey && dedicatedSecret) {
    return {
      endpoint: dedicatedEndpoint,
      bucket: Deno.env.get("RECORDING_S3_BUCKET") || RECORDING_BUCKET,
      accessKey: dedicatedKey,
      secret: dedicatedSecret,
      region,
      sessionToken: "",
    };
  }

  let projectRef = "";
  try {
    projectRef = new URL(supabaseUrl).hostname.split(".")[0] ?? "";
  } catch {
    projectRef = "";
  }
  const sessionToken = authorization.replace(/^bearer\s+/i, "").trim();
  if (!projectRef || !anonKey || !sessionToken) return null;
  return {
    endpoint: `https://${projectRef}.storage.supabase.co/storage/v1/s3`,
    bucket: RECORDING_BUCKET,
    accessKey: projectRef,
    secret: anonKey,
    region,
    sessionToken,
  };
}

function recordingPath(sessionId: string, fileName: string) {
  return `interviews/${sessionId}/${fileName}`;
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
  const action = body.action === "start" || body.action === "stop" || body.action === "save" ? body.action : null;
  if (!sessionId || !action) return json(400, { error: "invalid_body" });

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return json(401, { error: "not_authenticated" });

  if (!serviceKey) return json(503, { error: "recording_unconfigured" });
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (action === "save") {
    const { data: saved, error: savedError } = await supabase
      .from("interview_recordings")
      .select("status, storage_path")
      .eq("interview_session_id", sessionId)
      .maybeSingle();
    if (savedError || !saved) return json(404, { error: "not_recording" });
    const storagePath = typeof saved.storage_path === "string" ? saved.storage_path : "";
    const ownedPath = storagePath.startsWith(`interviews/${sessionId}/`) && storagePath.endsWith(".mp4");
    if (saved.status !== "stopped" || !ownedPath) return json(409, { error: "recording_processing" });
    const folder = `interviews/${sessionId}`;
    const fileName = storagePath.slice(folder.length + 1);
    const listed = await admin.storage.from(RECORDING_BUCKET).list(folder, { search: fileName, limit: 20 });
    const ready = listed.data?.some((item) => item.name === fileName);
    if (listed.error || !ready) return json(409, { error: "recording_processing" });
    const signed = await admin.storage.from(RECORDING_BUCKET).createSignedUrl(storagePath, 120, {
      download: "interview-recording.mp4",
    });
    if (signed.error || !signed.data?.signedUrl) return json(502, { error: "recording_failed" });
    return json(200, { status: "stopped", storage_path: storagePath, download_url: signed.data.signedUrl });
  }

  if (action === "stop") {
    const { data: current, error: currentError } = await supabase
      .from("interview_recordings")
      .select("status, egress_id, storage_path")
      .eq("interview_session_id", sessionId)
      .maybeSingle();
    if (currentError || !current) return json(404, { error: "not_recording" });
    if (current.status !== "recording" || typeof current.egress_id !== "string" || !current.egress_id) {
      return json(409, { error: "not_recording" });
    }
    if (!livekitUrl.startsWith("http") || !livekitKey || !livekitSecret) {
      return json(503, { error: "recording_unconfigured" });
    }
    try {
      await new EgressClient(livekitUrl, livekitKey, livekitSecret).stopEgress(current.egress_id);
    } catch {
      console.log(JSON.stringify({ event: "interview_recording_stop_failed", session_id: sessionId }));
      return json(502, { error: "recording_failed" });
    }
    const { error: stopError } = await admin
      .from("interview_recordings")
      .update({ status: "stopped", stopped_at: new Date().toISOString() })
      .eq("interview_session_id", sessionId);
    if (stopError) return json(500, { error: "recording_failed" });
    return json(200, { status: "stopped", storage_path: current.storage_path ?? null });
  }

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

  const storage = storageConfig(supabaseUrl, anonKey, authorization);
  if (!livekitUrl.startsWith("http") || !livekitKey || !livekitSecret || !storage) {
    console.log(JSON.stringify({ event: "interview_recording_unconfigured" }));
    return json(503, { error: "recording_unconfigured" });
  }
  const { data: existing, error: existingError } = await admin
    .from("interview_recordings")
    .select("status, egress_id, storage_path")
    .eq("interview_session_id", sessionId)
    .maybeSingle();
  if (existingError) return json(500, { error: "recording_failed" });

  const egress = new EgressClient(livekitUrl, livekitKey, livekitSecret);

  if (action === "start") {
    if (existing?.status === "recording" && existing.egress_id) {
      return json(200, { status: "recording", storage_path: existing.storage_path ?? null });
    }
    const storagePath = recordingPath(sessionId, `${crypto.randomUUID()}.mp4`);
    try {
      const output = new EncodedFileOutput({
        fileType: EncodedFileType.MP4,
        filepath: storagePath,
        disableManifest: true,
        output: {
          case: "s3",
          value: new S3Upload({
            accessKey: storage.accessKey,
            secret: storage.secret,
            sessionToken: storage.sessionToken || undefined,
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
          storage_path: storagePath,
          started_at: new Date().toISOString(),
          stopped_at: null,
        },
        { onConflict: "interview_session_id" },
      );
      if (writeError) {
        if (info.egressId) await egress.stopEgress(info.egressId).catch(() => undefined);
        return json(500, { error: "recording_failed" });
      }
      return json(200, { status: "recording", storage_path: storagePath });
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

  return json(400, { error: "invalid_body" });
});
