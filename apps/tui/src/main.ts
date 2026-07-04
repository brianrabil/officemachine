import { HarnessAgent, type HarnessAgentSession } from "@ai-sdk/harness/agent";
import { runAgentTUI, type AgentTUIAgent } from "@ai-sdk/tui";
import { agent } from "@workspace/harness/agent";

function createTUIAgent({
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
      } as Parameters<typeof agent.generate>[0]);
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
    title: "Codex",
    agent: createTUIAgent({ agent, session }),
    tools: "auto-collapsed",
    reasoning: "collapsed",
  });
} finally {
  await session.destroy();
}
