import { runAgentTUI } from "@ai-sdk/tui";
import { HarnessAgent, HarnessAgentSession } from "@ai-sdk/harness/agent";
import { type AgentTUIAgent } from "@ai-sdk/tui";
import { createJustBashSandbox } from "@ai-sdk/sandbox-just-bash";
import { createPi } from "@ai-sdk/harness-pi";
import { config } from "./config";
import { getBuiltinModel } from "@earendil-works/pi-ai/providers/all";

const model = getBuiltinModel("opencode-go", "deepseek-v4-flash");

export const agent = new HarnessAgent({
  id: "agent-1",
  harness: createPi({
    model: `${model.provider}/${model.name}`,
    auth: {
      customEnv: {
        OPENCODE_API_KEY: config.OPENCODE_API_KEY,
        OPENCODE_BASE_URL: config.OPENCODE_BASE_URL,
      },
    },
  }),
  sandbox: createJustBashSandbox({
    overlayRoot: ".",
  }),
  sandboxConfig: {
    workDir: "./",
  },
});

export function createTUIAgent({
  agent,
  session,
}: {
  agent: HarnessAgent<any, any, any>;
  session: HarnessAgentSession;
}): AgentTUIAgent {
  return {
    version: "agent-v1",
    id: agent.id,
    tools: agent.tools,
    generate(request) {
      return agent.generate({
        ...request,
        session,
      } satisfies Parameters<typeof agent.generate>[0]);
    },
    stream(request) {
      return agent.stream({
        ...request,
        session,
      } satisfies Parameters<typeof agent.stream>[0]);
    },
  } satisfies AgentTUIAgent;
}

const session = await agent.createSession({
  sessionId: "test-1",
});

try {
  await runAgentTUI({
    title: "Pi",
    agent: createTUIAgent({ agent, session }),
    tools: "auto-collapsed",
    reasoning: "auto-collapsed",
  });
} finally {
  await session.destroy();
}
