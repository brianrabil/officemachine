import { HarnessAgent } from "@ai-sdk/harness/agent";
import { createPi } from "@ai-sdk/harness-pi";
import { createJustBashSandbox } from "@ai-sdk/sandbox-just-bash";
import { InMemoryFs, MountableFs, ReadWriteFs } from "just-bash";
import type { InferUITools, UIMessage } from "ai";
import { config } from "./config";
import { model } from "./registry";
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
            root: config.HARNESS_DATA_DIR,
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
    model: `${model.provider}/${model.id}`,
    auth: {
      customEnv: {
        OPENCODE_API_KEY: config.OPENCODE_API_KEY,
        OPENCODE_BASE_URL: config.OPENCODE_BASE_URL,
      },
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

export type HarnessMessage = UIMessage<unknown, never, InferUITools<typeof agent.tools>>;
