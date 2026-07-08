import { DefaultChatTransport } from "ai";
import type { UIMessageStreamAgent } from "@workspace/agent-tui/index";
import { agent as localAgentForToolSchemas } from "./harness";
import type { HarnessMessage } from "./harness";

/**
 * A `UIMessageStreamAgent` backed by `apps/api`'s chat HTTP endpoints instead
 * of an in-process `HarnessAgent`. `@workspace/agent/harness`'s `agent` is
 * imported only for `agent.tools` — the tool *schemas* the terminal renderer
 * needs to render tool-call sections correctly. Nothing local is created: no
 * sandbox, no session, no execution.
 *
 * Unlike the generic AI SDK `Agent` interface, `UIMessageStreamAgent` (see
 * `@workspace/agent-tui`, vendored from `@ai-sdk/tui` specifically so this
 * interface could be added) hands the runner a `UIMessageChunk` stream
 * directly — exactly what `apps/api`'s endpoints already produce — with no
 * `TextStreamPart` round-trip in either direction.
 */
export function createRemoteHarnessAgent({
  baseUrl,
  chatId,
}: {
  baseUrl: string;
  chatId: string;
}): UIMessageStreamAgent {
  const transport = new DefaultChatTransport<HarnessMessage>({
    api: `${baseUrl}/api/chat/${chatId}`,
    // apps/api's chatMessageBodySchema expects `{ message: HarnessMessage }`
    // (only the newest turn — the server owns history), not the SDK's
    // default `{ messages: [...] }` full-history body.
    prepareSendMessagesRequest: ({ messages }) => ({
      body: { message: messages[messages.length - 1] },
    }),
  });

  return {
    tools: localAgentForToolSchemas.tools,
    async streamMessages({
      messages,
      abortSignal,
    }: {
      messages: HarnessMessage[];
      abortSignal?: AbortSignal;
    }) {
      const uiMessageStream = await transport.sendMessages({
        chatId,
        trigger: "submit-message",
        messageId: undefined,
        messages,
        abortSignal,
      });

      return { uiMessageStream };
    },
  };
}
