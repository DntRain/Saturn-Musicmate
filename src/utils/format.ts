export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatMs(ms: number): string {
  return formatTime(ms / 1000);
}

export function trackKey(t: { path: string }) {
  return t.path;
}
