import { INTERVIEW_TYPES, type InterviewType } from './catalogs.ts'

export type PracticeQuestion = {
  id: string
  title: string
  prompt: string
  kind: 'coding' | 'written'
  starterCode?: string
  expectedPoints: Array<{ label: string; keywords: string[] }>
  followUp: string
  modelOutline: string
}

export type PracticeDrill = {
  type: InterviewType
  durationMin: number
  summary: string
  checklist: string[]
  questions: PracticeQuestion[]
}

export function practiceTypeSlug(type: InterviewType) {
  return type.toLowerCase().replace(/\s+/g, '-')
}

export function practiceTypeFromSlug(slug: string | undefined): InterviewType | null {
  if (!slug) return null
  const normalized = slug.trim().toLowerCase()
  return INTERVIEW_TYPES.find((type) => practiceTypeSlug(type) === normalized) ?? null
}

export function isAttemptedAnswer(question: PracticeQuestion, text: string) {
  const trimmed = text.trim()
  if (!trimmed) return false
  const starter = question.starterCode?.trim()
  if (starter && trimmed === starter) return false
  return true
}

export function coverageForAnswer(answer: string, points: PracticeQuestion['expectedPoints']) {
  const text = answer.toLowerCase()
  const covered: string[] = []
  const missed: string[] = []
  for (const point of points) {
    const hit = point.keywords.some((keyword) => text.includes(keyword.toLowerCase()))
    if (hit) covered.push(point.label)
    else missed.push(point.label)
  }
  return { covered, missed }
}

