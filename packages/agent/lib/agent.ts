import { HarnessAgent } from "@ai-sdk/harness/agent";
import { createPi } from "@ai-sdk/harness-pi";
import { createJustBashSandbox } from "@ai-sdk/sandbox-just-bash";
import { InMemoryFs, MountableFs, ReadWriteFs } from "just-bash";
import type { InferUITools, UIMessage } from "ai";
import { z } from "zod";
import { config } from "@workspace/config";
import type { HarnessV1SandboxProvider } from "@ai-sdk/harness";

const sandbox: HarnessV1SandboxProvider = {
  ...createJustBashSandbox({
    cwd: "/workspace",
    fs: new MountableFs({
      base: new InMemoryFs(),
      mounts: [
        {
          mountPoint: "/workspace",
          filesystem: new ReadWriteFs({
            root: process.cwd(),
          }),
        },
      ],
    }),
    defenseInDepth: false,
    network: {
      dangerouslyAllowFullInternetAccess: true,
    },
  }),
  resumeSession: (o) => sandbox.createSession(o),
};

export const agent = new HarnessAgent({
  id: "agent-1",
  harness: createPi({
    model: `${config.DEFAULT_PROVIDER}/${config.DEFAULT_MODEL}`,
    auth: {
      customEnv: config.OPENCODE_API_KEY
        ? {
            OPENCODE_API_KEY: config.OPENCODE_API_KEY,
            OPENCODE_BASE_URL: config.OPENCODE_BASE_URL,
          }
        : {},
    },
  }),
  sandbox,
  sandboxConfig: {
    workDir: "./",
    async onSession({ session, sessionWorkDir }) {
      await session.writeTextFile({
        path: `${sessionWorkDir}/.pi-sessions/.keep`,
        content: "",
      });
    },
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
