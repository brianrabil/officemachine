import { runHarnessAgentSlice, type HarnessWorkflowState } from "@ai-sdk/workflow-harness";
import { useDatabase } from "nitro/database";
import type { UIMessageChunk } from "ai";
import type { HarnessMessage } from "@workspace/agent/agent";

export async function runSlice(state: HarnessWorkflowState): Promise<HarnessWorkflowState> {
  "use step";

  const { agent } = await import("@workspace/agent/agent");
  const { getWritable } = await import("workflow");
  const { readUIMessageStream } = await import("ai");

  // runHarnessAgentSlice only forwards chunks to the workflow's output stream —
  // it never assembles a full message, so there's nothing in its return value
  // to persist. Tee its writable: one branch still reaches the client
  // unchanged, the other gets reassembled into a full message via
  // readUIMessageStream so we can persist exactly what the harness produced.
  const transform = new TransformStream<UIMessageChunk, UIMessageChunk>();
  const [forClient, forCapture] = transform.readable.tee();

  const forwardPromise = forClient.pipeTo(getWritable<UIMessageChunk>());
  const capturePromise = (async () => {
    let final: HarnessMessage | undefined;
    for await (const message of readUIMessageStream<HarnessMessage>({ stream: forCapture })) {
      final = message;
    }
    return final;
  })();

  const result = await runHarnessAgentSlice({
    agent,
    state,
    writable: transform.writable,
  });

  const [, finalMessage] = await Promise.all([forwardPromise, capturePromise]);

  // Only a slice that finishes the turn in one shot yields a full message this
  // way — a slice that times out and continues in the next one only captures
  // that slice's partial content, since each slice's capture stream is
  // independent. Fine for the common case; a timed-out multi-slice turn would
  // need cross-slice accumulation to persist correctly, which this doesn't do.
  if (result.status === "finished" && finalMessage) {
    const db = useDatabase();
    await db.sql`
      INSERT INTO messages (id, chat_id, role, parts)
      VALUES (${finalMessage.id}, ${result.sessionId}, ${finalMessage.role}, ${JSON.stringify(finalMessage.parts)})
    `;
  }

  return result;
}
