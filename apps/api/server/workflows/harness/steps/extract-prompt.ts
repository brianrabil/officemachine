import type { HarnessV1Prompt } from "@ai-sdk/harness";
import type { HarnessMessage } from "@workspace/agent/agent";

export async function extractPrompt(message: HarnessMessage): Promise<HarnessV1Prompt | undefined> {
  "use step";

  const { convertToModelMessages } = await import("ai");
  const { latestUserMessage } = await import("@workspace/agent/utils");

  return latestUserMessage(await convertToModelMessages([message]));
}
