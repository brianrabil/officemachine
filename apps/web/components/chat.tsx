"use client";

import { useChat } from "@ai-sdk/react";
import { WorkflowChatTransport } from "@ai-sdk/workflow";
import type { HarnessMessage } from "@workspace/agent/harness";
import { useMemo, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AlertCircleIcon,
  ArrowUp01Icon,
  AttachmentIcon,
  BubbleChatIcon,
  GlobeIcon,
  Image01Icon,
  PlusSignIcon,
  TelescopeIcon,
} from "@hugeicons/core-free-icons";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@workspace/ui/components/alert";
import { Avatar, AvatarFallback } from "@workspace/ui/components/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@workspace/ui/components/input-group";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty";
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@workspace/ui/components/message-scroller";
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageHeader,
} from "@workspace/ui/components/message";
import { Bubble, BubbleContent } from "@workspace/ui/components/bubble";
import { Button } from "@workspace/ui/components/button";
import { Spinner } from "@workspace/ui/components/spinner";
import { Marker, MarkerContent, MarkerIcon } from "@workspace/ui/components/marker";
import {
  FileTextIcon,
  FilePlusIcon,
  FilePenLineIcon,
  FileSearchIcon,
  FolderSearchIcon,
  FolderOpenIcon,
  GitBranchIcon,
  SearchIcon,
  TerminalIcon,
} from "lucide-react";
import Deepseek from "@thesvg/react/deepseek";

const MODEL_BRAND_ICONS: Record<string, typeof Deepseek> = {
  deepseek: Deepseek,
};

// Model ids look like "deepseek-v4-flash" — the brand is the segment before
// the version, so map on the first "-"-separated token.
function modelBrand(modelId: string | undefined): string {
  return modelId?.split("-")[0] ?? "";
}

// Every tool part is "pending" until its output lands — approval states
// never fire with this harness's allow-all permission mode, so they're
// treated as pending too rather than handled separately.
function isToolPending(state: string): boolean {
  return state !== "output-available" && state !== "output-error" && state !== "output-denied";
}

// HarnessV1BuiltinTool types every builtin tool's output as `unknown`, but
// every real tool call returns a plain string (confirmed by triggering each
// tool directly and inspecting the wire output).
function toolOutputText(output: unknown): string {
  return typeof output === "string" ? output : "";
}

function ToolMarker({
  icon: Icon,
  label,
  pending,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  pending: boolean;
}) {
  return (
    <Marker role="status">
      <MarkerIcon>
        {pending ? <Spinner className="size-4" /> : <Icon className="size-4" />}
      </MarkerIcon>
      <MarkerContent className={pending ? "shimmer" : undefined}>{label}</MarkerContent>
    </Marker>
  );
}

export function MarkerBorderDemo() {
  return (
    <div className="flex w-full max-w-sm flex-col gap-3 py-12">
      <Marker variant="border">
        <MarkerIcon>
          <GitBranchIcon />
        </MarkerIcon>
        <MarkerContent>Switched to release-candidate</MarkerContent>
      </Marker>
      <Marker variant="border">
        <MarkerIcon>
          <SearchIcon />
        </MarkerIcon>
        <MarkerContent>Reviewed 8 related files</MarkerContent>
      </Marker>
      <Marker variant="border">
        <MarkerIcon>
          <FileTextIcon />
        </MarkerIcon>
        <MarkerContent>Opened implementation notes</MarkerContent>
      </Marker>
    </div>
  );
}

