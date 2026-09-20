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
  timeoutMs = 7000,
  temperature = 0.1,
) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature,
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

const PRACTICE_QUESTION_TYPES = ["technical", "behavioral", "system_design", "product"];
const PRACTICE_DIFFICULTIES = ["beginner", "intermediate", "advanced"];
const PRACTICE_BANNED =
  /\b(ready for the job|you will get hired|hiring decision|guaranteed|employability|interview success probability|real (google|amazon|meta|microsoft|netflix) interview|official interviewer feedback|percentile)\b/i;

function clampInt(value: unknown, min: number, max: number, fallback: number) {
  const n = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : fallback;
  return Math.min(max, Math.max(min, n));
}

function defaultQuestionType(interviewType: string) {
  const n = interviewType.trim().toLowerCase();
  if (n === "behavioral") return "behavioral";
  if (n === "system design") return "system_design";
  if (n === "product") return "product";
  return "technical";
}

function groundTopic(value: string, skills: string[], interviewType: string) {
  const canonical = matchVocab(value, skills);
  if (canonical) return canonical;
  if (value.trim() && value.trim().toLowerCase() === interviewType.trim().toLowerCase()) return interviewType;
  return skills[0] || interviewType;
}

function parseFocus(value: unknown) {
  return readStringList(value, 6, 80).filter((item) => item.length >= 4);
}

async function handlePracticeQuestions(
  body: Record<string, unknown>,
  apiKey: string,
  model: string,
  baseUrl: string,
) {
  const setupRow = asRecord(body.setup) ?? {};
  const setup = {
    targetRole: readString(setupRow.targetRole ?? setupRow.target_role, 80),
    interviewType: readString(setupRow.interviewType ?? setupRow.interview_type, 60),
    skills: readStringList(setupRow.skills, 6, 40),
    difficulty: PRACTICE_DIFFICULTIES.includes(readString(setupRow.difficulty, 20))
      ? readString(setupRow.difficulty, 20)
      : "intermediate",
    questionCount: clampInt(setupRow.questionCount ?? setupRow.question_count, 3, 8, 5),
  };
  if (!setup.targetRole || !setup.interviewType) return json(400, { error: "invalid_body" });

  const system = [
    "You generate RoundOne AI practice interview questions.",
    "This is practice only, not a real booked interview or official interviewer feedback.",
    "Use only the provided role, interview type, skills, and difficulty.",
    "Do not invent candidate experience, interviewer identity, company affiliation, or real company interview questions.",
    "Do not claim these are real company questions.",
    "Return JSON only: { questions: [{ question, question_type, topic, difficulty, expected_focus }] }.",
    "question_type must be technical, behavioral, system_design, or product.",
    "topic must be one of the provided skills, or the interview type.",
    "difficulty must match the requested difficulty.",
    "expected_focus is 2 to 5 short rubric bullets.",
    "Each question must be distinct and answerable in text.",
  ].join(" ");

  const completed = await completeJson(apiKey, model, baseUrl, system, { setup }, 11000, 0.4);
  if (completed instanceof Response) return completed;

  const fallbackType = defaultQuestionType(setup.interviewType);
  const raw = Array.isArray(completed.questions) ? completed.questions : [];
  const questions = [];
  for (const item of raw) {
    const row = asRecord(item);
    if (!row) continue;
    const question = readString(row.question, 600);
    if (question.length < 20 || PRACTICE_BANNED.test(question)) continue;
    if (questions.some((existing) => existing.question.toLowerCase() === question.toLowerCase())) continue;
    const questionType = readString(row.question_type ?? row.questionType, 40).toLowerCase();
    const difficulty = readString(row.difficulty, 20).toLowerCase();
    const focus = parseFocus(row.expected_focus ?? row.expectedFocus);
    if (focus.length < 2) continue;
    questions.push({
      question_id: `pq-${questions.length + 1}`,
      question,
      question_type: PRACTICE_QUESTION_TYPES.includes(questionType) ? questionType : fallbackType,
      topic: groundTopic(readString(row.topic, 40), setup.skills, setup.interviewType),
      difficulty: PRACTICE_DIFFICULTIES.includes(difficulty) ? difficulty : setup.difficulty,
      expected_focus: focus.slice(0, 5),
    });
    if (questions.length >= setup.questionCount) break;
  }

  if (questions.length === 0) {
    console.log(JSON.stringify({ event: "practice_questions_empty" }));
    return json(502, { error: "malformed_json" });
  }

  console.log(JSON.stringify({ event: "practice_questions_ok", count: questions.length }));
  return json(200, { questions });
}

