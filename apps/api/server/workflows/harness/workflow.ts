import { loadResumeStep, persistResumeStep } from "./resume-store";
import { runSlice } from "./run-slice-step";
import {
  createHarnessWorkflowState,
  finalizeHarnessWorkflow,
  type HarnessWorkflowInput,
} from "@ai-sdk/workflow-harness";

export async function harnessWorkflow(input: Pick<HarnessWorkflowInput, "prompt" | "sessionId">) {
  "use workflow";

  const resumeFrom = await loadResumeStep(input.sessionId);
  let state = createHarnessWorkflowState({ ...input, resumeFrom });

  while (state.status === "running" || state.status === "timed_out") {
    state = await runSlice(state);
  }

  await persistResumeStep({
    sessionId: state.sessionId,
    resumeState: state.resumeFrom,
    prompt: input.prompt,
  });

  return finalizeHarnessWorkflow(state);
}
