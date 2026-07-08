import { HarnessAgent } from "@ai-sdk/harness/agent";
import { createOpenCode } from "@ai-sdk/harness-opencode";
import type { InferUITools, UIMessage } from "ai";
import { env } from "@workspace/config/env";
import { settings } from "@workspace/config/settings";
import { z } from "zod";
import { createAppleContainer } from "@workspace/apple-sandbox/index";

export const agent = new HarnessAgent({
  harness: createOpenCode({
    model: settings.defaultModel,
    auth: {
      openaiCompatible: {
        apiKey: env.OPENCODE_API_KEY,
        baseUrl: env.OPENCODE_BASE_URL,
      },
    },
  }),
  sandbox: createAppleContainer({
    image: "officemachine/apple-sandbox:latest",
    cwd: "/workspace",
    ssh: true,
    ports: [4096],
    mounts: [{ source: process.cwd(), target: "/workspace" }],
  }),
  sandboxConfig: {
    workDir: "./",
  },
});

export const messageMetadataSchema = z.object({
  createdAt: z.number().optional(),
  provider: z.string().optional(),
  modelId: z.string().optional(),
});

export type HarnessMessageMetadata = z.infer<typeof messageMetadataSchema>;

export type HarnessMessage = UIMessage<
  HarnessMessageMetadata,
  never,
  InferUITools<typeof agent.tools>
>;
