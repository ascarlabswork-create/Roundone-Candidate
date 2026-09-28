import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { extractJobFromHtml, extractJobFromManual, groundAnalysis, UNREADABLE_JOB_MESSAGE, type ExtractedJob } from "./extract.ts";
import { JobFetchError, fetchPublicJobPage } from "./fetchPage.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

async function requireCandidate(req: Request) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const authorization = req.headers.get("Authorization") ?? "";
  if (!supabaseUrl || !anonKey || !authorization.toLowerCase().startsWith("bearer ")) {
    return json(401, { error: "not_authenticated" });
  }
  const headers = { Authorization: authorization, apikey: anonKey };
  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, { headers });
  if (!userResponse.ok) return json(401, { error: "not_authenticated" });
  const user = asRecord(await userResponse.json());
  const userId = typeof user?.id === "string" ? user.id : "";
  if (!userId) return json(401, { error: "not_authenticated" });
  const profileResponse = await fetch(
    `${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=role`,
    { headers: { ...headers, Accept: "application/json" } },
  );
  if (!profileResponse.ok) return json(403, { error: "not_a_candidate" });
  const profiles = await profileResponse.json();
  const role = Array.isArray(profiles) ? profiles[0]?.role : null;
  if (role !== "candidate") return json(403, { error: "not_a_candidate" });
  return null;
}

async function maybeGround(job: ExtractedJob, sourceText: string) {
  if (job.company_name && job.job_title && job.skills.length > 0) return job;
  const apiKey = Deno.env.get("MATCHING_AI_API_KEY") ?? "";
  const model = Deno.env.get("MATCHING_AI_MODEL") ?? "gpt-4o-mini";
  const baseUrl = (Deno.env.get("MATCHING_AI_BASE_URL") ?? "https://api.openai.com/v1").replace(/\/$/, "");
  if (!apiKey || !sourceText.trim()) return job;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: [
              "Extract only facts present in the job text.",
              "Do not invent companies, skills, technologies, certifications, or years of experience.",
              "Return JSON with company_name, job_title, job_id, description, skills.",
              "skills must be explicit requirements copied from the text.",
              "Do not add soft skills such as communication or team player.",
            ].join(" "),
          },
          { role: "user", content: sourceText.slice(0, 12000) },
        ],
      }),
    });
    if (!response.ok) return job;
    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;
    const parsed = typeof content === "string" ? JSON.parse(content) : content;
    const row = asRecord(parsed);
    if (!row) return job;
    return groundAnalysis(job, row, sourceText);
  } catch {
    return job;
  } finally {
    clearTimeout(timer);
  }
}

function publicJob(job: ExtractedJob) {
  return {
    company_name: job.company_name,
    job_title: job.job_title,
    job_id: job.job_id,
    description: job.description,
    skills: job.skills,
    source_url: job.source_url,
    source_type: job.source_type,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const authError = await requireCandidate(req);
  if (authError) return authError;

  let body: Record<string, unknown>;
  try {
    const parsed = asRecord(await req.json());
    if (!parsed) throw new Error("invalid");
    body = parsed;
  } catch {
    return json(400, { error: "invalid_body" });
  }

  const mode = typeof body.mode === "string" ? body.mode : "url";
  const jobId = typeof body.job_id === "string" ? body.job_id.trim().slice(0, 80) : "";

  if (mode === "manual") {
    const description = typeof body.description === "string" ? body.description.trim() : "";
    if (description.length < 20) {
      return json(400, { error: "invalid_body", message: "Paste a job description to continue." });
    }
    const extracted = extractJobFromManual(description, jobId || null);
    const grounded = await maybeGround(extracted, description);
    return json(200, publicJob(grounded));
  }

  const rawUrl = typeof body.url === "string" ? body.url.trim() : "";
  if (!rawUrl) return json(400, { error: "invalid_url", message: "Enter a public job URL." });

  try {
    const page = await fetchPublicJobPage(rawUrl);
    const extracted = extractJobFromHtml(page.html, page.url, jobId || null);
    const grounded = await maybeGround(extracted, extracted.description ?? "");
    return json(200, publicJob({ ...grounded, source_url: page.url, source_type: "url" }));
  } catch (error) {
    if (error instanceof JobFetchError && (error.reason === "invalid_url" || error.reason === "unsupported_url")) {
      return json(400, {
        error: error.reason,
        message: error.reason === "invalid_url" ? "Enter a valid public http(s) job URL." : "That URL cannot be used.",
      });
    }
    return json(422, { error: "unreadable", message: UNREADABLE_JOB_MESSAGE });
  }
});
