export type ConversationLine = {
  id: string
  role: 'interviewer' | 'candidate'
  text: string
  draft?: boolean
}

export function practiceConversationLines(
  turns: Array<{ question: { id: string; question: string }; answer: string }>,
  current: { id: string; question: string } | null,
  draft: string,
): ConversationLine[] {
  const lines: ConversationLine[] = []
  for (const turn of turns) {
    const question = turn.question.question.trim()
    const answer = turn.answer.trim()
    if (question) {
      lines.push({ id: `q-${turn.question.id}`, role: 'interviewer', text: question })
    }
    if (answer) {
      lines.push({ id: `a-${turn.question.id}`, role: 'candidate', text: answer })
    }
  }
  if (current) {
    const alreadySpoken = turns.some((turn) => turn.question.id === current.id)
    const question = current.question.trim()
    if (!alreadySpoken && question) {
      lines.push({ id: `q-${current.id}`, role: 'interviewer', text: question })
    }
  }
  const pending = draft.trim()
  if (current && pending) {
    lines.push({ id: `draft-${current.id}`, role: 'candidate', text: pending, draft: true })
  }
  return lines
}
