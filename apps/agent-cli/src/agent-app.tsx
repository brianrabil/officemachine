import { useChat } from "@ai-sdk/react";
import {
  DirectChatTransport,
  getToolName,
  type InferAgentUIMessage,
  isFileUIPart,
  isReasoningUIPart,
  isTextUIPart,
  isToolUIPart,
  type LanguageModelUsage,
  lastAssistantMessageIsCompleteWithApprovalResponses,
  type ToolSet,
} from "ai";
import { Box, Text, useApp, useInput } from "ink";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";

import { type AgentRuntime, createAgentRuntime } from "./agent-runtime";
import { AppShell } from "./components/ui/app-shell";
import { ChatMessage } from "./components/ui/chat-message";
import { ChatThread } from "./components/ui/chat-thread";
import { ConversationHistory } from "./components/ui/conversation-history";
import { ErrorRetry } from "./components/ui/error-retry";
import { FileChange } from "./components/ui/file-change";
import { ModelSelector } from "./components/ui/model-selector";
import { StreamingText } from "./components/ui/streaming-text";
import { ThemeProvider } from "./components/ui/theme-provider";
import { ThinkingBlock } from "./components/ui/thinking-block";
import { ContextMeter, TokenUsage } from "./components/ui/token-usage";
import { ToolApproval } from "./components/ui/tool-approval";
import { ToolCall, type ToolCallStatus } from "./components/ui/tool-call";
import { vercelTheme } from "./lib/terminal-themes/vercel";
import { type CliOptions, type ConfiguredModelOption, configuredModelOptions } from "./options";
import { createLanguageModel } from "./provider-registry";

type AgentMessageMetadata = {
  usage?: LanguageModelUsage;
};

type AgentMessage = InferAgentUIMessage<AgentRuntime, AgentMessageMetadata>;
type AgentMessagePart = AgentMessage["parts"][number];

const toolInputSchema = z.record(z.string(), z.unknown());
const writeFileInputSchema = z.object({
  content: z.string(),
  path: z.string(),
});

const configuredModelFor = (id: string): ConfiguredModelOption => {
  const model = configuredModelOptions.find((entry) => entry.id === id);
  if (!model) {
    throw new Error(`Model is not configured: ${id}`);
  }
  return model;
};

const errorFromUnknown = (error: unknown): Error => {
  if (error instanceof Error) {
    return error;
  }
  throw error;
};

const toolStatus = (
  state: Extract<AgentMessagePart, { state: string }>["state"],
): ToolCallStatus => {
  switch (state) {
    case "input-streaming":
    case "input-available":
      return "running";
    case "approval-requested":
    case "approval-responded":
      return "pending";
    case "output-available":
      return "success";
    case "output-denied":
    case "output-error":
      return "error";
  }
};

const MessagePart = ({
  addToolApprovalResponse,
  part,
}: {
  addToolApprovalResponse: ReturnType<typeof useChat<AgentMessage>>["addToolApprovalResponse"];
  part: AgentMessagePart;
}) => {
  if (isTextUIPart(part)) {
    return <StreamingText cursor={part.state === "streaming"} text={part.text} />;
  }

  if (isReasoningUIPart(part)) {
    return <ThinkingBlock content={part.text} streaming={part.state === "streaming"} />;
  }

  if (isFileUIPart(part)) {
    return (
      <Text dimColor color={vercelTheme.colors.mutedForeground}>
        {part.url} {part.mediaType}
      </Text>
    );
  }

  if (!isToolUIPart(part)) {
    return null;
  }

  const name = getToolName(part);
  const args =
    part.state === "input-streaming" && part.input === undefined
      ? undefined
      : toolInputSchema.parse(part.input);
  const writeFileInput =
    name === "writeFile" && args ? writeFileInputSchema.parse(args) : undefined;

  if (part.state === "approval-requested") {
    return (
      <Box flexDirection="column">
        {writeFileInput && (
          <FileChange
            changes={[
              {
                content: writeFileInput.content,
                path: writeFileInput.path,
                type: "modify",
              },
            ]}
          />
        )}
        <ToolApproval
          args={args}
          name={name}
          onApprove={() => {
            void addToolApprovalResponse({
              approved: true,
              id: part.approval.id,
            });
          }}
          onDeny={() => {
            void addToolApprovalResponse({
              approved: false,
              id: part.approval.id,
            });
          }}
        />
      </Box>
    );
  }

  if (part.state === "output-available") {
    return (
      <Box flexDirection="column">
        {writeFileInput && (
          <FileChange
            changes={[
              {
                content: writeFileInput.content,
                path: writeFileInput.path,
                type: "modify",
              },
            ]}
          />
        )}
        <ToolCall args={args} name={name} result={part.output} status={toolStatus(part.state)} />
      </Box>
    );
  }

  return (
    <ToolCall
      args={args}
      name={name}
      result={part.state === "output-error" ? part.errorText : undefined}
      status={toolStatus(part.state)}
    />
  );
};

