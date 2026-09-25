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

const STOP_WORDS_DENO = new Set([
  "what",
  "which",
  "when",
  "where",
  "would",
  "could",
  "should",
  "about",
  "explain",
  "describe",
  "difference",
  "between",
  "using",
  "your",
  "with",
  "does",
  "have",
  "from",
  "into",
  "that",
  "this",
  "these",
  "those",
  "their",
  "there",
  "please",
  "tell",
  "more",
  "some",
  "such",
  "than",
  "then",
]);

function normalizeWordTokenDeno(word: string): string {
  return word.toLowerCase().replace(/(ing|ed|es|s)$/, "");
}

function tokenizeQuestionDeno(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .map(normalizeWordTokenDeno)
    .filter((w) => w.length >= 3 && !STOP_WORDS_DENO.has(w));
  return new Set(words);
}

function isQuestionRepetitionDeno(candidateQuestion: string, existingQuestion: string): boolean {
  const cNorm = candidateQuestion.trim().toLowerCase();
  const eNorm = existingQuestion.trim().toLowerCase();
  if (cNorm === eNorm) return true;

  const tokens1 = tokenizeQuestionDeno(cNorm);
  const tokens2 = tokenizeQuestionDeno(eNorm);
  if (tokens1.size === 0 || tokens2.size === 0) return false;

  let intersection = 0;
  for (const t of tokens1) {
    if (tokens2.has(t)) intersection++;
  }
  const union = new Set([...tokens1, ...tokens2]).size;
  const jaccard = union > 0 ? intersection / union : 0;
  return jaccard >= 0.65;
}

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

  const excludeQuestions = readStringList(
    body.exclude_questions ?? body.excludeQuestions ?? body.recent_questions ?? body.recentQuestions,
    50,
    400,
  );

  const system = [
    "You generate RoundOne AI practice interview questions.",
    "This is practice only, not a real booked interview or official interviewer feedback.",
    "Use only the provided role, interview type, skills, and difficulty.",
    "CRITICAL: Questions must be completely FRESH, UNIQUE, and DIVERSE. Never repeat questions or ask trivial variations.",
    excludeQuestions.length > 0
      ? `Avoid these previously asked questions: ${JSON.stringify(excludeQuestions.slice(0, 30))}.`
      : "",
    "Do not invent candidate experience, interviewer identity, company affiliation, or real company interview questions.",
    "Do not claim these are real company questions.",
    "Return JSON only: { questions: [{ question, question_type, topic, difficulty, expected_focus }] }.",
    "question_type must be technical, behavioral, system_design, or product.",
    "topic must be one of the provided skills, or the interview type.",
    "difficulty must match the requested difficulty.",
    "expected_focus is 2 to 5 short rubric bullets.",
    "Each question must explore a distinct architectural or problem-solving facet.",
  ].filter(Boolean).join(" ");

  const completed = await completeJson(apiKey, model, baseUrl, system, { setup, exclude_questions: excludeQuestions.slice(0, 30) }, 11000, 0.75);
  if (completed instanceof Response) return completed;

  const fallbackType = defaultQuestionType(setup.interviewType);
  const raw = Array.isArray(completed.questions) ? completed.questions : [];
  const questions = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const row = asRecord(item);
    if (!row) continue;
    const question = readString(row.question, 600);
    if (question.length < 20 || PRACTICE_BANNED.test(question)) continue;
    const qLower = question.toLowerCase().trim();
    if (seen.has(qLower)) continue;
    let duplicate = false;
    for (const past of excludeQuestions) {
      if (isQuestionRepetitionDeno(question, past)) {
        duplicate = true;
        break;
      }
    }
    if (duplicate) continue;

    const questionType = readString(row.question_type ?? row.questionType, 40).toLowerCase();
    const difficulty = readString(row.difficulty, 20).toLowerCase();
    const focus = parseFocus(row.expected_focus ?? row.expectedFocus);
    if (focus.length < 2) continue;
    seen.add(qLower);
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

