import { HarnessAgent } from "@ai-sdk/harness/agent";
import { createPi } from "@ai-sdk/harness-pi";
import type { InferUITools, UIMessage } from "ai";
import { env } from "@workspace/config/env";
import { settings } from "@workspace/config/settings";
import { z } from "zod";
import { createJustBashSandbox } from "@ai-sdk/sandbox-just-bash";
import { InMemoryFs, MountableFs, ReadWriteFs } from "just-bash";
import type { HarnessV1SandboxProvider } from "@ai-sdk/harness";
import path from "node:path";

export const workspaceDrive = new MountableFs({
  base: new ReadWriteFs({ root: process.cwd() }),
  mounts: [
    {
      mountPoint: "/.pi-sessions",
      filesystem: new ReadWriteFs({
        root: path.join(env.APP_CONFIG_DIR, "sessions"),
      }),
    },
  ],
});

export const drive = new MountableFs({
  base: new InMemoryFs(),
  mounts: [
    {
      mountPoint: "/workspace",
      filesystem: workspaceDrive,
    },
  ],
});

export const sandbox: HarnessV1SandboxProvider = {
  ...createJustBashSandbox({
    cwd: "/workspace",
    fs: drive,
    defenseInDepth: false,
    network: {
      dangerouslyAllowFullInternetAccess: true,
    },
  }),
  resumeSession: (o) => sandbox.createSession(o),
};

export const agent = new HarnessAgent({
  id: "zero-harness",
  harness: createPi({
    model: `${settings.defaultProvider}/${settings.defaultModel}`,
    auth: {
      customEnv: env.OPENCODE_API_KEY
        ? {
            OPENCODE_API_KEY: env.OPENCODE_API_KEY,
            OPENCODE_BASE_URL: env.OPENCODE_BASE_URL,
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