export const PRACTICE_DRILLS: Record<InterviewType, PracticeDrill> = {
  Coding: {
    type: 'Coding',
    durationMin: 15,
    summary: 'Warm up with DSA prompts. Write an approach, then code if you have time.',
    checklist: ['Clarify input/output', 'State complexity', 'Talk through an example', 'Handle edge cases'],
    questions: [
      {
        id: 'coding-1',
        title: 'Two Sum',
        kind: 'coding',
        prompt:
          'Given an array of integers and a target, return the indices of two numbers that add up to the target. Assume exactly one solution. Walk through time and space complexity.',
        starterCode: `function twoSum(nums, target) {
  // return [i, j]
}`,
        expectedPoints: [
          { label: 'Hash map for complements', keywords: ['map', 'hash', 'object', 'dict', 'complement'] },
          { label: 'O(n) time', keywords: ['o(n)', 'linear', 'one pass', 'single pass'] },
          { label: 'Index pair, not the values', keywords: ['index', 'indices'] },
        ],
        followUp: 'What if the array is sorted? Could you do it in O(1) extra space?',
        modelOutline: 'Scan once, store value → index. For each number, look up target - num. Return the two indices.',
      },
      {
        id: 'coding-2',
        title: 'Valid Parentheses',
        kind: 'coding',
        prompt:
          'Given a string containing (), {}, and [], determine if it is valid. Brackets must close in the correct order.',
        starterCode: `function isValid(s) {
  // return boolean
}`,
        expectedPoints: [
          { label: 'Stack', keywords: ['stack', 'push', 'pop'] },
          { label: 'Matching pairs', keywords: ['match', 'pair', 'map', 'close'] },
          { label: 'Empty stack at the end', keywords: ['empty', 'length', '0'] },
        ],
        followUp: 'How would you extend this to also allow quotes and escaped characters?',
        modelOutline: 'Push opening brackets. On a closer, pop and compare. Valid only if the stack is empty at the end.',
      },
      {
        id: 'coding-3',
        title: 'Merge Intervals',
        kind: 'written',
        prompt:
          'You are given an array of meeting intervals [start, end]. Merge all overlapping intervals and return the result. Explain the algorithm before writing code.',
        expectedPoints: [
          { label: 'Sort by start time', keywords: ['sort', 'start'] },
          { label: 'Merge when overlap', keywords: ['overlap', 'merge', 'max'] },
          { label: 'O(n log n) from the sort', keywords: ['n log', 'sort'] },
        ],
        followUp: 'What if new meetings arrive as a stream?',
        modelOutline: 'Sort by start, then scan: if the next start is <= current end, extend the end; otherwise push a new interval.',
      },
    ],
  },
  'System Design': {
    type: 'System Design',
    durationMin: 15,
    summary: 'Practice scoping, APIs, storage, and trade-offs for a short design loop.',
    checklist: ['Clarify requirements', 'Sketch API', 'Pick storage', 'Call out bottlenecks'],
    questions: [
      {
        id: 'sd-1',
        title: 'URL shortener',
        kind: 'written',
        prompt:
          'Design a URL shortening service like bit.ly. Cover the write path, redirect path, unique ID generation, and scale to 100M new URLs per day.',
        expectedPoints: [
          { label: 'API: create + redirect', keywords: ['api', 'post', 'redirect', 'get'] },
          { label: 'Unique ID / hash', keywords: ['hash', 'base62', 'id', 'snowflake', 'uuid'] },
          { label: 'Cache hot redirects', keywords: ['cache', 'redis', 'cdn'] },
        ],
        followUp: 'How do you handle custom aliases and abuse (spam links)?',
        modelOutline: 'POST /shorten stores a mapping. Redirect is a 302 from a cache-backed key-value store. IDs via base62 counter or hash.',
      },
      {
        id: 'sd-2',
        title: 'News feed',
        kind: 'written',
        prompt: 'Design a home feed for a Twitter-like product. How do you fan-out posts to followers and keep the feed fast?',
        expectedPoints: [
          { label: 'Fan-out on write vs read', keywords: ['fan-out', 'fan out', 'push', 'pull'] },
          { label: 'Timeline storage', keywords: ['timeline', 'redis', 'cache', 'precompute'] },
          { label: 'Celebrity / hot-key problem', keywords: ['celebrity', 'hot', 'popular', 'hybrid'] },
        ],
        followUp: 'Where does ranking (not just recency) fit in this design?',
        modelOutline: 'Hybrid fan-out: push to timelines for normal users, pull for celebrities. Cache the home timeline.',
      },
      {
        id: 'sd-3',
        title: 'Rate limiter',
        kind: 'written',
        prompt: 'Design a rate limiter for a public API: 100 requests per minute per user. Where does it sit, and which algorithm do you pick?',
        expectedPoints: [
          { label: 'Token / sliding window', keywords: ['token', 'leaky', 'sliding', 'fixed window', 'window'] },
          { label: 'Per-user key', keywords: ['user', 'ip', 'key', 'redis'] },
          { label: 'Gateway placement', keywords: ['gateway', 'edge', 'middleware', 'proxy'] },
        ],
        followUp: 'How do you keep counters correct across multiple API nodes?',
        modelOutline: 'Put it at the gateway. Sliding window or token bucket in Redis keyed by user id. Return 429 with Retry-After.',
      },
    ],
  },
  Behavioral: {
    type: 'Behavioral',
    durationMin: 15,
    summary: 'Answer with STAR. Aim for a specific story, your actions, and a measurable result.',
    checklist: ['Situation', 'Task', 'Action (your work)', 'Result'],
    questions: [
      {
        id: 'beh-1',
        title: 'Conflict on a project',
        kind: 'written',
        prompt:
          'Tell me about a time you disagreed with a teammate or manager. What was at stake, what did you do, and how did it end?',
        expectedPoints: [
          { label: 'Specific situation', keywords: ['team', 'project', 'deadline', 'manager'] },
          { label: 'Your actions', keywords: ['i ', "i've", 'i did', 'i asked', 'i proposed'] },
          { label: 'Outcome / learning', keywords: ['result', 'outcome', 'learned', 'shipped', 'agreed'] },
        ],
        followUp: 'What would you do differently next time?',
        modelOutline: 'STAR: one concrete disagreement, the trade-off, the steps you took, and a clear result.',
      },
      {
        id: 'beh-2',
        title: 'Owned a failure',
        kind: 'written',
        prompt: 'Describe a time something you owned went wrong in production or missed a deadline. How did you respond?',
        expectedPoints: [
          { label: 'You owned it', keywords: ['i ', 'my', 'owned', 'responsible'] },
          { label: 'Mitigation', keywords: ['fix', 'rollback', 'hotfix', 'communicate', 'incident'] },
          { label: 'Prevention after', keywords: ['test', 'alert', 'runbook', 'process', 'prevent'] },
        ],
        followUp: 'How did you communicate with stakeholders during the incident?',
        modelOutline: 'Own the miss, describe the fix, then the lasting change (tests, alerts, process).',
      },
      {
        id: 'beh-3',
        title: 'Ambiguous scope',
        kind: 'written',
        prompt: 'Tell me about a time the requirements were unclear. How did you create clarity and still deliver?',
        expectedPoints: [
          { label: 'Clarifying questions', keywords: ['ask', 'clarif', 'stakeholder', 'goal'] },
          { label: 'Cut scope', keywords: ['mvp', 'scope', 'priority', 'cut'] },
          { label: 'Shipped something', keywords: ['ship', 'launch', 'deliver', 'release'] },
        ],
        followUp: 'How did you decide what was out of scope?',
        modelOutline: 'Restate the user goal, propose an MVP, get alignment, then deliver a thin slice.',
      },
    ],
  },
  'Machine Learning': {
    type: 'Machine Learning',
    durationMin: 15,
    summary: 'Cover problem framing, data, metrics, and a production-minded model choice.',
    checklist: ['Define the label', 'Pick a metric', 'Split data correctly', 'Talk about serving'],
    questions: [
      {
        id: 'ml-1',
        title: 'Churn model',
        kind: 'written',
        prompt:
          'You need to predict which users will churn next 30 days. How do you frame the problem, choose a metric, and avoid leakage?',
        expectedPoints: [
          { label: 'Binary classification + time window', keywords: ['classif', '30', 'label', 'window'] },
          { label: 'Precision / recall / AUC', keywords: ['precision', 'recall', 'auc', 'f1', 'pr'] },
          { label: 'No leakage from the future', keywords: ['leak', 'future', 'cutoff', 'point-in-time'] },
        ],
        followUp: 'How would you choose a threshold for an email campaign?',
        modelOutline: 'Label = churned within 30d after a cutoff. Features only from before cutoff. Optimize PR-AUC, then pick a threshold from cost.',
      },
      {
        id: 'ml-2',
        title: 'Recommendations',
        kind: 'written',
        prompt: 'Design a “you may also like” model for an e-commerce product page. Offline metrics and an online experiment.',
        expectedPoints: [
          { label: 'Candidate generation + ranking', keywords: ['candidate', 'rank', 'collaborative', 'embedding'] },
          { label: 'Offline metric', keywords: ['ndcg', 'recall', 'hit', 'map'] },
          { label: 'A/B test', keywords: ['ab', 'a/b', 'experiment', 'ctr', 'revenue'] },
        ],
        followUp: 'How do you avoid recommending the same popular items to everyone?',
        modelOutline: 'Retrieve similar items, rank with a model, measure NDCG offline and conversion online. Add diversity.',
      },
      {
        id: 'ml-3',
        title: 'Unbalanced labels',
        kind: 'written',
        prompt: 'Fraud is 0.2% of transactions. How do you train and evaluate a detector without fooling yourself with accuracy?',
        expectedPoints: [
          { label: 'Accuracy is misleading', keywords: ['accuracy', 'imbalance', 'skew'] },
          { label: 'PR curve / recall at precision', keywords: ['precision', 'recall', 'pr', 'auc'] },
          { label: 'Class weight or sampling', keywords: ['weight', 'undersample', 'oversample', 'focal'] },
        ],
        followUp: 'What goes wrong if you downsample the negative class too aggressively?',
        modelOutline: 'Ignore accuracy. Use PR-AUC and cost-sensitive thresholds. Weight or sample carefully so probabilities stay calibrated.',
      },
    ],
  },
  Product: {
    type: 'Product',
    durationMin: 15,
    summary: 'Structure product sense: user, goal, metrics, then 1–2 solutions with trade-offs.',
    checklist: ['Clarify the goal', 'Name the user', 'Pick a north-star metric', 'Propose and trade off'],
    questions: [
      {
        id: 'pm-1',
        title: 'Improve YouTube watch time',
        kind: 'written',
        prompt: 'You are a PM on YouTube. How would you improve watch time for new users in their first week?',
        expectedPoints: [
          { label: 'New-user goal', keywords: ['new', 'first week', 'onboard', 'activation'] },
          { label: 'Metric', keywords: ['watch', 'retention', 'd7', 'time'] },
          { label: 'Concrete solution', keywords: ['recommend', 'onboarding', 'topic', 'follow', 'playlist'] },
        ],
        followUp: 'What would you not do, and why?',
        modelOutline: 'Goal = first-week retention via watch time. Diagnose cold start, then a personalization or onboarding bet with a guardrail against clickbait.',
      },
      {
        id: 'pm-2',
        title: 'Should we build X?',
        kind: 'written',
        prompt: 'Instagram is considering a “close friends stories only” homepage tab. Should they ship it? How would you decide?',
        expectedPoints: [
          { label: 'User problem', keywords: ['friend', 'private', 'intimacy', 'feed'] },
          { label: 'Company goals', keywords: ['engagement', 'retention', 'time spent'] },
          { label: 'Experiment / rollout', keywords: ['test', 'experiment', 'rollout', 'mvp'] },
        ],
        followUp: 'How might this cannibalize the main feed?',
        modelOutline: 'State the job-to-be-done, the metric, a cheap MVP, and a kill criterion if it splits attention.',
      },
      {
        id: 'pm-3',
        title: 'Root cause a drop',
        kind: 'written',
        prompt: 'DAU dropped 8% week over week. Walk through how you would diagnose it before proposing a feature.',
        expectedPoints: [
          { label: 'Segment the drop', keywords: ['segment', 'platform', 'country', 'new vs', 'cohort'] },
          { label: 'Check instrumentation', keywords: ['bug', 'tracking', 'analytics', 'release'] },
          { label: 'Then product hypothesis', keywords: ['hypothesis', 'funnel', 'retention'] },
        ],
        followUp: 'What is the first dashboard you open?',
        modelOutline: 'Rule out tracking and releases, then slice by platform/geo/new vs returning, then inspect the funnel.',
      },
    ],
  },
  'Data Science': {
    type: 'Data Science',
    durationMin: 15,
    summary: 'Practice SQL thinking, experiment design, and how you would explain the result.',
    checklist: ['Restate the question', 'Define the metric', 'Watch for bias', 'State the recommendation'],
    questions: [
      {
        id: 'ds-1',
        title: 'SQL: weekly active users',
        kind: 'written',
        prompt:
          'Write (or describe) SQL to compute weekly active users for the last 8 weeks from a table events(user_id, event_time). What is your definition of “active”?',
        expectedPoints: [
          { label: 'Date truncation / week bucket', keywords: ['date_trunc', 'week', 'date'] },
          { label: 'Count distinct users', keywords: ['distinct', 'count', 'user'] },
          { label: 'Define active', keywords: ['active', 'event', 'login', 'session'] },
        ],
        followUp: 'How would you exclude internal employees?',
        modelOutline: 'Bucket event_time by week, COUNT(DISTINCT user_id). Define active as any event (or a specific event) in that week.',
      },
      {
        id: 'ds-2',
        title: 'Experiment: new checkout',
        kind: 'written',
        prompt: 'A new checkout flow is in an A/B test. Conversion is up 2% (p = 0.04) but revenue per user is flat. What do you recommend?',
        expectedPoints: [
          { label: 'Primary vs guardrail metric', keywords: ['primary', 'guardrail', 'revenue', 'conversion'] },
          { label: 'Sample ratio / novelty', keywords: ['srm', 'novelty', 'aa', 'sample'] },
          { label: 'Decision, not just p-value', keywords: ['ship', 'iterate', 'hold', 'recommend'] },
        ],
        followUp: 'Would you ship if mobile looks different from desktop?',
        modelOutline: 'Check SRM and segments. Conversion up with flat ARPU may mean cheaper orders. Recommend shipping only if revenue and UX guardrails hold.',
      },
      {
        id: 'ds-3',
        title: 'Causal vs correlation',
        kind: 'written',
        prompt:
          'Users who open the app daily spend 3× more. Marketing wants a “daily reminder” push because it will increase spend. How do you respond?',
        expectedPoints: [
          { label: 'Confounding', keywords: ['confound', 'correlation', 'causal', 'selection'] },
          { label: 'Experiment', keywords: ['experiment', 'ab', 'a/b', 'random'] },
          { label: 'Push fatigue risk', keywords: ['fatigue', 'opt out', 'unsubscribe', 'spam'] },
        ],
        followUp: 'What would a good holdout look like?',
        modelOutline: 'Daily users are already high-intent. Test reminders on a random holdout and watch spend plus opt-out rate.',
      },
    ],
  },
}