async function handlePracticeNextQuestion(
  body: Record<string, unknown>,
  apiKey: string,
  model: string,
  baseUrl: string,
) {
  const contextRow = asRecord(body.context) ?? {};
  const setupRow = asRecord(body.setup) ?? asRecord(contextRow.interview) ?? {};
  const candidateRow =
    asRecord(contextRow.candidate) ??
    asRecord(body.candidate_context) ??
    asRecord(body.candidateContext) ??
    {};
  const stateRow =
    asRecord(contextRow.state) ??
    asRecord(body.adaptive_state) ??
    asRecord(body.adaptiveState) ??
    {};

  const setup = {
    targetRole: readString(setupRow.targetRole ?? setupRow.target_role, 80) || readString(candidateRow.role, 80),
    interviewType: readString(setupRow.interviewType ?? setupRow.interview_type, 60),
    skills: readStringList(setupRow.skills, 6, 40),
    difficulty: PRACTICE_DIFFICULTIES.includes(readString(setupRow.difficulty, 20))
      ? readString(setupRow.difficulty, 20)
      : "intermediate",
    questionCount: clampInt(setupRow.questionCount ?? setupRow.question_count, 3, 8, 5),
  };
  if (!setup.targetRole || !setup.interviewType) return json(400, { error: "invalid_body" });

  const questionNumber = clampInt(
    body.question_number ?? body.questionNumber ?? stateRow.current_question ?? stateRow.currentQuestion,
    1,
    setup.questionCount,
    1,
  );
  const priorRaw = Array.isArray(body.prior_turns)
    ? body.prior_turns
    : Array.isArray(body.priorTurns)
    ? body.priorTurns
    : Array.isArray(contextRow.turns)
    ? contextRow.turns
    : [];
  const priorTurns = [];
  for (const item of priorRaw) {
    const row = asRecord(item);
    if (!row) continue;
    const qRow = asRecord(row.question);
    const question = readString(qRow?.question ?? row.question, 600);
    if (question.length < 12) continue;
    const fbRow = asRecord(row.feedback);
    const answer = readString(row.answer, 4000);
    priorTurns.push({
      question,
      answer: answer.length > 0 ? answer.slice(0, 1000) : undefined,
      topic: readString(qRow?.topic ?? row.topic, 40),
      score: clampInt(fbRow?.score ?? row.score, 1, 10, 0) || null,
      missing_points: readStringList(
        fbRow?.missing_points ?? fbRow?.missingPoints ?? row.missing_points ?? row.missingPoints,
        5,
        140,
      ),
    });
    if (priorTurns.length >= 8) break;
  }

  const candidateContext = {
    role: readString(candidateRow.role ?? setup.targetRole, 80),
    level: readString(candidateRow.level, 40),
    skills: readStringList(candidateRow.skills ?? setup.skills, 8, 40),
    projects: readStringList(candidateRow.projects, 8, 160),
  };

  const adaptiveState = {
    current_question: questionNumber,
    tested_topics: readStringList(stateRow.tested_topics ?? stateRow.testedTopics, 8, 40),
    untested_topics: readStringList(stateRow.untested_topics ?? stateRow.untestedTopics, 8, 40),
    strengths: readStringList(stateRow.strengths, 6, 120),
    weaknesses: readStringList(stateRow.weaknesses, 6, 120),
    difficulty: PRACTICE_DIFFICULTIES.includes(readString(stateRow.difficulty, 20))
      ? readString(stateRow.difficulty, 20)
      : setup.difficulty,
  };

  const interviewerName = readString(body.interviewerName ?? body.interviewer_name ?? setupRow.interviewerName ?? setupRow.interviewer_name, 40) || "John";
  const excludeQuestions = readStringList(
    body.exclude_questions ?? body.excludeQuestions ?? body.recent_questions ?? body.recentQuestions,
    50,
    600,
  );
  const focusDimension = readString(body.focus_dimension ?? body.focusDimension, 120);
  const sessionSeed = readString(body.session_seed ?? body.sessionSeed, 60);

  const system = [
    `You are ${interviewerName}, an expert RoundOne AI interviewer conducting a realistic, structured, voice-based interview.`,
    "This is practice only, not a real booked interview or official interviewer feedback.",
    "CRITICAL REQUIREMENT: Every interview session MUST feature completely DIFFERENT, FRESH, and NON-REPETITIVE questions.",
    "NEVER repeat questions the candidate was already asked in past sessions or earlier in this session.",
    excludeQuestions.length > 0
      ? `The candidate has already been asked these specific questions in previous or current sessions. You MUST NOT repeat any of them, nor ask similar variations of them: ${JSON.stringify(excludeQuestions.slice(0, 30))}.`
      : "",
    focusDimension ? `Explore a practical technical challenge around: ${focusDimension}.` : "",
    "Generate exactly one next question for question_number.",
    "Be context-aware: build upon the candidate's prior spoken answers and background.",
    "If the candidate provided an answer in prior_turns, ask a natural, relevant follow-up that explores depth, trade-offs, or real-world problem solving.",
    candidateContext.projects.length > 0
      ? `The candidate's resume lists these projects: ${JSON.stringify(candidateContext.projects)}. If you ask about a project, you may ONLY reference one of these exact resume projects. Never invent, rename, or assume any other project, company, achievement, or responsibility.`
      : "Do not ask about a specific named project unless the candidate first mentions one, and never invent a project, company, or achievement.",
    "Do NOT invent candidate experience, projects, interviewer identity, company affiliation, or real company interview questions.",
    "If the candidate struggled on a previous question, ask a clarifying or fundamental question; if they answered strongly, probe deeper or explore architectural trade-offs.",
    "Do not make extreme difficulty swings.",
    "Do not repeat any prior question text. Ground topic strictly to one of the provided skills or interview type.",
    "Do not claim hiring outcomes or that these are official company interview questions.",
    "Keep the question concise and professional as an interviewer would speak it aloud (1-3 sentences max).",
    "Return JSON only: { question, question_type, topic, difficulty, expected_focus }.",
    "question_type must be technical, behavioral, system_design, or product.",
    "difficulty must match the requested difficulty.",
    "expected_focus is 2 to 5 short rubric bullets.",
  ].filter(Boolean).join(" ");

  const completed = await completeJson(
    apiKey,
    model,
    baseUrl,
    system,
    {
      setup,
      question_number: questionNumber,
      prior_turns: priorTurns,
      candidate_context: candidateContext,
      adaptive_state: adaptiveState,
      exclude_questions: excludeQuestions.slice(0, 30),
      focus_dimension: focusDimension,
      session_seed: sessionSeed,
    },
    11000,
    0.75,
  );
  if (completed instanceof Response) return completed;

  const fallbackType = defaultQuestionType(setup.interviewType);
  const fromWrapped = asRecord(completed.question);
  const row = fromWrapped ?? asRecord(completed);
  if (!row) {
    console.log(JSON.stringify({ event: "practice_next_question_empty" }));
    return json(502, { error: "malformed_json" });
  }
  const question = readString(row.question, 600);
  const bannedList = [
    ...priorTurns.map((item) => item.question.toLowerCase().trim()),
    ...excludeQuestions.map((item) => item.toLowerCase().trim()),
  ];
  const bannedSet = new Set(bannedList);
  const qLower = question.toLowerCase().trim();
  if (question.length < 20 || PRACTICE_BANNED.test(question) || bannedSet.has(qLower)) {
    console.log(JSON.stringify({ event: "practice_next_question_duplicate_or_invalid" }));
    return json(502, { error: "malformed_json" });
  }

  for (const banned of bannedList) {
    if (isQuestionRepetitionDeno(question, banned)) {
      console.log(JSON.stringify({ event: "practice_next_question_token_duplicate" }));
      return json(502, { error: "malformed_json" });
    }
  }

  const questionType = readString(row.question_type ?? row.questionType, 40).toLowerCase();
  const difficulty = readString(row.difficulty, 20).toLowerCase();
  const focus = parseFocus(row.expected_focus ?? row.expectedFocus);
  if (focus.length < 2) {
    console.log(JSON.stringify({ event: "practice_next_question_focus" }));
    return json(502, { error: "malformed_json" });
  }

  console.log(JSON.stringify({
    event: "practice_next_question_ok",
    question_number: questionNumber,
    prior_count: priorTurns.length,
  }));
  return json(200, {
    question: {
      question_id: `pq-${questionNumber}`,
      question,
      question_type: PRACTICE_QUESTION_TYPES.includes(questionType) ? questionType : fallbackType,
      topic: groundTopic(readString(row.topic, 40), setup.skills, setup.interviewType),
      difficulty: PRACTICE_DIFFICULTIES.includes(difficulty) ? difficulty : setup.difficulty,
      expected_focus: focus.slice(0, 5),
    },
  });
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
    "You are an expert interviewer evaluating one spoken or written candidate answer in a RoundOne AI practice interview.",
    "This is practice feedback only, not official interviewer feedback, a hiring decision, or a candidate ranking.",
    "Score 1-10 against expected_focus only:",
    "1-3 little coverage, 4-6 partial coverage, 7-8 solid with gaps, 9-10 thorough coverage.",
    "Do not mention hiring, job readiness, employability, percentiles, or guaranteed outcomes.",
    "Do not invent interviewer identity or company evaluations.",
    "Return JSON only: { score, strengths, improvements, missing_points, summary, technical_observations, communication_observations }.",
    "score is an integer 1-10.",
    "strengths, improvements, missing_points, technical_observations, communication_observations are arrays with at most 5 short strings.",
    "summary is one or two sentences.",
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
  const technicalObservations = readStringList(
    completed.technical_observations ?? completed.technicalObservations,
    4,
    140,
  ).filter((item) => !PRACTICE_BANNED.test(item));
  const communicationObservations = readStringList(
    completed.communication_observations ?? completed.communicationObservations,
    4,
    140,
  ).filter((item) => !PRACTICE_BANNED.test(item));

  console.log(JSON.stringify({ event: "practice_feedback_ok" }));
  return json(200, {
    score,
    strengths,
    improvements,
    missing_points: missingPoints,
    summary,
    technical_observations: technicalObservations,
    communication_observations: communicationObservations,
  });
}

