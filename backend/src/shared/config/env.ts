/** Parses the comma-separated FRONTEND_URL allowlist; undefined means "allow all". */
export function parseAllowedOrigins(raw: string | undefined): string[] | undefined {
  if (!raw) return undefined;
  const origins = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return origins.length > 0 ? origins : undefined;
}

export function parsePort(raw: string | undefined, fallback = 3000): number {
  const port = Number(raw);
  return Number.isInteger(port) && port > 0 ? port : fallback;
}