export function Chat({
  id,
  initialMessages,
}: { id?: string | undefined; initialMessages?: HarnessMessage[] } = {}) {
  const [input, setInput] = useState("");
  const transport = useMemo(
    () =>
      new WorkflowChatTransport<HarnessMessage>({
        api: "/api/chat",
        prepareSendMessagesRequest({ messages, id }) {
          const latest = messages.at(-1);
          if (!latest || latest.role !== "user") {
            throw new Error("Expected the latest message to be from the user.");
          }
          const prompt = latest.parts
            .flatMap((part) => (part.type === "text" ? [part.text] : []))
            .join("\n")
            .trim();
          if (!prompt) throw new Error("Prompt cannot be empty.");

          return {
            api: `/api/chat/${encodeURIComponent(id)}`,
            headers: { "Content-Type": "application/json" },
            body: { message: prompt },
          };
        },
      }),
    [],
  );
  const { messages, sendMessage, status, error, stop, regenerate } = useChat<HarnessMessage>({
    id,
    messages: initialMessages,
    // Without this, every reasoning/text delta triggers a full re-render of
    // the message list — noticeable here given each part now runs through
    // the Marker/tool-state switch, not just plain text.
    experimental_throttle: 50,
    transport,
    onError: (error) => {
      console.error("An error occurred:", error);
    },
  });

  const handleSend = () => {
    if (input.trim()) {
      sendMessage({ text: input });
      setInput("");
    }
  };

  return (
    <MessageScrollerProvider
      autoScroll
      scrollPreviousItemPeek={64}
      defaultScrollPosition="last-anchor"
    >
      <div className="mx-auto flex h-svh w-full max-w-2xl flex-col px-6 pb-3">
        {messages.length === 0 ? (
          <Empty className="h-full">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <HugeiconsIcon icon={BubbleChatIcon} strokeWidth={2} />
              </EmptyMedia>
              <EmptyTitle>Morning, shadcn!</EmptyTitle>
              <EmptyDescription>
                What are we working on today? Press send to start a new conversation
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <MessageScroller>
            <MessageScrollerViewport className="py-16">
              <MessageScrollerContent
                aria-busy={status === "submitted" || status === "streaming"}
                className="p-(--card-spacing)"
              >
                {messages.map((message, index) => (
                  <MessageScrollerItem
                    key={message.id}
                    messageId={`message-${index}`}
                    scrollAnchor={message.role === "user"}
                  >
                    <Message align={message.role === "user" ? "end" : "start"}>
                      {message.role === "assistant" &&
                        (() => {
                          const ProviderIcon =
                            MODEL_BRAND_ICONS[modelBrand(message.metadata?.modelId)];
                          return (
                            <MessageAvatar>
                              <Avatar>
                                {ProviderIcon ? (
                                  <AvatarFallback>
                                    <ProviderIcon className="size-4" />
                                  </AvatarFallback>
                                ) : (
                                  <AvatarFallback>R</AvatarFallback>
                                )}
                              </Avatar>
                            </MessageAvatar>
                          );
                        })()}
                      <MessageContent>
                        {message.role === "user" && <MessageHeader>User</MessageHeader>}
                        {message.role === "assistant" && (
                          <MessageHeader>{message.metadata?.modelId}</MessageHeader>
                        )}
                        {message.parts.map((part, partIndex) => {
                          switch (part.type) {
                            case "text":
                              return (
                                <Bubble
                                  key={partIndex}
                                  variant={message.role === "user" ? "default" : "secondary"}
                                >
                                  <BubbleContent>{part.text}</BubbleContent>
                                </Bubble>
                              );

                            case "reasoning":
                              return (
                                <Bubble key={partIndex} variant="ghost">
                                  <BubbleContent className="whitespace-pre-wrap text-muted-foreground">
                                    {part.text}
                                  </BubbleContent>
                                </Bubble>
                              );

                            case "tool-read": {
                              const pending = isToolPending(part.state);
                              const path = part.input?.file_path ?? "file";
                              const output = toolOutputText(part.output);
                              const label = pending
                                ? `Reading ${path}`
                                : part.state === "output-available"
                                  ? output.startsWith("Path not found")
                                    ? output
                                    : `Read ${path}`
                                  : `Failed to read ${path}`;
                              return (
                                <ToolMarker
                                  key={partIndex}
                                  icon={FileTextIcon}
                                  label={label}
                                  pending={pending}
                                />
                              );
                            }

                            case "tool-write": {
                              const pending = isToolPending(part.state);
                              const path = part.input?.file_path ?? "file";
                              const label = pending
                                ? `Writing ${path}`
                                : part.state === "output-available"
                                  ? toolOutputText(part.output)
                                  : `Failed to write ${path}`;
                              return (
                                <ToolMarker
                                  key={partIndex}
                                  icon={FilePlusIcon}
                                  label={label}
                                  pending={pending}
                                />
                              );
                            }

                            case "tool-edit": {
                              const pending = isToolPending(part.state);
                              const path = part.input?.file_path ?? "file";
                              const label = pending
                                ? `Editing ${path}`
                                : part.state === "output-available"
                                  ? toolOutputText(part.output)
                                  : `Failed to edit ${path}`;
                              return (
                                <ToolMarker
                                  key={partIndex}
                                  icon={FilePenLineIcon}
                                  label={label}
                                  pending={pending}
                                />
                              );
                            }

                            case "tool-bash": {
                              const pending = isToolPending(part.state);
                              const command = part.input?.command ?? "command";
                              const output = toolOutputText(part.output);
                              const label = pending
                                ? `Running ${command}`
                                : part.state === "output-available"
                                  ? /\(exit (?!0\))\d+\)\s*$/.test(output)
                                    ? `${command} — ${output.match(/\(exit \d+\)\s*$/)?.[0]}`
                                    : command
                                  : `Failed to run ${command}`;
                              return (
                                <ToolMarker
                                  key={partIndex}
                                  icon={TerminalIcon}
                                  label={label}
                                  pending={pending}
                                />
                              );
                            }

                            case "tool-grep": {
                              const pending = isToolPending(part.state);
                              const pattern = part.input?.pattern ?? "";
                              const searchLocation = part.input?.path
                                ? ` in ${part.input.path}`
                                : "";
                              const label = pending
                                ? `Searching for "${pattern}"${searchLocation}`
                                : part.state === "output-available"
                                  ? toolOutputText(part.output) === "No matches found"
                                    ? `No matches for "${pattern}"${searchLocation}`
                                    : `Found matches for "${pattern}"${searchLocation}`
                                  : `Search failed for "${pattern}"`;
                              return (
                                <ToolMarker
                                  key={partIndex}
                                  icon={FileSearchIcon}
                                  label={label}
                                  pending={pending}
                                />
                              );
                            }

                            case "tool-glob": {
                              const pending = isToolPending(part.state);
                              const pattern = part.input?.pattern ?? "files";
                              const label = pending
                                ? `Finding ${pattern}`
                                : part.state === "output-available"
                                  ? (() => {
                                      const output = toolOutputText(part.output).trim();
                                      const count = output ? output.split("\n").length : 0;
                                      return count > 0
                                        ? `Found ${count} file${count === 1 ? "" : "s"} matching ${pattern}`
                                        : `No files matching ${pattern}`;
                                    })()
                                  : `Failed to find ${pattern}`;
                              return (
                                <ToolMarker
                                  key={partIndex}
                                  icon={FolderSearchIcon}
                                  label={label}
                                  pending={pending}
                                />
                              );
                            }

                            case "tool-ls": {
                              const pending = isToolPending(part.state);
                              // The type says `ls` takes no input, but it
                              // accepts an optional path at runtime.
                              const path =
                                (part.input as { path?: string } | undefined)?.path ?? "directory";
                              const label = pending ? "Listing directory" : `Listed ${path}`;
                              return (
                                <ToolMarker
                                  key={partIndex}
                                  icon={FolderOpenIcon}
                                  label={label}
                                  pending={pending}
                                />
                              );
                            }

                            case "dynamic-tool": {
                              if (part.toolName !== "fileChange") return null;
                              const pending = isToolPending(part.state);
                              // "fileChange" isn't one of our declared tools, so its
                              // input isn't statically typed — shape confirmed empirically.
                              const fileChangeInput = part.input as
                                | { event?: "create" | "modify"; path?: string }
                                | undefined;
                              const path = fileChangeInput?.path ?? "file";
                              const isCreate = fileChangeInput?.event === "create";
                              const label = pending
                                ? `Updating ${path}`
                                : isCreate
                                  ? `Created ${path}`
                                  : `Modified ${path}`;
                              return (
                                <ToolMarker
                                  key={partIndex}
                                  icon={isCreate ? FilePlusIcon : FilePenLineIcon}
                                  label={label}
                                  pending={pending}
                                />
                              );
                            }

                            default:
                              return null;
                          }
                        })}
                      </MessageContent>
                    </Message>
                  </MessageScrollerItem>
                ))}
              </MessageScrollerContent>
            </MessageScrollerViewport>
            <MessageScrollerButton />
          </MessageScroller>
        )}

        {error && (
          <Alert variant="destructive" className="max-w-xl mb-4 mx-auto">
            <HugeiconsIcon icon={AlertCircleIcon} strokeWidth={2} />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription className="line-clamp-3">{error.message}</AlertDescription>
            <AlertAction>
              <Button type="button" variant="outline" onClick={() => regenerate()}>
                Retry
              </Button>
            </AlertAction>
          </Alert>
        )}

        {(status === "submitted" || status === "streaming") && (
          <div className="mb-4 mx-auto">
            <Button type="button" variant="outline" onClick={() => stop()}>
              {status === "submitted" && <Spinner />}
              Stop
            </Button>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="w-full"
        >
          <InputGroup>
            <InputGroupTextarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  handleSend();
                }
              }}
              disabled={error != null}
              placeholder="Ask anything, @ to mention, / for actions"
            />
            <InputGroupAddon align="block-end" className="pt-1">
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <InputGroupButton
                      aria-label="Add files"
                      type="button"
                      size="icon-sm"
                      variant="outline"
                    >
                      <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} />
                    </InputGroupButton>
                  }
                />
                <DropdownMenuContent align="start" side="top" className="w-44">
                  <DropdownMenuItem>
                    <HugeiconsIcon icon={AttachmentIcon} strokeWidth={2} />
                    Add Photos & Files
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <HugeiconsIcon icon={Image01Icon} strokeWidth={2} />
                    Create Image
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <HugeiconsIcon icon={TelescopeIcon} strokeWidth={2} />
                    Deep Research
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <HugeiconsIcon icon={GlobeIcon} strokeWidth={2} />
                    Web Search
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <InputGroupButton
                variant="default"
                type="submit"
                size="icon-sm"
                disabled={status !== "ready"}
                className="ml-auto"
              >
                <HugeiconsIcon icon={ArrowUp01Icon} strokeWidth={2} />
                <span className="sr-only">Send</span>
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </form>
      </div>
    </MessageScrollerProvider>
  );
}
