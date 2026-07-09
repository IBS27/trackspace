import { timingSafeEqual } from "node:crypto";

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

  const provided = header.slice(prefix.length);
  const expected = Buffer.from(expectedToken);
  const actual = Buffer.from(provided);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}
