import { skillsMatch, skillDisplayName } from './skillCanonical.ts'
import { dedupeSkills } from './skills.ts'

function expect(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

// A
expect(skillsMatch('Python', 'python'), 'A Python ↔ python')
expect(skillDisplayName('python') === 'Python', 'A display')

// B
expect(skillsMatch('ML', 'Machine Learning'), 'B ML ↔ Machine Learning')
expect(skillsMatch('M.L.', 'Machine Learning'), 'B M.L.')

// C
expect(skillsMatch('Machine-Learning', 'Machine Learning'), 'C hyphen')
expect(skillsMatch(' MACHINE LEARNING ', 'machine learning'), 'C whitespace')

// D — explicit resume variant
expect(skillsMatch('Machine Learning Algorithms', 'Machine Learning'), 'D algorithms variant')
expect(skillDisplayName('Machine Learning Algorithms') === 'Machine Learning', 'D display')

// E
expect(skillsMatch('PowerBI', 'Power BI'), 'E PowerBI')

// F
expect(skillsMatch('sklearn', 'Scikit-learn'), 'F sklearn')
expect(skillsMatch('scikit learn', 'scikit-learn'), 'F spaced')

// G
expect(!skillsMatch('Python', 'PyTorch'), 'G Python ≠ PyTorch')

// H
expect(!skillsMatch('Machine Learning', 'Deep Learning'), 'H ML ≠ Deep Learning')

// I
expect(!skillsMatch('Power BI', 'Tableau'), 'I Power BI ≠ Tableau')

// Duplicates collapse to one canonical label
expect(
  JSON.stringify(dedupeSkills(['Python', 'python', 'PYTHON', 'Python 3', 'Python3'])) ===
    JSON.stringify(['Python']),
  'python variants dedupe',
)

console.log('skill canonical checks passed')