async function handlePracticeFeedback(
  body: Record<string, unknown>,
  apiKey: string,
  model: string,
  baseUrl: string,
) {
  const questionRow = asRecord(body.question) ?? {};
  const question = {
    question: readString(questionRow.question, 600),
    topic: readString(questionRow.topic, 40),
    difficulty: readString(questionRow.difficulty, 20),
    expectedFocus: parseFocus(questionRow.expectedFocus ?? questionRow.expected_focus),
  };
  const answer = readString(body.answer, 4000);
  if (!question.question || question.expectedFocus.length === 0 || answer.length < 8) {
    return json(400, { error: "invalid_body" });
  }

  const system = [
    "You give RoundOne AI practice feedback on one written answer.",
    "This is practice feedback only, not official interviewer feedback, a hiring decision, or a candidate ranking.",
    "Score 1-10 against expected_focus only:",
    "1-3 little coverage, 4-6 partial coverage, 7-8 solid with gaps, 9-10 thorough coverage.",
    "Do not mention hiring, job readiness, employability, percentiles, or guaranteed outcomes.",
    "Do not invent interviewer identity or company evaluations.",
    "Return JSON only: { score, strengths, improvements, missing_points, summary }.",
    "score is an integer 1-10. Arrays have at most 5 short strings. summary is one or two sentences.",
  ].join(" ");

  const completed = await completeJson(
    apiKey,
    model,
    baseUrl,
    system,
    { question, answer },
    8000,
    0.1,
  );
  if (completed instanceof Response) return completed;

  const score = clampInt(completed.score, 1, 10, 0);
  const summary = readString(completed.summary, 280);
  if (score < 1 || summary.length < 12 || PRACTICE_BANNED.test(summary)) {
    console.log(JSON.stringify({ event: "practice_feedback_invalid" }));
    return json(502, { error: "malformed_json" });
  }

  const strengths = readStringList(completed.strengths, 5, 140).filter((item) => !PRACTICE_BANNED.test(item));
  const improvements = readStringList(completed.improvements, 5, 140).filter((item) => !PRACTICE_BANNED.test(item));
  const missingPoints = readStringList(
    completed.missing_points ?? completed.missingPoints,
    5,
    140,
  ).filter((item) => !PRACTICE_BANNED.test(item));

  console.log(JSON.stringify({ event: "practice_feedback_ok" }));
  return json(200, {
    score,
    strengths,
    improvements,
    missing_points: missingPoints,
    summary,
  });
}

const PREPARE_PRIORITIES = ["high", "medium", "low"];
const PREPARE_BANNED =
  /\b(guaranteed|job-ready|hiring probability|employability|will get (you )?hired|definitely be asked|resume is ready|recruiter score)\b/i;

function groundPrepareTopic(value: string, skills: string[], interviewType: string, role: string) {
  const canonical = matchVocab(value, skills);
  if (canonical) return canonical;
  const lowered = value.trim().toLowerCase();
  if (lowered && lowered === interviewType.trim().toLowerCase()) return interviewType;
  if (lowered && lowered === role.trim().toLowerCase()) return role;
  // Allow short grounded phrases that clearly reference supplied skills/role/type substrings.
  const pool = [...skills, interviewType, role].filter(Boolean);
  const hit = pool.find((item) => lowered.includes(item.toLowerCase()) || item.toLowerCase().includes(lowered));
  return hit ? value.trim().slice(0, 60) : (skills[0] || interviewType || role);
}

