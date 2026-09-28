import { dedupeSkills, normalizeSkill } from '../matching/skills.ts'
import { skillsMatch } from '../matching/skillCanonical.ts'

function expect(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

type Person = { id: string; skills: string[] }

function coverage(jobSkills: string[], interviewerSkills: string[]) {
  const jobs = dedupeSkills(jobSkills)
  const interviewer = dedupeSkills(interviewerSkills)
  const interviewerKeys = new Set(interviewer.map((skill) => normalizeSkill(skill)))
  const matched = jobs.filter((skill) => interviewerKeys.has(normalizeSkill(skill)))
  const missing = jobs.filter((skill) => !interviewerKeys.has(normalizeSkill(skill)))
  const extra = interviewer.filter((skill) => !jobs.some((job) => normalizeSkill(job) === normalizeSkill(skill)))
  const ratio = jobs.length === 0 ? 0 : matched.length / jobs.length
  const percent = Math.round(ratio * 1000) / 10
  return { matched, missing, extra, ratio, percent }
}

function rank(jobSkills: string[], people: Person[], search?: string) {
  const query = search?.trim().toLowerCase() ?? ''
  const rows = people
    .map((person) => ({ person, score: coverage(jobSkills, person.skills) }))
    .filter((row) => {
      if (!query) return true
      return (
        row.person.id.toLowerCase().includes(query) ||
        row.person.skills.some((skill) => skillsMatch(skill, search ?? '') || skill.toLowerCase().includes(query))
      )
    })
    .sort((a, b) => b.score.ratio - a.score.ratio || a.person.id.localeCompare(b.person.id))
  return rows
}

const job = ['Python', 'Pandas', 'PowerBI', 'Machine Learning Algorithms']
const full = coverage(job, ['python', 'pandas', 'Power BI', 'machine learning', 'Deep Learning'])
expect(full.percent === 100, '18 100% coverage')
expect(full.extra.includes('Deep Learning'), '20 extra skill kept')
expect(full.matched.length === 4, '20 extras do not reduce coverage')

const partial = coverage(job, ['Python', 'Pandas', 'NumPy'])
expect(partial.percent === 50, 'partial coverage')
expect(partial.missing.length === 2, 'missing job skills')

const threeOfFour = coverage(['Python', 'Pandas', 'NumPy', 'SQL'], ['Python', 'Pandas', 'NumPy', 'Docker'])
expect(threeOfFour.percent === 75, '18 75%')
expect(threeOfFour.extra.includes('Docker'), '20 docker is extra')

const none = coverage(job, ['Docker'])
expect(none.percent === 0 && none.matched.length === 0, '19 zero match score')

const ranked = rank(job, [
  { id: 'b', skills: ['Python', 'Pandas', 'Power BI'] },
  { id: 'a', skills: ['python', 'pandas', 'Power BI', 'machine learning'] },
  { id: 'c', skills: ['Docker'] },
])
expect(coverage(job, ['Python', 'Pandas', 'Power BI']).percent === 75, '18 75%')
expect(ranked.map((row) => row.person.id).join(',') === 'a,b,c', '17-19 100% ahead of 75% ahead of 0%')
expect(ranked.some((row) => row.person.id === 'c'), '19 zero-match remains eligible')

const searched = rank(job, [
  { id: 'a', skills: ['Power BI'] },
  { id: 'b', skills: ['Docker'] },
], 'powerbi')
expect(searched.length === 1 && searched[0]?.person.id === 'a', '21 canonical search')

const page = ranked.slice(1, 3)
expect(page.map((row) => row.person.id).join(',') === 'b,c', '22 pagination slice')

console.log('jobCoverage.check passed')
