import { clearIntentReady, clearIntentReadyFlags, INTENT_READY_KEY, isIntentReadyCached, markIntentReady } from './intentReady.ts'

function expect(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

const original = globalThis.sessionStorage
const store = new Map<string, string>()
const mock: Storage = {
  get length() {
    return store.size
  },
  clear() {
    store.clear()
  },
  getItem(key) {
    return store.has(key) ? store.get(key)! : null
  },
  key(index) {
    return [...store.keys()][index] ?? null
  },
  removeItem(key) {
    store.delete(key)
  },
  setItem(key, value) {
    store.set(key, String(value))
  },
}

Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: mock })

try {
  store.clear()
  store.set(INTENT_READY_KEY, '1')
  expect(!isIntentReadyCached('user-b'), 'TEST 1 legacy flag does not count for a different user id')
  markIntentReady('user-b')
  expect(isIntentReadyCached('user-b'), 'TEST 2 per-user flag is set')
  expect(store.get(INTENT_READY_KEY) == null, 'TEST 2 legacy flag cleared when marking per-user')
  clearIntentReadyFlags()
  expect(!isIntentReadyCached('user-b'), 'TEST 3 clear removes per-user flags')
  markIntentReady('user-c')
  expect(isIntentReadyCached('user-c'), 'TEST 4 per-user flag set again')
  clearIntentReady('user-c')
  expect(!isIntentReadyCached('user-c'), 'TEST 5 clearIntentReady removes one user')
  console.log('intent ready checks passed')
} finally {
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: original })
}
