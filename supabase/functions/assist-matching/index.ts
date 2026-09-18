import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_CANDIDATES = 8;
const MAX_SERVICES = 4;
const BANNED =
  /\b(guaranteed|perfect match|best interviewer|definitely (help you )?get hired|will get you hired)\b/i;

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

function readString(value: unknown, max = 200) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function readStringList(value: unknown, maxItems = 12, maxLen = 40) {
  if (!Array.isArray(value)) return [];
  const result: string[] = [];
  for (const item of value) {
    const text = readString(item, maxLen);
    if (!text) continue;
    if (result.some((existing) => existing.toLowerCase() === text.toLowerCase())) continue;
    result.push(text);
    if (result.length >= maxItems) break;
  }
  return result;
}

function extractJson(text: string) {
  const trimmed = text.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(trimmed.slice(start, end + 1));
  } catch {
    return null;
  }
}

function uniqueVocab(values: unknown, maxItems: number, maxLen: number) {
  return readStringList(values, maxItems, maxLen);
}

function matchVocab(value: string, vocabulary: string[]) {
  const needle = value.trim().toLowerCase();
  if (!needle) return "";
  return vocabulary.find((item) => item.toLowerCase() === needle) ?? "";
}

function readConfidence(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1 ? value : null;
}

function groundedField(value: unknown, vocabulary: string[], maxLen: number) {
  const row = asRecord(value);
  if (!row) return null;
  const canonical = matchVocab(readString(row.value, maxLen), vocabulary);
  const confidence = readConfidence(row.confidence);
  if (!canonical || confidence == null) return null;
  return { value: canonical, confidence };
}

async function completeJson(
  apiKey: string,
  model: string,
  baseUrl: string,
  system: string,
  payload: unknown,
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: JSON.stringify(payload) },
        ],
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      console.log(JSON.stringify({ event: "matching_ai_provider_error", status: response.status }));
      return json(502, { error: "provider_error" });
    }
    const raw = await response.json();
    const content = raw?.choices?.[0]?.message?.content;
    const parsedJson = typeof content === "string" ? extractJson(content) : asRecord(content);
    const row = asRecord(parsedJson);
    if (!row) {
      console.log(JSON.stringify({ event: "matching_ai_malformed_json" }));
      return json(502, { error: "malformed_json" });
    }
    return row;
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    console.log(JSON.stringify({ event: aborted ? "matching_ai_timeout" : "matching_ai_failure" }));
    return json(502, { error: aborted ? "timeout" : "provider_error" });
  } finally {
    clearTimeout(timer);
  }
}

