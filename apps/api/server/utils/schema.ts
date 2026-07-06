import { z } from "zod";

// ---- Shared ----

export const idParamsSchema = z.object({ id: z.string().min(1) });

// ---- Chat ----

// Mirrors @workspace/agent/agent's messageMetadataSchema. Not imported
// directly — that module also constructs the live harness sandbox at import
// time, which would run on every route that just needs this tiny shape.
const harnessMessageMetadataSchema = z.object({
  createdAt: z.number().optional(),
  provider: z.string().optional(),
  modelId: z.string().optional(),
});

export const harnessMessageSchema = z.object({
  id: z.string(),
  role: z.enum(["system", "user", "assistant"]),
  metadata: harnessMessageMetadataSchema.optional(),
  parts: z.array(z.record(z.string(), z.unknown())),
});

export const chatMessageBodySchema = z.object({
  message: harnessMessageSchema,
});

export const chatStreamQuerySchema = z.object({
  startIndex: z.coerce.number().int().nonnegative().optional(),
});

export const chatSummarySchema = z.object({
  id: z.string(),
  createdAt: z.number(),
  messageCount: z.number(),
  lastMessageAt: z.number().nullable(),
});
export type ChatSummary = z.infer<typeof chatSummarySchema>;

// ---- Providers ----

export const providerModelInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  api: z.string(),
  reasoning: z.boolean(),
  input: z.array(z.enum(["text", "image"])),
  contextWindow: z.number(),
  maxTokens: z.number(),
  cost: z.object({
    input: z.number(),
    output: z.number(),
    cacheRead: z.number(),
    cacheWrite: z.number(),
  }),
  gateway: z
    .object({
      pricing: z
        .object({
          input: z.string(),
          output: z.string(),
          cachedInputTokens: z.string().optional(),
          cacheCreationInputTokens: z.string().optional(),
        })
        .nullable(),
      description: z.string().nullable(),
      modelType: z
        .enum([
          "embedding",
          "image",
          "language",
          "realtime",
          "reranking",
          "speech",
          "transcription",
          "video",
        ])
        .nullable(),
    })
    .optional(),
});
export type ProviderModelInfo = z.infer<typeof providerModelInfoSchema>;

export const providerInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  models: z.array(providerModelInfoSchema),
});
export type ProviderInfo = z.infer<typeof providerInfoSchema>;
