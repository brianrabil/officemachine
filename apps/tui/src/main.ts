import { runAgentTUI } from "@ai-sdk/tui";
import { HarnessAgent, HarnessAgentSession } from "@ai-sdk/harness/agent";
import { type AgentTUIAgent } from "@ai-sdk/tui";
import { agent } from "@workspace/agent/agent";

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

const session = await agent.createSession();

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