async function handleNormalize(
  body: Record<string, unknown>,
  apiKey: string,
  model: string,
  baseUrl: string,
) {
  const inputRow = asRecord(body.input) ?? {};
  const vocabRow = asRecord(body.vocabulary) ?? {};
  const input = {
    targetRole: readString(inputRow.targetRole ?? inputRow.target_role, 80),
    candidateLevel: readString(inputRow.candidateLevel ?? inputRow.candidate_level, 40),
    skills: readStringList(inputRow.skills, 12, 40),
    interviewType: readString(inputRow.interviewType ?? inputRow.interview_type, 60),
    targetCompany: readString(inputRow.targetCompany ?? inputRow.target_company, 80),
    intent: readString(inputRow.intent, 280),
  };
  if (
    !input.targetRole &&
    !input.candidateLevel &&
    input.skills.length === 0 &&
    !input.interviewType &&
    !input.targetCompany &&
    !input.intent
  ) {
    return json(400, { error: "invalid_body" });
  }

  const vocabulary = {
    roles: uniqueVocab(vocabRow.roles, 150, 80),
    skills: uniqueVocab(vocabRow.skills, 200, 40),
    interviewTypes: uniqueVocab(vocabRow.interviewTypes ?? vocabRow.interview_types, 40, 60),
    candidateLevels: uniqueVocab(vocabRow.candidateLevels ?? vocabRow.candidate_levels, 30, 40),
    companies: uniqueVocab(vocabRow.companies, 80, 80),
  };

  const system = [
    "You normalize RoundOne candidate interview preferences.",
    "Map free-form input onto the provided vocabulary only.",
    "Never invent roles, skills, interview types, levels, or companies that are not in the vocabulary.",
    "Never invent interviewer skills, experience, reviews, prices, services, availability, or candidate qualifications.",
    "Do not use hiring outcome claims.",
    "If nothing in the vocabulary fits a field, return null for that field.",
    "Return JSON only with keys target_role, candidate_level, skills, interview_type, target_company.",
    "Each object is { value, confidence } where confidence is 0 to 1.",
    "skills is an array of those objects.",
    "Use the exact vocabulary spelling.",
  ].join(" ");

  const completed = await completeJson(apiKey, model, baseUrl, system, { input, vocabulary });
  if (completed instanceof Response) return completed;

  const skillsRaw = Array.isArray(completed.skills) ? completed.skills : [];
  const skills = [];
  for (const item of skillsRaw) {
    const parsed = groundedField(item, vocabulary.skills, 40);
    if (!parsed) continue;
    if (skills.some((existing) => existing.value.toLowerCase() === parsed.value.toLowerCase())) continue;
    skills.push(parsed);
    if (skills.length >= 8) break;
  }

  console.log(JSON.stringify({
    event: "normalization_ai_ok",
    skillCount: skills.length,
    hasRole: Boolean(groundedField(completed.target_role ?? completed.targetRole, vocabulary.roles, 80)),
  }));

  return json(200, {
    target_role: groundedField(completed.target_role ?? completed.targetRole, vocabulary.roles, 80),
    candidate_level: groundedField(
      completed.candidate_level ?? completed.candidateLevel,
      vocabulary.candidateLevels,
      40,
    ),
    skills,
    interview_type: groundedField(
      completed.interview_type ?? completed.interviewType,
      vocabulary.interviewTypes,
      60,
    ),
    target_company: groundedField(
      completed.target_company ?? completed.targetCompany,
      vocabulary.companies,
      80,
    ),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const apiKey = Deno.env.get("MATCHING_AI_API_KEY") ?? "";
  const model = Deno.env.get("MATCHING_AI_MODEL") ?? "gpt-4o-mini";
  const baseUrl = (Deno.env.get("MATCHING_AI_BASE_URL") ?? "https://api.openai.com/v1").replace(/\/$/, "");
  if (!apiKey) {
    console.log(JSON.stringify({ event: "matching_ai_unconfigured" }));
    return json(503, { error: "unconfigured" });
  }

  let body: Record<string, unknown>;
  try {
    const parsed = asRecord(await req.json());
    if (!parsed) throw new Error("invalid_body");
    body = parsed;
  } catch {
    console.log(JSON.stringify({ event: "matching_ai_invalid_body" }));
    return json(400, { error: "invalid_body" });
  }

  if (readString(body.mode, 32) === "normalize") {
    return await handleNormalize(body, apiKey, model, baseUrl);
  }

  const prefsRow = asRecord(body.preferences) ?? {};
  const preferences = {
    targetRole: readString(prefsRow.targetRole ?? prefsRow.target_role, 80),
    candidateLevel: readString(prefsRow.candidateLevel ?? prefsRow.candidate_level, 40),
    skills: readStringList(prefsRow.skills),
    interviewType: readString(prefsRow.interviewType ?? prefsRow.interview_type, 60),
    targetCompany: readString(prefsRow.targetCompany ?? prefsRow.target_company, 80),
    language: readString(prefsRow.language, 40),
    budget: Math.max(0, Math.round(readNumber(prefsRow.budget))),
    intent: readString(prefsRow.intent, 280),
  };

  const candidates = (Array.isArray(body.candidates) ? body.candidates : [])
    .map((item) => {
      const row = asRecord(item);
      if (!row) return null;
      const interviewerId = readString(row.interviewerId ?? row.interviewer_id, 80);
      const name = readString(row.name, 80);
      if (!interviewerId || !name) return null;
      const services = (Array.isArray(row.services) ? row.services : [])
        .map((serviceValue) => {
          const service = asRecord(serviceValue);
          if (!service) return null;
          const id = readString(service.id, 80);
          const serviceName = readString(service.name, 80);
          const interviewType = readString(service.interviewType ?? service.interview_type, 60);
          if (!id || !serviceName || !interviewType) return null;
          return {
            id,
            name: serviceName,
            interviewType,
            durationMin: Math.max(0, Math.round(readNumber(service.durationMin ?? service.duration_min))),
            pricePaise: Math.max(0, Math.round(readNumber(service.pricePaise ?? service.price_paise))),
            description: readString(service.description, 180),
          };
        })
        .filter((service): service is NonNullable<typeof service> => service != null)
        .slice(0, MAX_SERVICES);
      if (services.length === 0) return null;
      const rating = row.ratingAvg ?? row.rating_avg;
      return {
        interviewerId,
        name,
        currentRole: readString(row.currentRole ?? row.current_role, 80),
        company: readString(row.company, 80),
        headline: readString(row.headline, 120),
        skills: readStringList(row.skills),
        targetRoles: readStringList(row.targetRoles ?? row.target_roles, 8),
        candidateLevels: readStringList(row.candidateLevels ?? row.candidate_levels, 8),
        languages: readStringList(row.languages, 6),
        ratingAvg: typeof rating === "number" && Number.isFinite(rating) ? rating : null,
        reviewCount: Math.max(0, Math.round(readNumber(row.reviewCount ?? row.review_count))),
        completedInterviews: Math.max(0, Math.round(readNumber(row.completedInterviews ?? row.completed_interviews))),
        services,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item != null)
    .slice(0, MAX_CANDIDATES);

  const allowedServiceIds = new Set(candidates.flatMap((person) => person.services.map((service) => service.id)));
  const pool = new Set<string>();
  const add = (value: string) => {
    const text = value.trim().toLowerCase();
    if (text) pool.add(text);
  };
  add(preferences.targetRole);
  add(preferences.candidateLevel);
  add(preferences.interviewType);
  add(preferences.targetCompany);
  add(preferences.language);
  add(preferences.intent);
  preferences.skills.forEach(add);
  for (const person of candidates) {
    add(person.currentRole);
    add(person.company);
    add(person.headline);
    person.skills.forEach(add);
    person.targetRoles.forEach(add);
    person.candidateLevels.forEach(add);
    person.languages.forEach(add);
    for (const service of person.services) {
      add(service.name);
      add(service.interviewType);
      add(service.description);
    }
  }

  const system = [
    "You assist RoundOne interviewer matching.",
    "Use only the provided candidate preference fields and interviewer/service fields.",
    "Do not invent qualifications, reviews, availability, prices, or hiring outcomes.",
    "Do not use words like guaranteed, perfect match, best interviewer, or get hired.",
    "Return JSON only with keys normalized and matches.",
    "normalized: { target_role, candidate_level, skills, interview_type, domain_preference }.",
    "matches: [{ service_id, relevance_score (0-1), matched_factors, explanation }].",
    "matched_factors and explanation must be grounded in provided fields.",
    "Only use service_id values from the supplied candidates.",
  ].join(" ");

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: JSON.stringify({ preferences, candidates }) },
        ],
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!response.ok) {
      console.log(JSON.stringify({ event: "matching_ai_provider_error", status: response.status }));
      return json(502, { error: "provider_error" });
    }

    const raw = await response.json();
    const content = raw?.choices?.[0]?.message?.content;
    const parsedJson = typeof content === "string" ? extractJson(content) : asRecord(content);
    const row = asRecord(parsedJson);
    if (!row) {
      console.log(JSON.stringify({ event: "matching_ai_malformed_json" }));
      return json(502, { error: "malformed_json" });
    }

    const normalizedRow = asRecord(row.normalized);
    const matchesRaw = Array.isArray(row.matches) ? row.matches : [];
    const matches = [];
    for (const item of matchesRaw) {
      const parsed = asRecord(item);
      if (!parsed) continue;
      const serviceId = readString(parsed.service_id ?? parsed.serviceId, 80);
      const relevance = parsed.relevance_score ?? parsed.relevanceScore;
      const explanation = readString(parsed.explanation, 180);
      if (!allowedServiceIds.has(serviceId) || typeof relevance !== "number" || relevance < 0 || relevance > 1) {
        continue;
      }
      if (!explanation || BANNED.test(explanation)) continue;
      const factors = readStringList(parsed.matched_factors ?? parsed.matchedFactors, 6, 40).filter((factor) => {
        const needle = factor.toLowerCase();
        if (pool.has(needle)) return true;
        for (const token of pool) {
          if (token.includes(needle) || needle.includes(token)) return true;
        }
        return false;
      });
      if (matches.some((existing) => existing.service_id === serviceId)) continue;
      matches.push({
        service_id: serviceId,
        relevance_score: relevance,
        matched_factors: factors,
        explanation,
      });
      if (matches.length >= MAX_CANDIDATES) break;
    }

    console.log(JSON.stringify({
      event: "matching_ai_ok",
      matchCount: matches.length,
      candidateCount: candidates.length,
    }));

    return json(200, {
      normalized: normalizedRow
        ? {
            target_role: readString(normalizedRow.target_role ?? normalizedRow.targetRole, 80),
            candidate_level: readString(normalizedRow.candidate_level ?? normalizedRow.candidateLevel, 40),
            skills: readStringList(normalizedRow.skills, 8, 40),
            interview_type: readString(normalizedRow.interview_type ?? normalizedRow.interviewType, 60),
            domain_preference: readString(normalizedRow.domain_preference ?? normalizedRow.domainPreference, 80),
          }
        : null,
      matches,
    });
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    console.log(JSON.stringify({ event: aborted ? "matching_ai_timeout" : "matching_ai_failure" }));
    return json(502, { error: aborted ? "timeout" : "provider_error" });
  }
});
