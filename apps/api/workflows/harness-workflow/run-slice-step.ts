import { runHarnessAgentSlice, type HarnessWorkflowState } from "@ai-sdk/workflow-harness";

export async function runSlice(state: HarnessWorkflowState): Promise<HarnessWorkflowState> {
  "use step";

  const { agent } = await import("@workspace/agent/agent");

  return runHarnessAgentSlice({
    agent,
    state,
  });
}