const Message = ({
  addToolApprovalResponse,
  message,
}: {
  addToolApprovalResponse: ReturnType<typeof useChat<AgentMessage>>["addToolApprovalResponse"];
  message: AgentMessage;
}) => (
  <ChatMessage sender={message.role}>
    <Box flexDirection="column">
      {message.parts.map((part, index) => (
        <MessagePart
          // biome-ignore lint/suspicious/noArrayIndexKey: UIMessage text and reasoning parts do not expose stable ids.
          key={`${message.id}:${part.type}:${index}`}
          addToolApprovalResponse={addToolApprovalResponse}
          part={part}
        />
      ))}
    </Box>
  </ChatMessage>
);

const AgentChat = ({
  activeModel,
  cwd,
  modelSelectorOpen,
  onModelSelected,
  openModelSelector,
  runtime,
}: {
  activeModel: ConfiguredModelOption;
  cwd: string;
  modelSelectorOpen: boolean;
  onModelSelected: (id: string) => void;
  openModelSelector: () => void;
  runtime: AgentRuntime;
}) => {
  const inkApp = useApp();
  const [input, setInput] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const transport = useMemo(
    () =>
      new DirectChatTransport<never, ToolSet, never, AgentMessage>({
        agent: runtime,
        messageMetadata: ({ part }) =>
          part.type === "finish" ? { usage: part.totalUsage } : undefined,
      }),
    [runtime],
  );
  const {
    addToolApprovalResponse,
    clearError,
    error,
    messages,
    regenerate,
    sendMessage,
    status,
    stop,
  } = useChat<AgentMessage>({
    id: `agent-cli:${activeModel.id}`,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
    transport,
  });

  const busy = status === "submitted" || status === "streaming";
  const hasPendingApproval = messages.some((message) =>
    message.parts.some((part) => isToolUIPart(part) && part.state === "approval-requested"),
  );
  const latestUsage = messages.findLast((message) => message.metadata?.usage)?.metadata?.usage;

  useInput((inputText, key) => {
    if (key.ctrl && inputText === "c") {
      void stop();
      inkApp.exit();
    }
  });

  const send = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || busy || hasPendingApproval) {
      return;
    }
    if (trimmed === "/exit" || trimmed === "exit") {
      void stop();
      inkApp.exit();
      return;
    }
    if (trimmed === "/model") {
      openModelSelector();
      setInput("");
      return;
    }

    clearError();
    setRetryCount(0);
    setInput("");
    void sendMessage({ text: trimmed });
  };

  return (
    <AppShell fullscreen>
      <AppShell.Header>
        <Box flexDirection="column">
          <Box gap={2}>
            <Text bold color={vercelTheme.colors.foreground}>
              agent-cli
            </Text>
            <Text dimColor color={vercelTheme.colors.mutedForeground}>
              {cwd}
            </Text>
          </Box>
          <Box gap={2}>
            <Text color={vercelTheme.colors.primary}>
              {activeModel.provider} · {activeModel.model}
            </Text>
            {latestUsage?.inputTokens !== undefined && latestUsage.outputTokens !== undefined && (
              <TokenUsage
                completion={latestUsage.outputTokens}
                model={activeModel.model}
                prompt={latestUsage.inputTokens}
              />
            )}
            {latestUsage?.outputTokenDetails.reasoningTokens !== undefined && (
              <Text dimColor color={vercelTheme.colors.mutedForeground}>
                reasoning {latestUsage.outputTokenDetails.reasoningTokens}
              </Text>
            )}
          </Box>
          {latestUsage?.totalTokens !== undefined && (
            <ContextMeter
              label="context"
              limit={activeModel.context}
              used={latestUsage.totalTokens}
            />
          )}
          {modelSelectorOpen && (
            <ModelSelector
              groupByProvider
              models={configuredModelOptions}
              onSelect={onModelSelected}
              selected={activeModel.id}
            />
          )}
        </Box>
        <AppShell.Tip>
          {hasPendingApproval
            ? "Approve or deny the pending tool call"
            : modelSelectorOpen
              ? "Select a model"
              : "Enter a prompt, /model, or /exit"}
        </AppShell.Tip>
      </AppShell.Header>

      <AppShell.Content autoscroll height={18}>
        <ConversationHistory isActive={!busy} maxHeight={18}>
          <ChatThread autoScroll maxHeight={18}>
            {messages.map((message) => (
              <Message
                key={message.id}
                addToolApprovalResponse={addToolApprovalResponse}
                message={message}
              />
            ))}
            {status === "submitted" && (
              <ChatMessage sender="assistant" streaming>
                <StreamingText cursor text="" />
              </ChatMessage>
            )}
          </ChatThread>
        </ConversationHistory>
      </AppShell.Content>

      {error && (
        <ErrorRetry
          error={error}
          isActive={!busy}
          onDismiss={clearError}
          onRetry={() => {
            clearError();
            setRetryCount((current) => current + 1);
            void regenerate();
          }}
          retryCount={retryCount}
        />
      )}

      <AppShell.Input
        borderColor={vercelTheme.colors.border}
        onChange={setInput}
        onSubmit={send}
        placeholder={busy ? "Waiting for model..." : "Ask agent-cli..."}
        prefix=">"
        value={input}
      />
      <AppShell.Hints
        items={[
          "enter submit",
          "ctrl-c exit",
          "/model switch",
          hasPendingApproval ? "y/n approval" : "↑↓ scroll",
        ]}
      />
    </AppShell>
  );
};

