import { accountDeletionConfirmed } from './deletion.ts'

function expect(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

expect(accountDeletionConfirmed('DELETE'), 'exact confirmation is accepted')
expect(accountDeletionConfirmed('  DELETE  '), 'trimmed confirmation is accepted')
expect(!accountDeletionConfirmed('delete'), 'lowercase is not enough')
expect(!accountDeletionConfirmed(''), 'empty confirmation is rejected')
expect(!accountDeletionConfirmed('DELETE ACCOUNT'), 'partial phrase is rejected')

console.log('account deletion checks passed')
