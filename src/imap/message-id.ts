export function normalizeMessageId(value: string): string {
  return value.replace(/[<>\s]/g, '').trim().toLowerCase();
}

export function makeMessageIdCandidates(value: string): string[] {
  const normalized = normalizeMessageId(value);
  if (!normalized) {
    return [];
  }

  const withAngles = `<${normalized}>`;
  return Array.from(new Set([value.trim(), normalized, withAngles]));
}
