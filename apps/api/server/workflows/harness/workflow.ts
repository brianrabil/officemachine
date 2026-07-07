import { harnessMessageHook, harnessHookToken } from "./hooks/harness-message";
import { extractPrompt } from "./steps/extract-prompt";
import { runSlice } from "./steps/run-slice";
import { persistMessage } from "./steps/persist-message";
import { createHarnessWorkflowState } from "@ai-sdk/workflow-harness";
import type { HarnessV1ResumeSessionState } from "@ai-sdk/harness";
import type { HarnessMessage } from "@workspace/agent/harness";

export async function harnessWorkflow(input: { sessionId: string; message: HarnessMessage }) {
  "use workflow";

  using hook = harnessMessageHook.create({
    token: harnessHookToken(input.sessionId),
  });

  let nextMessage: HarnessMessage | undefined = input.message;
  let resumeFrom: HarnessV1ResumeSessionState | undefined;

  while (nextMessage) {
    await persistMessage({ chatId: input.sessionId, message: nextMessage });

    const prompt = await extractPrompt(nextMessage);
    if (!prompt) break;

    let state = createHarnessWorkflowState({ prompt, sessionId: input.sessionId, resumeFrom });

    while (state.status === "running" || state.status === "timed_out") {
      state = await runSlice(state);
    }

    if (state.status !== "failed") {
      resumeFrom = state.resumeFrom;
    }

    const payload = await hook;
    if ("end" in payload) break;
    nextMessage = payload.message;
  }

  return { sessionId: input.sessionId };
}
