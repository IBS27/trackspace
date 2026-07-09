import { describe, expect, it } from "vitest";

import { authorizeIngestRequest } from "./ingest-auth";

function requestWithAuth(header: string | null): Request {
  const headers = new Headers();
  if (header !== null) headers.set("authorization", header);
  return new Request("http://localhost/api/ingest", { headers });
}

describe("authorizeIngestRequest", () => {
  it("fails closed when the expected token is unset", () => {
    expect(
      authorizeIngestRequest(requestWithAuth("Bearer secret"), undefined),
    ).toBe(false);
  });

  it("rejects missing or malformed Authorization headers", () => {
    expect(authorizeIngestRequest(requestWithAuth(null), "secret")).toBe(false);
    expect(authorizeIngestRequest(requestWithAuth("secret"), "secret")).toBe(
      false,
    );
    expect(
      authorizeIngestRequest(requestWithAuth("Basic secret"), "secret"),
    ).toBe(false);
  });

  it("accepts an exact Bearer match and rejects mismatches", () => {
    expect(
      authorizeIngestRequest(requestWithAuth("Bearer secret"), "secret"),
    ).toBe(true);
    expect(
      authorizeIngestRequest(requestWithAuth("Bearer wrong"), "secret"),
    ).toBe(false);
    expect(
      authorizeIngestRequest(requestWithAuth("Bearer secre"), "secret"),
    ).toBe(false);
  });
});
