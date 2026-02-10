const QUOTE_MARKERS = [
  /^\s*>/,
  /^\s*-{2,}\s*original message\s*-{2,}\s*$/i,
  /^\s*on\s+.+wrote:\s*$/i,
  /^\s*from:\s+/i,
  /^\s*sent:\s+/i,
  /^\s*to:\s+/i,
  /^\s*subject:\s+/i,
];

const SIGNATURE_MARKERS = [
  /^\s*--\s*$/,
  /^\s*sent from my /i,
  /^\s*best,?\s*$/i,
  /^\s*regards,?\s*$/i,
  /^\s*thanks,?\s*$/i,
  /^\s*cheers,?\s*$/i,
];

function normalize(input: string): string {
  return input.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function squashBlankLines(lines: string[]): string[] {
  const out: string[] = [];
  let blankRun = 0;

  for (const line of lines) {
    const trimmed = line.trimEnd();
    if (trimmed.length === 0) {
      blankRun += 1;
      if (blankRun > 1) {
        continue;
      }
      out.push('');
      continue;
    }

    blankRun = 0;
    out.push(trimmed);
  }

  while (out.length > 0 && out[out.length - 1] === '') {
    out.pop();
  }

  return out;
}

function stripQuoted(lines: string[]): string[] {
  const out: string[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? '';

    if (QUOTE_MARKERS.some((pattern) => pattern.test(line))) {
      break;
    }

    out.push(line);
  }

  return out;
}

function stripSignature(lines: string[]): string[] {
  const windowStart = Math.max(0, lines.length - 10);
  for (let i = lines.length - 1; i >= windowStart; i -= 1) {
    const line = lines[i] ?? '';

    if (!SIGNATURE_MARKERS.some((pattern) => pattern.test(line))) {
      continue;
    }

    return lines.slice(0, i);
  }

  return lines;
}

export function cleanEmailBody(input: string): string {
  const normalized = normalize(input).trim();
  if (!normalized) {
    return '';
  }

  const baseLines = normalized.split('\n').map((line) => line.replace(/\t/g, '  '));
  const withoutQuotes = stripQuoted(baseLines);
  const withoutSignature = stripSignature(withoutQuotes);
  const compact = squashBlankLines(withoutSignature).join('\n').trim();

  if (compact.length > 0) {
    return compact;
  }

  // If heuristics over-strip, keep a conservative fallback slice of the original.
  return normalize(input).split('\n').slice(0, 12).join('\n').trim();
}
