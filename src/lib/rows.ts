export function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null) return null
  return value as Record<string, unknown>
}

export function readString(row: Record<string, unknown>, key: string) {
  const value = row[key]
  return typeof value === 'string' ? value : null
}

export function readNumber(row: Record<string, unknown>, key: string) {
  const value = row[key]
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

export function readBoolean(row: Record<string, unknown>, key: string) {
  const value = row[key]
  return typeof value === 'boolean' ? value : null
}

export function readNullableString(row: Record<string, unknown>, key: string) {
  const value = row[key]
  if (value === null) return null
  return typeof value === 'string' ? value : null
}
