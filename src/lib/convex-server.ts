import { ConvexHttpClient } from "convex/browser";

function convexSiteUrlFromDeploymentUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.endsWith(".convex.cloud")) {
      parsed.hostname = parsed.hostname.replace(/\.convex\.cloud$/, ".convex.site");
      return parsed.toString().replace(/\/$/, "");
    }
  } catch {
    return null;
  }
  return null;
}

export function getConvexHttpClient(): ConvexHttpClient {
  const url = process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    throw new Error(
      "CONVEX_URL or NEXT_PUBLIC_CONVEX_URL is not set. Run `bunx --bun convex dev` or configure Convex before using the backend.",
    );
  }
  return new ConvexHttpClient(url);
}

export function getConvexSiteUrl(): string {
  const explicit = process.env.CONVEX_SITE_URL ?? process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");

  const deploymentUrl = process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL;
  const inferred = deploymentUrl
    ? convexSiteUrlFromDeploymentUrl(deploymentUrl)
    : null;
  if (inferred) return inferred;

  throw new Error(
    "CONVEX_SITE_URL or NEXT_PUBLIC_CONVEX_SITE_URL is not set. Configure the Convex HTTP actions site URL before using ingestion.",
  );
}
