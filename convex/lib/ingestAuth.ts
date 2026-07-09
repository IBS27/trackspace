/** Constant-time string compare for Convex's default (non-Node) runtime. */
function timingSafeEqualString(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  const length = Math.max(left.length, right.length);
  let mismatch = left.length ^ right.length;
  for (let i = 0; i < length; i++) {
    mismatch |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }
  return mismatch === 0;
}

/** Constant-time Bearer token check. Fails closed when the expected token is unset. */
export function authorizeIngestRequest(
  request: Request,
  expectedToken: string | undefined,
): boolean {
  if (!expectedToken) return false;

  const header = request.headers.get("authorization");
  if (!header) return false;

  const prefix = "Bearer ";
  if (!header.startsWith(prefix)) return false;

  return timingSafeEqualString(header.slice(prefix.length), expectedToken);
}