export const AgentApp = ({ options }: { options: CliOptions }) => {
  const initialModelId = `${options.provider}:${options.model}`;
  const [runtime, setRuntime] = useState<AgentRuntime>();
  const [startupError, setStartupError] = useState<Error>();
  const [modelSelectorOpen, setModelSelectorOpen] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState(initialModelId);
  const activeModel = configuredModelFor(selectedModelId);

  useEffect(() => {
    let active = true;
    const languageModel = createLanguageModel({
      model: activeModel.model,
      provider: activeModel.providerName,
    });

    setRuntime(undefined);
    setStartupError(undefined);

    void createAgentRuntime({
      cwd: options.cwd,
      maxSteps: options.maxSteps,
      model: languageModel,
      skillsDirectory: options.skillsDirectory,
    })
      .then((nextRuntime) => {
        if (active) {
          setRuntime(nextRuntime);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setStartupError(errorFromUnknown(error));
        }
      });

    return () => {
      active = false;
    };
  }, [activeModel, options.cwd, options.maxSteps, options.skillsDirectory]);

  return (
    <ThemeProvider theme={vercelTheme}>
      {startupError && (
        <AppShell fullscreen>
          <AppShell.Header>
            <Text bold color={vercelTheme.colors.foreground}>
              agent-cli
            </Text>
          </AppShell.Header>
          <ErrorRetry error={startupError} />
        </AppShell>
      )}
      {!startupError && !runtime && (
        <AppShell fullscreen>
          <AppShell.Header>
            <Text bold color={vercelTheme.colors.foreground}>
              agent-cli
            </Text>
          </AppShell.Header>
          <ChatMessage sender="system" streaming>
            Starting agent runtime
          </ChatMessage>
        </AppShell>
      )}
      {!startupError && runtime && (
        <AgentChat
          activeModel={activeModel}
          cwd={options.cwd}
          modelSelectorOpen={modelSelectorOpen}
          onModelSelected={(id) => {
            configuredModelFor(id);
            setSelectedModelId(id);
            setModelSelectorOpen(false);
          }}
          openModelSelector={() => setModelSelectorOpen(true)}
          runtime={runtime}
        />
      )}
    </ThemeProvider>
  );
};
