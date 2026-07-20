import { defineApp } from "convex/server";
import { v } from "convex/values";

export default defineApp({
  env: {
    INGEST_TOKEN: v.optional(v.string()),
    OPENAI_API_KEY: v.string(),
  },
});
