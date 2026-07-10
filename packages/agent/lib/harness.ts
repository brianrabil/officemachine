import { HarnessAgent } from "@ai-sdk/harness/agent";
import type { InferUITools, UIMessage } from "ai";
import { z } from "zod";
import { createAppleContainer } from "@workspace/apple-sandbox/index";
import { pi } from "./pi-harness";

export const agent = new HarnessAgent({
  harness: pi,
  sandbox: createAppleContainer({
    image: "officemachine/apple-sandbox:latest",
    cwd: "/workspace",
    ssh: true,
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
