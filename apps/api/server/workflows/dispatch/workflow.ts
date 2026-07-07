import { loadResumeStep, persistResumeStep } from "./steps/resume-store";
import { persistMessage } from "./steps/persist-message";
import { runSlice } from "./steps/run-slice";
import {
  createHarnessWorkflowState,
  finalizeHarnessWorkflow,
  type HarnessWorkflowInput,
} from "@ai-sdk/workflow-harness";
import type { HarnessMessage } from "@workspace/agent/harness";

export async function dispatchWorkflow(
  input: Pick<HarnessWorkflowInput, "prompt" | "sessionId"> & { userMessage: HarnessMessage },
) {
  "use workflow";

  // 1. Perist Message
  await persistMessage({
    chatId: input.sessionId,
    message: input.userMessage,
  });

  const resumeFrom = await loadResumeStep(input.sessionId);

  let state = createHarnessWorkflowState({
    prompt: input.prompt,
    sessionId: input.sessionId,
    resumeFrom,
  });

  while (state.status === "running" || state.status === "timed_out") {
    state = await runSlice(state);
  }

  await persistResumeStep({
    sessionId: state.sessionId,
    resumeState: state.resumeFrom,
  });

  return finalizeHarnessWorkflow(state);
}
