import { HarnessAgent } from "@ai-sdk/harness/agent";
import { createPi } from "@ai-sdk/harness-pi";
import { createJustBashSandbox } from "@ai-sdk/sandbox-just-bash";
import { ReadWriteFs } from "just-bash";
import { config } from "./config";
import { getBuiltinModel } from "@earendil-works/pi-ai/providers/all";
import type { InferUITools, UIMessage } from "ai";
import path from "node:path";

const model = getBuiltinModel("opencode-go", "deepseek-v4-flash");
const workspaceRoot = path.resolve(process.cwd(), ".harness-workspace");

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
  sandbox: createJustBashSandbox({
    fs: new ReadWriteFs({ root: workspaceRoot }),
    cwd: "/",
    defenseInDepth: {
      excludeViolationTypes: ["dynamic_import_builtin"],
    },
  }),
  sandboxConfig: {
    workDir: "./",
  },
});

export type HarnessMessage = UIMessage<unknown, never, InferUITools<typeof agent.tools>>;