async function handleRealtimeSession(
  body: Record<string, unknown>,
  apiKey: string,
  baseUrl: string,
) {
  const setupRow = asRecord(body.setup) ?? {};
  const role = readString(setupRow.targetRole ?? setupRow.target_role, 80) || "Software Engineer";
  const type = readString(setupRow.interviewType ?? setupRow.interview_type, 60) || "Technical";
  const interviewerName = readString(body.interviewerName ?? body.interviewer_name ?? setupRow.interviewerName ?? setupRow.interviewer_name, 40) || "John";
  const voice = readString(body.voice, 20) || "echo";

  const instructions = [
    `You are ${interviewerName}, an experienced, professional AI interviewer at RoundOne conducting a ${type} interview for a ${role} position.`,
    "Speak in a clear, natural, professional, and concise interviewer tone (1-3 sentences max).",
    "Listen attentively to the candidate's spoken responses.",
    "Do not lecture, preach, or give long speeches.",
    "Do not mention hiring decisions, job guarantees, or real company claims.",
  ].join(" ");

  const sessionPayload = {
    session: {
      type: "realtime",
      model: "gpt-4o-realtime-preview",
      voice,
      instructions,
      modalities: ["audio", "text"],
      input_audio_transcription: {
        model: "whisper-1",
      },
      turn_detection: {
        type: "server_vad",
        threshold: 0.5,
        prefix_padding_ms: 300,
        silence_duration_ms: 800,
        create_response: false,
      },
    },
  };

  try {
    let resp = await fetch(`${baseUrl}/realtime/client_secrets`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(sessionPayload),
    });

    if (!resp.ok && resp.status === 404) {
      resp = await fetch(`${baseUrl}/realtime/sessions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(sessionPayload.session),
      });
    }

    if (!resp.ok) {
      const errText = await resp.text();
      console.log(JSON.stringify({ event: "realtime_session_error", status: resp.status, text: errText.slice(0, 180) }));
      return json(resp.status >= 500 ? 502 : resp.status, {
        error: "provider_error",
        details: "Realtime session unavailable",
      });
    }

    const data = await resp.json();
    const clientSecret = data.value ?? data.client_secret?.value ?? data.client_secret;
    if (!clientSecret) {
      return json(502, { error: "malformed_json" });
    }

    return json(200, {
      client_secret: clientSecret,
      expires_at: data.expires_at ?? null,
    });
  } catch (err) {
    console.log(JSON.stringify({ event: "realtime_session_exception", error: err instanceof Error ? err.message : String(err) }));
    return json(502, { error: "realtime_failed" });
  }
}

async function handleTts(
  body: Record<string, unknown>,
  apiKey: string,
  baseUrl: string,
) {
  const text = readString(body.text, 600);
  const voice = readString(body.voice, 20) || "echo";
  if (!text) return json(400, { error: "invalid_body" });

  try {
    const resp = await fetch(`${baseUrl}/audio/speech`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "tts-1",
        voice,
        input: text,
        response_format: "mp3",
      }),
    });

    if (!resp.ok) {
      console.log(JSON.stringify({ event: "tts_provider_error", status: resp.status }));
      return json(502, { error: "provider_error" });
    }

    const buffer = await resp.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);

    return json(200, {
      audio_base64: base64,
      format: "mp3",
    });
  } catch (err) {
    console.log(JSON.stringify({ event: "tts_exception", error: err instanceof Error ? err.message : String(err) }));
    return json(502, { error: "tts_failed" });
  }
}

const RESUME_EVIDENCE_TYPES = [
  "skills_section",
  "project",
  "experience",
  "certification",
  "education",
  "tools",
  "summary",
];

const RESUME_BANNED =
  /\b(guaranteed|job-ready|hiring probability|employability|will get (you )?hired|recruiter score|ats score)\b/i;

function normalizeResumeHaystack(resumeText: string) {
  const rawLower = ` ${resumeText.toLowerCase().replace(/\s+/g, " ")} `;
  const alnumHaystack = rawLower.replace(/[^a-z0-9]+/g, "");
  return { rawLower, alnumHaystack };
}

// Anchor guard against hallucination: a term is only accepted when it can be
// found in the candidate's actual resume text (boundary-aware phrase match, or
// an alphanumeric-collapsed match for tokens like "Node.js" -> "nodejs").
function groundedInResume(
  term: string,
  rawLower: string,
  alnumHaystack: string,
) {
  const lower = term.trim().toLowerCase();
  if (lower.length < 2) return false;
  const escaped = lower.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const boundary = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`);
  if (boundary.test(rawLower)) return true;
  const alnumTerm = lower.replace(/[^a-z0-9]+/g, "");
  if (alnumTerm.length >= 4 && alnumHaystack.includes(alnumTerm)) return true;
  return false;
}

function readEvidenceType(value: unknown) {
  const v = readString(value, 40).toLowerCase().replace(/\s+/g, "_");
  return RESUME_EVIDENCE_TYPES.includes(v) ? v : "";
}

async function handleResumeSkillPlan(
  body: Record<string, unknown>,
  apiKey: string,
  model: string,
  baseUrl: string,
) {
  const resumeText = readString(body.resume_text ?? body.resumeText, 14000);
  if (resumeText.trim().length < 60) {
    return json(400, { error: "invalid_body" });
  }

  const { rawLower, alnumHaystack } = normalizeResumeHaystack(resumeText);
  const grounded = (term: string) => groundedInResume(term, rawLower, alnumHaystack);

  const system = [
    "You are RoundOne's resume analysis engine. You read ONE candidate resume and extract ONLY facts that are explicitly present in it.",
    "This produces an interview skill plan for the candidate to review. It is not a hiring decision or a resume score.",
    "ABSOLUTE RULE: Never invent, assume, guess, or embellish. Do NOT add a skill, technology, tool, framework, language, project, company, role, responsibility, achievement, certification, or education item that is not actually written in the resume text.",
    "If the resume does not clearly support something, leave it out. Do not pad the output with generic or commonly-expected interview skills.",
    "Distinguish three separate categories precisely:",
    "1) extracted_skills: skills/languages/frameworks/tools/platforms/domains that are DIRECTLY and literally written in the resume (e.g. a Skills section, a Tools list, or named explicitly).",
    "2) inferred_skills: skills that are reasonably implied by an EXPLICIT project or experience description in the resume. Each MUST cite the exact project/experience text it was inferred from. Do not infer beyond what the description explicitly says.",
    "3) interview_topics: interview focus areas DERIVED from the extracted and inferred skills above. Each topic must reference which of those skills it derives from. Do not introduce new technologies here.",
    "Also extract projects (with the technologies each project explicitly mentions), work/internship experiences, and certifications - ONLY as written in the resume.",
    "For every extracted_skill and inferred_skill, include evidence: evidence_type (one of skills_section, project, experience, certification, education, tools, summary) and evidence_detail (the exact resume section title, project name, experience entry, or certification it came from).",
    "Do not claim hiring outcomes, employability, or ATS/recruiter scores.",
    "Return JSON only with keys: profile_summary, extracted_skills, inferred_skills, interview_topics, projects, experiences, certifications.",
    "extracted_skills: [{ skill, evidence_type, evidence_detail }].",
    "inferred_skills: [{ skill, inferred_from, evidence_type, evidence_detail }] where inferred_from is the exact project/experience phrase.",
    "interview_topics: [{ topic, derived_from: [skill,...], rationale }].",
    "projects: [{ name, description, technologies: [] }].",
    "experiences: [{ title, summary, technologies: [] }].",
    "certifications: [ string ].",
    "Keep each list concise (at most 20 skills, 12 topics, 10 projects). Skills must be short (<= 40 chars).",
  ].join(" ");

  const completed = await completeJson(
    apiKey,
    model,
    baseUrl,
    system,
    { resume_text: resumeText },
    16000,
    0.15,
  );
  if (completed instanceof Response) return completed;

  const profileSummary = readString(completed.profile_summary ?? completed.profileSummary, 400);

  const seenSkill = new Set<string>();
  const extractedSkills: Array<Record<string, string>> = [];
  const rawExtracted = Array.isArray(completed.extracted_skills)
    ? completed.extracted_skills
    : Array.isArray(completed.extractedSkills)
    ? completed.extractedSkills
    : [];
  for (const item of rawExtracted) {
    const row = asRecord(item);
    if (!row) continue;
    const skill = readString(row.skill, 40);
    if (skill.length < 2 || RESUME_BANNED.test(skill)) continue;
    const key = skill.toLowerCase();
    if (seenSkill.has(key)) continue;
    // Directly-extracted skills MUST appear verbatim in the resume.
    if (!grounded(skill)) continue;
    const evidenceType = readEvidenceType(row.evidence_type ?? row.evidenceType) || "skills_section";
    const evidenceDetail = readString(row.evidence_detail ?? row.evidenceDetail, 160);
    seenSkill.add(key);
    extractedSkills.push({ skill, evidence_type: evidenceType, evidence_detail: evidenceDetail });
    if (extractedSkills.length >= 20) break;
  }

  const inferredSkills: Array<Record<string, string>> = [];
  const rawInferred = Array.isArray(completed.inferred_skills)
    ? completed.inferred_skills
    : Array.isArray(completed.inferredSkills)
    ? completed.inferredSkills
    : [];
  for (const item of rawInferred) {
    const row = asRecord(item);
    if (!row) continue;
    const skill = readString(row.skill, 40);
    if (skill.length < 2 || RESUME_BANNED.test(skill)) continue;
    const key = skill.toLowerCase();
    if (seenSkill.has(key)) continue;
    const inferredFrom = readString(row.inferred_from ?? row.inferredFrom, 200);
    const evidenceDetail = readString(row.evidence_detail ?? row.evidenceDetail, 160);
    // An inferred skill must be anchored to real resume text (the project or
    // experience it was inferred from must actually appear in the resume).
    const anchor = inferredFrom || evidenceDetail;
    if (!anchor || !grounded(anchor)) continue;
    const evidenceType = readEvidenceType(row.evidence_type ?? row.evidenceType) || "project";
    seenSkill.add(key);
    inferredSkills.push({
      skill,
      inferred_from: inferredFrom,
      evidence_type: evidenceType,
      evidence_detail: evidenceDetail || inferredFrom,
    });
    if (inferredSkills.length >= 20) break;
  }

  const acceptedSkillKeys = new Set<string>([...seenSkill]);

  const projects: Array<Record<string, unknown>> = [];
  const rawProjects = Array.isArray(completed.projects) ? completed.projects : [];
  for (const item of rawProjects) {
    const row = asRecord(item);
    if (!row) continue;
    const name = readString(row.name ?? row.title, 120);
    if (name.length < 2) continue;
    // Only keep projects whose name is actually in the resume.
    if (!grounded(name)) continue;
    const description = readString(row.description ?? row.summary, 400);
    const technologies = readStringList(row.technologies ?? row.tech ?? row.stack, 12, 40)
      .filter((t) => grounded(t));
    if (projects.some((p) => String(p.name).toLowerCase() === name.toLowerCase())) continue;
    projects.push({ name, description, technologies });
    if (projects.length >= 10) break;
  }

  const experiences: Array<Record<string, unknown>> = [];
  const rawExperiences = Array.isArray(completed.experiences) ? completed.experiences : [];
  for (const item of rawExperiences) {
    const row = asRecord(item);
    if (!row) continue;
    const title = readString(row.title ?? row.role ?? row.organization ?? row.company, 160);
    const summary = readString(row.summary ?? row.description, 400);
    const anchor = title || summary.slice(0, 40);
    if (!anchor || !grounded(anchor)) continue;
    const technologies = readStringList(row.technologies ?? row.tech ?? row.stack, 12, 40)
      .filter((t) => grounded(t));
    experiences.push({ title, summary, technologies });
    if (experiences.length >= 10) break;
  }

  const certifications = readStringList(completed.certifications, 12, 120)
    .filter((cert) => !RESUME_BANNED.test(cert) && grounded(cert));

  const interviewTopics: Array<Record<string, unknown>> = [];
  const rawTopics = Array.isArray(completed.interview_topics)
    ? completed.interview_topics
    : Array.isArray(completed.interviewTopics)
    ? completed.interviewTopics
    : [];
  for (const item of rawTopics) {
    const row = asRecord(item);
    if (!row) continue;
    const topic = readString(row.topic, 60);
    if (topic.length < 2 || RESUME_BANNED.test(topic)) continue;
    const derivedFromRaw = readStringList(row.derived_from ?? row.derivedFrom, 6, 40);
    // A topic is only valid if it derives from at least one accepted skill.
    const derivedFrom = derivedFromRaw.filter((s) => acceptedSkillKeys.has(s.toLowerCase()));
    if (derivedFrom.length === 0) continue;
    const rationale = readString(row.rationale, 200);
    if (interviewTopics.some((t) => String(t.topic).toLowerCase() === topic.toLowerCase())) continue;
    interviewTopics.push({ topic, derived_from: derivedFrom, rationale });
    if (interviewTopics.length >= 12) break;
  }

  if (
    extractedSkills.length === 0 &&
    inferredSkills.length === 0 &&
    projects.length === 0 &&
    experiences.length === 0
  ) {
    console.log(JSON.stringify({ event: "resume_skill_plan_empty" }));
    return json(502, { error: "insufficient_resume_evidence" });
  }

  console.log(JSON.stringify({
    event: "resume_skill_plan_ok",
    extracted: extractedSkills.length,
    inferred: inferredSkills.length,
    topics: interviewTopics.length,
    projects: projects.length,
  }));

  return json(200, {
    profile_summary: RESUME_BANNED.test(profileSummary) ? "" : profileSummary,
    extracted_skills: extractedSkills,
    inferred_skills: inferredSkills,
    interview_topics: interviewTopics,
    projects,
    experiences,
    certifications,
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

  if (readString(body.mode, 32) === "realtime_session") {
    return await handleRealtimeSession(body, apiKey, baseUrl);
  }
  if (readString(body.mode, 32) === "tts") {
    return await handleTts(body, apiKey, baseUrl);
  }
  if (readString(body.mode, 32) === "normalize") {
    return await handleNormalize(body, apiKey, model, baseUrl);
  }
  if (readString(body.mode, 32) === "practice_questions") {
    return await handlePracticeQuestions(body, apiKey, model, baseUrl);
  }
  if (readString(body.mode, 32) === "practice_next_question") {
    return await handlePracticeNextQuestion(body, apiKey, model, baseUrl);
  }
  if (readString(body.mode, 32) === "practice_feedback") {
    return await handlePracticeFeedback(body, apiKey, model, baseUrl);
  }
  if (readString(body.mode, 32) === "prepare") {
    return await handlePrepare(body, apiKey, model, baseUrl);
  }
  if (readString(body.mode, 32) === "resume_skill_plan") {
    return await handleResumeSkillPlan(body, apiKey, model, baseUrl);
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
