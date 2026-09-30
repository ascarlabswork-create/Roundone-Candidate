import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { n8nEmailPayload, type N8nEmailPayload } from "./emailPayload.ts";

const MAX_BODY_BYTES = 16_384;
const MAX_CLAIM_LIMIT = 50;
const MAX_ERROR_LEN = 500;
const MAX_PROVIDER_MESSAGE_ID_LEN = 200;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type WorkerAction = "claim" | "mark_sent" | "mark_delivered" | "mark_failed";

type ClaimRow = {
  delivery_id: string;
  notification_id: string;
  channel: string;
  status: string;
  attempts: number;
  notification_kind: string;
  notification_title: string;
  notification_body: string;
  booking_id: string | null;
  recipient: string;
  deep_link_path: string | null;
  booking_starts_at: string | null;
  booking_ends_at: string | null;
  booking_display_timezone: string | null;
  booking_duration_min: number | null;
  booking_mode: string | null;
  booking_status: string | null;
  service_name: string | null;
  interview_type: string | null;
  counterparty_display_name: string | null;
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

function readAction(value: unknown): WorkerAction | null {
  if (typeof value !== "string") return null;
  const action = value.trim().toLowerCase();
  if (
    action === "claim" ||
    action === "mark_sent" ||
    action === "mark_delivered" ||
    action === "mark_failed"
  ) {
    return action;
  }
  return null;
}

function readClaimLimit(value: unknown): number | null {
  if (value === undefined || value === null) return 10;
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (!Number.isInteger(value) || value < 1) return null;
  if (value > MAX_CLAIM_LIMIT) return null;
  return value;
}

function sanitizeError(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim().replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, MAX_ERROR_LEN);
  return cleaned.length > 0 ? cleaned : null;
}

function sanitizeProviderMessageId(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return null;
  const cleaned = value.trim().slice(0, MAX_PROVIDER_MESSAGE_ID_LEN);
  if (!cleaned) return null;
  if (!/^[A-Za-z0-9._:-]+$/.test(cleaned)) return null;
  return cleaned;
}

function extractBearer(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) return null;
  const token = match[1].trim();
  return token.length > 0 ? token : null;
}

async function timingSafeEqualString(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  const aa = new Uint8Array(ha);
  const bb = new Uint8Array(hb);
  if (aa.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < aa.length; i++) diff |= aa[i] ^ bb[i];
  return diff === 0;
}

async function authorizeWorker(req: Request): Promise<Response | null> {
  const expected = Deno.env.get("NOTIFICATION_WORKER_SECRET") ?? "";
  if (!expected) {
    console.log(JSON.stringify({ event: "notification_worker_unconfigured" }));
    return json(503, { error: "unconfigured" });
  }

  const provided = extractBearer(req);
  if (!provided) {
    console.log(JSON.stringify({ event: "notification_worker_unauthorized", reason: "missing" }));
    return json(401, { error: "unauthorized" });
  }

  const ok = await timingSafeEqualString(provided, expected);
  if (!ok) {
    console.log(JSON.stringify({ event: "notification_worker_unauthorized", reason: "invalid" }));
    return json(401, { error: "unauthorized" });
  }

  return null;
}

function createServiceClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !key) {
    throw new Error("missing_supabase_env");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function mapClaimRow(row: Record<string, unknown>): ClaimRow {
  return {
    delivery_id: String(row.delivery_id),
    notification_id: String(row.notification_id),
    channel: String(row.channel),
    status: String(row.status),
    attempts: Number(row.attempts),
    notification_kind: String(row.notification_kind ?? ""),
    notification_title: String(row.notification_title ?? ""),
    notification_body: String(row.notification_body ?? ""),
    booking_id: row.booking_id == null ? null : String(row.booking_id),
    recipient: String(row.recipient ?? ""),
    deep_link_path: row.deep_link_path == null ? null : String(row.deep_link_path),
    booking_starts_at: row.booking_starts_at == null ? null : String(row.booking_starts_at),
    booking_ends_at: row.booking_ends_at == null ? null : String(row.booking_ends_at),
    booking_display_timezone: row.booking_display_timezone == null
      ? null
      : String(row.booking_display_timezone),
    booking_duration_min: row.booking_duration_min == null
      ? null
      : Number(row.booking_duration_min),
    booking_mode: row.booking_mode == null ? null : String(row.booking_mode),
    booking_status: row.booking_status == null ? null : String(row.booking_status),
    service_name: row.service_name == null ? null : String(row.service_name),
    interview_type: row.interview_type == null ? null : String(row.interview_type),
    counterparty_display_name: row.counterparty_display_name == null
      ? null
      : String(row.counterparty_display_name),
  };
}

async function getDelivery(
  supabase: SupabaseClient,
  deliveryId: string,
): Promise<{ id: string; status: string } | null> {
  const { data, error } = await supabase
    .from("notification_deliveries")
    .select("id, status")
    .eq("id", deliveryId)
    .maybeSingle();

  if (error) {
    console.log(JSON.stringify({
      event: "notification_worker_db_error",
      action: "get_delivery",
      category: "select_failed",
    }));
    throw new Error("db_error");
  }

  if (!data) return null;
  return { id: String(data.id), status: String(data.status) };
}

async function handleClaim(supabase: SupabaseClient, body: Record<string, unknown>) {
  const limit = readClaimLimit(body.limit);
  if (limit == null) {
    return json(400, { error: "invalid_limit" });
  }

  const { data, error } = await supabase.rpc("claim_notification_deliveries", {
    p_limit: limit,
  });

  if (error) {
    console.log(JSON.stringify({
      event: "notification_worker_db_error",
      action: "claim",
      category: "rpc_failed",
    }));
    return json(500, { error: "server_error" });
  }

  const rows = Array.isArray(data) ? data : [];
  const deliveries = rows
    .map((item) => asRecord(item))
    .filter((item): item is Record<string, unknown> => item != null)
    .map(mapClaimRow);

  const published = [];
  for (const row of deliveries) {
    const email = n8nEmailPayload({
      deliveryId: row.delivery_id,
      notificationId: row.notification_id,
      channel: row.channel,
      recipient: row.recipient,
      eventKind: row.notification_kind,
      title: row.notification_title,
      bookingId: row.booking_id,
      deepLinkPath: row.deep_link_path,
    });
    let status = row.status;
    if (row.channel === "email") {
      status = await forwardEmailDelivery(supabase, email);
    }
    published.push({
      ...row,
      recipient: email.recipient,
      subject: email.subject,
      event_kind: email.event_kind,
      deep_link_path: email.deep_link_path,
      status,
    });
  }

  console.log(JSON.stringify({
    event: "notification_worker_claim_ok",
    action: "claim",
    claimed: published.length,
    delivery_ids: published.map((d) => d.delivery_id),
  }));

  return json(200, { deliveries: published });
}

async function forwardEmailDelivery(
  supabase: SupabaseClient,
  payload: N8nEmailPayload,
): Promise<string> {
  const url = Deno.env.get("N8N_NOTIFICATION_WEBHOOK_URL") ?? "";
  const secret = Deno.env.get("N8N_NOTIFICATION_WEBHOOK_SECRET") ?? "";
  if (!url || !secret) {
    console.log(JSON.stringify({
      event: "notification_worker_n8n_unconfigured",
      delivery_id: payload.delivery_id,
    }));
    return "processing";
  }

  let webhook: URL;
  try {
    webhook = new URL(url);
  } catch {
    await markEmailFailure(supabase, payload.delivery_id, "n8n webhook url is invalid", false);
    return "failed";
  }
  if (webhook.protocol !== "https:") {
    await markEmailFailure(supabase, payload.delivery_id, "n8n webhook url must be https", false);
    return "failed";
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(webhook.toString(), {
      method: "POST",
      redirect: "manual",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify(payload),
    });
    if (response.status >= 300 && response.status < 400) {
      await markEmailFailure(supabase, payload.delivery_id, "n8n webhook redirected", true);
      return "pending";
    }
    if (!response.ok) {
      const retryable = response.status === 429 || response.status >= 500;
      await markEmailFailure(
        supabase,
        payload.delivery_id,
        `n8n webhook failed (${response.status})`,
        retryable,
      );
      return retryable ? "pending" : "failed";
    }

    let providerMessageId: string | null = null;
    try {
      const body = asRecord(await response.json());
      const rawId = body?.provider_message_id ?? body?.id;
      providerMessageId = sanitizeProviderMessageId(rawId);
    } catch {
      providerMessageId = null;
    }

    const { error } = await supabase.rpc("mark_notification_delivery_sent", {
      p_delivery_id: payload.delivery_id,
      p_provider_message_id: providerMessageId,
    });
    if (error) {
      console.log(JSON.stringify({
        event: "notification_worker_db_error",
        action: "mark_sent",
        category: "rpc_failed",
        delivery_id: payload.delivery_id,
      }));
      return "processing";
    }
    return "sent";
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "AbortError";
    await markEmailFailure(
      supabase,
      payload.delivery_id,
      timedOut ? "n8n webhook timed out" : "n8n webhook request failed",
      true,
    );
    return "pending";
  } finally {
    clearTimeout(timer);
  }
}

async function markEmailFailure(
  supabase: SupabaseClient,
  deliveryId: string,
  message: string,
  retryable: boolean,
) {
  const { error } = await supabase.rpc("mark_notification_delivery_failed", {
    p_delivery_id: deliveryId,
    p_error: message,
    p_retryable: retryable,
  });
  if (error) {
    console.log(JSON.stringify({
      event: "notification_worker_db_error",
      action: "mark_failed",
      category: "rpc_failed",
      delivery_id: deliveryId,
    }));
  }
}

async function handleMarkSent(supabase: SupabaseClient, body: Record<string, unknown>) {
  if (!isUuid(body.delivery_id)) {
    return json(400, { error: "invalid_delivery_id" });
  }

  let providerMessageId: string | null = null;
  if (body.provider_message_id !== undefined && body.provider_message_id !== null) {
    providerMessageId = sanitizeProviderMessageId(body.provider_message_id);
    if (providerMessageId == null) {
      return json(400, { error: "invalid_provider_message_id" });
    }
  }

  const before = await getDelivery(supabase, body.delivery_id);
  if (!before) return json(404, { error: "delivery_not_found" });
  if (before.status !== "processing") {
    return json(409, { error: "invalid_state", status: before.status });
  }

  const { error } = await supabase.rpc("mark_notification_delivery_sent", {
    p_delivery_id: body.delivery_id,
    p_provider_message_id: providerMessageId,
  });

  if (error) {
    console.log(JSON.stringify({
      event: "notification_worker_db_error",
      action: "mark_sent",
      category: "rpc_failed",
    }));
    return json(500, { error: "server_error" });
  }

  const after = await getDelivery(supabase, body.delivery_id);
  if (!after || after.status !== "sent") {
    return json(409, { error: "invalid_state", status: after?.status ?? null });
  }

  console.log(JSON.stringify({
    event: "notification_worker_mark_ok",
    action: "mark_sent",
    delivery_id: body.delivery_id,
  }));

  return json(200, { ok: true, delivery_id: body.delivery_id, status: "sent" });
}

async function handleMarkDelivered(supabase: SupabaseClient, body: Record<string, unknown>) {
  if (!isUuid(body.delivery_id)) {
    return json(400, { error: "invalid_delivery_id" });
  }

  const before = await getDelivery(supabase, body.delivery_id);
  if (!before) return json(404, { error: "delivery_not_found" });
  if (before.status !== "processing" && before.status !== "sent") {
    return json(409, { error: "invalid_state", status: before.status });
  }

  const { error } = await supabase.rpc("mark_notification_delivery_delivered", {
    p_delivery_id: body.delivery_id,
  });

  if (error) {
    console.log(JSON.stringify({
      event: "notification_worker_db_error",
      action: "mark_delivered",
      category: "rpc_failed",
    }));
    return json(500, { error: "server_error" });
  }

  const after = await getDelivery(supabase, body.delivery_id);
  if (!after || after.status !== "delivered") {
    return json(409, { error: "invalid_state", status: after?.status ?? null });
  }

  console.log(JSON.stringify({
    event: "notification_worker_mark_ok",
    action: "mark_delivered",
    delivery_id: body.delivery_id,
  }));

  return json(200, { ok: true, delivery_id: body.delivery_id, status: "delivered" });
}

async function handleMarkFailed(supabase: SupabaseClient, body: Record<string, unknown>) {
  if (!isUuid(body.delivery_id)) {
    return json(400, { error: "invalid_delivery_id" });
  }

  const errorText = sanitizeError(body.error);
  if (!errorText) {
    return json(400, { error: "invalid_error" });
  }

  if (typeof body.retryable !== "boolean" && body.retryable !== undefined) {
    return json(400, { error: "invalid_retryable" });
  }
  const retryable = body.retryable === true;

  const before = await getDelivery(supabase, body.delivery_id);
  if (!before) return json(404, { error: "delivery_not_found" });
  if (before.status !== "processing") {
    return json(409, { error: "invalid_state", status: before.status });
  }

  const { error } = await supabase.rpc("mark_notification_delivery_failed", {
    p_delivery_id: body.delivery_id,
    p_error: errorText,
    p_retryable: retryable,
  });

  if (error) {
    console.log(JSON.stringify({
      event: "notification_worker_db_error",
      action: "mark_failed",
      category: "rpc_failed",
    }));
    return json(500, { error: "server_error" });
  }

  const after = await getDelivery(supabase, body.delivery_id);
  if (!after || (after.status !== "failed" && after.status !== "pending")) {
    return json(409, { error: "invalid_state", status: after?.status ?? null });
  }

  console.log(JSON.stringify({
    event: "notification_worker_mark_ok",
    action: "mark_failed",
    delivery_id: body.delivery_id,
    status: after.status,
    retryable,
  }));

  return json(200, {
    ok: true,
    delivery_id: body.delivery_id,
    status: after.status,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  if (req.method !== "POST") {
    return json(405, { error: "method_not_allowed" });
  }

  const authError = await authorizeWorker(req);
  if (authError) return authError;

  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return json(400, { error: "payload_too_large" });
  }

  let body: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) {
      return json(400, { error: "payload_too_large" });
    }
    const parsed = asRecord(JSON.parse(raw));
    if (!parsed) throw new Error("invalid_body");
    body = parsed;
  } catch {
    console.log(JSON.stringify({ event: "notification_worker_invalid_body" }));
    return json(400, { error: "invalid_body" });
  }

  const action = readAction(body.action);
  if (!action) {
    return json(400, { error: "invalid_action" });
  }

  let supabase: SupabaseClient;
  try {
    supabase = createServiceClient();
  } catch {
    console.log(JSON.stringify({ event: "notification_worker_missing_env" }));
    return json(500, { error: "server_error" });
  }

  try {
    if (action === "claim") return await handleClaim(supabase, body);
    if (action === "mark_sent") return await handleMarkSent(supabase, body);
    if (action === "mark_delivered") return await handleMarkDelivered(supabase, body);
    return await handleMarkFailed(supabase, body);
  } catch {
    console.log(JSON.stringify({
      event: "notification_worker_unexpected",
      action,
    }));
    return json(500, { error: "server_error" });
  }
});
