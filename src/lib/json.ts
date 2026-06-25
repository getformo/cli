export function parseJson(raw: string, flagName: string): unknown {
  try {
    return JSON.parse(raw) as unknown
  } catch {
    throw new Error(`${flagName} must be valid JSON`)
  }
}

export function parseJsonObject(
  raw: string,
  flagName: string,
): Record<string, unknown> {
  const parsed = parseJson(raw, flagName)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${flagName} must be a valid JSON object`)
  }
  return parsed as Record<string, unknown>
}

export function parseJsonArray(raw: string, flagName: string): unknown[] {
  const parsed = parseJson(raw, flagName)
  if (!Array.isArray(parsed)) {
    throw new Error(`${flagName} must be a valid JSON array`)
  }
  return parsed
}

export function parseJsonArrayOfObjects(
  raw: string,
  flagName: string,
): Record<string, unknown>[] {
  const parsed = parseJsonArray(raw, flagName)
  if (
    parsed.some(
      (item) => !item || typeof item !== 'object' || Array.isArray(item),
    )
  ) {
    throw new Error(`${flagName} must be a valid JSON array of objects`)
  }
  return parsed as Record<string, unknown>[]
}

export function parseStringArray(raw: string, flagName: string): string[] {
  const value = raw.trim()
  if (value.startsWith('[')) {
    const parsed = parseJsonArray(value, flagName)
    if (parsed.some((item) => typeof item !== 'string')) {
      throw new Error(`${flagName} must be a JSON array of strings`)
    }
    return parsed as string[]
  }

  const parts = value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
  if (parts.length === 0) {
    throw new Error(`${flagName} must contain at least one value`)
  }
  return parts
}
