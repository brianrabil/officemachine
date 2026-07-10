import { useChat } from "@ai-sdk/react";
import { WorkflowChatTransport } from "@ai-sdk/workflow";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CircleAlertIcon,
  LoaderCircleIcon,
  SparklesIcon,
} from "lucide-react";
import { videoEditorContextSchema } from "@workspace/video-sdk/copilot";
import { Alert, AlertAction, AlertDescription } from "@workspace/ui/components/alert";
import { Bubble, BubbleContent } from "@workspace/ui/components/bubble";
import { Button } from "@workspace/ui/components/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@workspace/ui/components/input-group";
import { Marker, MarkerContent, MarkerIcon } from "@workspace/ui/components/marker";
import { Message, MessageContent, MessageHeader } from "@workspace/ui/components/message";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@workspace/ui/components/message-scroller";
import { getToolName, isToolUIPart, validateUIMessages, type UIMessage } from "ai";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { useEditorStore } from "../editor-store";
import { getCurrentFrame } from "../playback-state";

const apiBaseUrl = z
  .url()
  .parse(import.meta.env.VITE_API_URL ?? "https://api.localhost")
  .replace(/\/$/, "");

interface CopilotConversationProps {
  chatId: string;
  initialMessages: UIMessage[];
  initialWorkflowRunId: string | null;
  historyWarning: string | null;
}

