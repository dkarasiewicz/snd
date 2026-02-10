export function formatRelativeTime(timestampMs: number, nowMs = Date.now()): string {
  const deltaSec = Math.max(0, Math.floor((nowMs - timestampMs) / 1000));
  if (deltaSec < 60) {
    return `${deltaSec}s ago`;
  }

  const minutes = Math.floor(deltaSec / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