async function handlePrepare(
  body: Record<string, unknown>,
  apiKey: string,
  model: string,
  baseUrl: string,
) {
  const inputRow = asRecord(body.input) ?? asRecord(body.context) ?? {};
  const input = {
    targetRole: readString(inputRow.targetRole ?? inputRow.target_role, 80),
    experienceLevel: readString(inputRow.experienceLevel ?? inputRow.experience_level ?? inputRow.candidate_level, 40),
    skills: readStringList(inputRow.skills, 12, 40),
    interviewType: readString(inputRow.interviewType ?? inputRow.interview_type, 60),
    resumeText: readString(inputRow.resumeText ?? inputRow.resume_text, 8000),
  };
  if (!input.targetRole && input.skills.length === 0 && !input.resumeText) {
    return json(400, { error: "invalid_body" });
  }

  const system = [
    "You create RoundOne AI interview preparation suggestions for a candidate.",
    "This is preparation guidance only, not a hiring decision, resume score, or official interviewer feedback.",
    "Use only the supplied target role, experience level, skills, interview type, and optional resume/background text.",
    "Do not invent employers, projects, degrees, or technologies that are not supported by the input.",
    "Do not claim guaranteed interview questions, job readiness, employability, or hiring probability.",
    "Return JSON only: { profile_summary, priority_topics: [{ topic, reason, priority }], interview_focus_areas: string[], practice_recommendations: [{ topic, question_count, difficulty }] }.",
    "priority must be high, medium, or low. difficulty must be beginner, intermediate, or advanced.",
    "question_count must be 3, 5, or 8. Keep arrays short (at most 6 items). Topics should be practiceable.",
  ].join(" ");

  const completed = await completeJson(apiKey, model, baseUrl, system, { input }, 12000, 0.2);
  if (completed instanceof Response) return completed;

  const profileSummary = readString(completed.profile_summary ?? completed.profileSummary, 320);
  if (profileSummary.length < 20 || PREPARE_BANNED.test(profileSummary)) {
    console.log(JSON.stringify({ event: "prepare_invalid_summary" }));
    return json(502, { error: "malformed_json" });
  }

  const priorityTopics = [];
  const rawTopics = Array.isArray(completed.priority_topics)
    ? completed.priority_topics
    : Array.isArray(completed.priorityTopics)
    ? completed.priorityTopics
    : [];
  for (const item of rawTopics) {
    const row = asRecord(item);
    if (!row) continue;
    const topicRaw = readString(row.topic, 60);
    const reason = readString(row.reason, 180);
    const priority = readString(row.priority, 16).toLowerCase();
    if (topicRaw.length < 2 || reason.length < 8 || PREPARE_BANNED.test(reason)) continue;
    if (!PREPARE_PRIORITIES.includes(priority)) continue;
    const topic = groundPrepareTopic(topicRaw, input.skills, input.interviewType, input.targetRole);
    if (!topic) continue;
    if (priorityTopics.some((existing) => existing.topic.toLowerCase() === topic.toLowerCase())) continue;
    priorityTopics.push({ topic, reason, priority });
    if (priorityTopics.length >= 6) break;
  }

  const focusAreas = readStringList(
    completed.interview_focus_areas ?? completed.interviewFocusAreas,
    6,
    60,
  )
    .map((item) => groundPrepareTopic(item, input.skills, input.interviewType, input.targetRole))
    .filter((item, index, arr) => item && arr.findIndex((x) => x.toLowerCase() === item.toLowerCase()) === index)
    .slice(0, 6);

  const practiceRecommendations = [];
  const rawPractice = Array.isArray(completed.practice_recommendations)
    ? completed.practice_recommendations
    : Array.isArray(completed.practiceRecommendations)
    ? completed.practiceRecommendations
    : [];
  for (const item of rawPractice) {
    const row = asRecord(item);
    if (!row) continue;
    const topic = groundPrepareTopic(
      readString(row.topic, 60),
      input.skills,
      input.interviewType,
      input.targetRole,
    );
    const difficulty = readString(row.difficulty, 20).toLowerCase();
    const questionCount = clampInt(row.question_count ?? row.questionCount, 3, 8, 5);
    if (!topic || !PRACTICE_DIFFICULTIES.includes(difficulty)) continue;
    if (![3, 5, 8].includes(questionCount)) continue;
    if (practiceRecommendations.some((existing) => existing.topic.toLowerCase() === topic.toLowerCase())) continue;
    practiceRecommendations.push({
      topic,
      question_count: questionCount,
      difficulty,
    });
    if (practiceRecommendations.length >= 6) break;
  }

  if (priorityTopics.length === 0 && focusAreas.length === 0 && practiceRecommendations.length === 0) {
    console.log(JSON.stringify({ event: "prepare_empty" }));
    return json(502, { error: "malformed_json" });
  }

  console.log(JSON.stringify({ event: "prepare_ok" }));
  return json(200, {
    profile_summary: profileSummary,
    priority_topics: priorityTopics,
    interview_focus_areas: focusAreas,
    practice_recommendations: practiceRecommendations,
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
  if (readString(body.mode, 32) === "practice_questions") {
    return await handlePracticeQuestions(body, apiKey, model, baseUrl);
  }
  if (readString(body.mode, 32) === "practice_feedback") {
    return await handlePracticeFeedback(body, apiKey, model, baseUrl);
  }
  if (readString(body.mode, 32) === "prepare") {
    return await handlePrepare(body, apiKey, model, baseUrl);
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
