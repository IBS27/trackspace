import { ConvexHttpClient } from "convex/browser";

export function getConvexHttpClient(): ConvexHttpClient {
  const url = process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    throw new Error(
      "CONVEX_URL or NEXT_PUBLIC_CONVEX_URL is not set. Run `npx convex dev` or configure Convex before using the backend.",
    );
  }
  return new ConvexHttpClient(url);
}