function CopilotConversation({
  chatId,
  initialMessages,
  initialWorkflowRunId,
  historyWarning,
}: CopilotConversationProps) {
  const [input, setInput] = useState("");
  const activeWorkflowRunId = useRef(initialWorkflowRunId);

  const transport = useMemo(
    () =>
      new WorkflowChatTransport<UIMessage>({
        api: `${apiBaseUrl}/api/chat`,
        prepareSendMessagesRequest({ id, messages }) {
          const latest = messages.at(-1);
          if (!latest || latest.role !== "user") {
            throw new Error("Expected the latest message to be from the user.");
          }
          const prompt = latest.parts
            .flatMap((part) => (part.type === "text" ? [part.text] : []))
            .join("\n")
            .trim();
          if (!prompt) throw new Error("Prompt cannot be empty.");

          const { project: currentProject, selectedClipId: currentSelection } =
            useEditorStore.getState();
          const editorContext = videoEditorContextSchema.parse({
            composition: currentProject.composition,
            tracks: currentProject.tracks,
            clips: currentProject.clips,
            media: currentProject.media,
            selectedClipId: currentSelection,
            playheadFrame: getCurrentFrame(),
          });
          return {
            api: `${apiBaseUrl}/api/chat/${encodeURIComponent(id)}`,
            headers: { "Content-Type": "application/json" },
            body: {
              message: prompt,
              editorContext,
            },
          };
        },
        onChatSendMessage(response) {
          const runId = response.headers.get("x-workflow-run-id");
          if (!runId) return;
          activeWorkflowRunId.current = runId;
          localStorage.setItem("officemachine-video-copilot-run", runId);
        },
        onChatEnd() {
          activeWorkflowRunId.current = null;
          localStorage.removeItem("officemachine-video-copilot-run");
          localStorage.removeItem("officemachine-video-copilot-pending-prompt");
        },
        prepareReconnectToStreamRequest() {
          const runId = activeWorkflowRunId.current;
          if (!runId) throw new Error("No active Copilot workflow to reconnect.");
          return {
            api: `${apiBaseUrl}/api/chat/${encodeURIComponent(runId)}/stream`,
          };
        },
      }),
    [],
  );

  const { messages, sendMessage, status, error, clearError } = useChat<UIMessage>({
    id: chatId,
    messages: initialMessages,
    resume: initialWorkflowRunId !== null,
    experimental_throttle: 50,
    transport,
    onError: () => {
      activeWorkflowRunId.current = null;
      localStorage.removeItem("officemachine-video-copilot-run");
      localStorage.removeItem("officemachine-video-copilot-pending-prompt");
    },
  });
  const busy = status === "submitted" || status === "streaming";

  const submitPrompt = () => {
    const prompt = input.trim();
    if (!prompt || status !== "ready") return;
    setInput("");
    localStorage.setItem("officemachine-video-copilot-pending-prompt", prompt);
    void sendMessage({ text: prompt });
  };

  return (
    <MessageScrollerProvider
      autoScroll
      scrollPreviousItemPeek={40}
      defaultScrollPosition="last-anchor"
    >
      <div className="flex h-full min-h-0 flex-col bg-card/65">
        {messages.length === 0 ? (
          <Empty className="copilot-empty min-h-0 overflow-y-auto border-0 px-4 py-4">
            <EmptyHeader className="gap-1.5">
              <EmptyMedia className="mb-0" variant="icon">
                <SparklesIcon />
              </EmptyMedia>
              <EmptyTitle className="text-sm">Build this cut together</EmptyTitle>
              <EmptyDescription className="text-xs/relaxed">
                Ask about pacing, composition, titles, or the selected clip. Your current project
                context is included with each prompt.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <MessageScroller>
            <MessageScrollerViewport className="py-4">
              <MessageScrollerContent aria-busy={busy} className="gap-5 px-3 pb-3">
                {messages.map((message, messageIndex) => (
                  <MessageScrollerItem
                    key={message.id}
                    messageId={`copilot-message-${messageIndex}`}
                    scrollAnchor={message.role === "user"}
                  >
                    <Message align={message.role === "user" ? "end" : "start"}>
                      <MessageContent>
                        <MessageHeader>{message.role === "user" ? "You" : "Copilot"}</MessageHeader>
                        {message.parts.map((part, partIndex) => {
                          if (part.type === "text") {
                            return (
                              <Bubble
                                key={partIndex}
                                variant={message.role === "user" ? "default" : "secondary"}
                              >
                                <BubbleContent className="whitespace-pre-wrap">
                                  {part.text}
                                </BubbleContent>
                              </Bubble>
                            );
                          }
                          if (part.type === "reasoning") {
                            return (
                              <Bubble key={partIndex} variant="ghost">
                                <BubbleContent className="whitespace-pre-wrap text-muted-foreground">
                                  {part.text}
                                </BubbleContent>
                              </Bubble>
                            );
                          }
                          if (part.type === "source-url") {
                            return (
                              <Bubble key={partIndex} variant="outline">
                                <BubbleContent
                                  render={
                                    <a href={part.url} target="_blank" rel="noreferrer">
                                      {part.title ?? part.url}
                                    </a>
                                  }
                                />
                              </Bubble>
                            );
                          }
                          if (isToolUIPart(part)) {
                            const pending =
                              part.state !== "output-available" &&
                              part.state !== "output-error" &&
                              part.state !== "output-denied";
                            return (
                              <Marker key={partIndex} role="status">
                                <MarkerIcon>
                                  {pending ? (
                                    <LoaderCircleIcon
                                      className="animate-spin"
                                      aria-label="Loading"
                                    />
                                  ) : (
                                    <SparklesIcon />
                                  )}
                                </MarkerIcon>
                                <MarkerContent className={pending ? "shimmer" : undefined}>
                                  {pending ? "Running" : "Ran"} {getToolName(part)}
                                </MarkerContent>
                              </Marker>
                            );
                          }
                          return (
                            <Marker key={partIndex} role="status">
                              <MarkerIcon>
                                <SparklesIcon />
                              </MarkerIcon>
                              <MarkerContent>{part.type.replaceAll("-", " ")}</MarkerContent>
                            </Marker>
                          );
                        })}
                      </MessageContent>
                    </Message>
                  </MessageScrollerItem>
                ))}
                {busy ? (
                  <Marker role="status">
                    <MarkerIcon>
                      <LoaderCircleIcon className="animate-spin" aria-label="Loading" />
                    </MarkerIcon>
                    <MarkerContent className="shimmer">Copilot is working</MarkerContent>
                  </Marker>
                ) : null}
              </MessageScrollerContent>
            </MessageScrollerViewport>
            <MessageScrollerButton>
              <ArrowDownIcon />
              <span className="sr-only">Scroll to end</span>
            </MessageScrollerButton>
          </MessageScroller>
        )}

        <div className="shrink-0 space-y-2 border-t border-border p-3">
          {historyWarning ? (
            <p className="px-1 text-[10px] text-muted-foreground">{historyWarning}</p>
          ) : null}
          {error ? (
            <Alert variant="destructive" className="py-2.5">
              <CircleAlertIcon />
              <AlertDescription className="line-clamp-2 text-xs">{error.message}</AlertDescription>
              <AlertAction>
                <Button size="xs" variant="outline" onClick={clearError}>
                  Dismiss
                </Button>
              </AlertAction>
            </Alert>
          ) : null}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              submitPrompt();
            }}
          >
            <InputGroup className="bg-input/45">
              <InputGroupTextarea
                aria-label="Message Copilot"
                className="min-h-16"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    submitPrompt();
                  }
                }}
                placeholder="Ask Copilot about this edit…"
              />
              <InputGroupAddon align="block-end" className="pt-1">
                <span className="text-[10px] font-normal">Local project context attached</span>
                <InputGroupButton
                  className="ml-auto"
                  aria-label="Send message"
                  type="submit"
                  size="icon-sm"
                  variant="default"
                  disabled={!input.trim() || status !== "ready"}
                >
                  <ArrowUpIcon />
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </form>
        </div>
      </div>
    </MessageScrollerProvider>
  );
}

export const CopilotPanel = memo(function CopilotPanel() {
  const [chatId] = useState(() => {
    const stored = z.uuid().safeParse(localStorage.getItem("officemachine-video-copilot-chat"));
    if (stored.success) return stored.data;
    const next = crypto.randomUUID();
    localStorage.setItem("officemachine-video-copilot-chat", next);
    return next;
  });
  const [initialWorkflowRunId] = useState(() => {
    const stored = z
      .string()
      .min(1)
      .safeParse(localStorage.getItem("officemachine-video-copilot-run"));
    return stored.success ? stored.data : null;
  });
  const [initialMessages, setInitialMessages] = useState<UIMessage[] | null>(null);
  const [historyWarning, setHistoryWarning] = useState<string | null>(null);

  useEffect(() => {
    if (initialWorkflowRunId) {
      const pendingPrompt = z
        .string()
        .min(1)
        .safeParse(localStorage.getItem("officemachine-video-copilot-pending-prompt"));
      setInitialMessages(
        pendingPrompt.success
          ? [
              {
                id: `resumed-${initialWorkflowRunId}`,
                role: "user",
                parts: [{ type: "text", text: pendingPrompt.data }],
              },
            ]
          : [],
      );
      return;
    }

    localStorage.removeItem("officemachine-video-copilot-pending-prompt");

    const controller = new AbortController();
    void fetch(`${apiBaseUrl}/api/chat/messages?id=${encodeURIComponent(chatId)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`History request failed with ${response.status}.`);
        const messages = z.array(z.unknown()).parse(await response.json());
        return messages.length === 0 ? [] : validateUIMessages<UIMessage>({ messages });
      })
      .then((messages) => setInitialMessages(messages))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setHistoryWarning(
          error instanceof Error
            ? `History unavailable: ${error.message}`
            : "History is unavailable until the API is running.",
        );
        setInitialMessages([]);
      });
    return () => controller.abort();
  }, [chatId, initialWorkflowRunId]);

  return (
    <aside className="flex h-full min-h-0 flex-col bg-card/65" aria-label="Copilot">
      <div className="flex h-8 shrink-0 items-center border-b border-border px-3">
        <span className="text-xs font-medium">Copilot</span>
      </div>
      <div className="min-h-0 flex-1">
        {initialMessages ? (
          <CopilotConversation
            chatId={chatId}
            initialMessages={initialMessages}
            initialWorkflowRunId={initialWorkflowRunId}
            historyWarning={historyWarning}
          />
        ) : (
          <div className="flex h-full items-center justify-center" role="status">
            <LoaderCircleIcon className="size-4 animate-spin" aria-label="Loading" />
          </div>
        )}
      </div>
    </aside>
  );
});
