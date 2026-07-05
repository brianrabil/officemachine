"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, UIMessage } from "ai";
import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowUp01Icon,
  AttachmentIcon,
  BubbleChatIcon,
  GlobeIcon,
  Image01Icon,
  PlusSignIcon,
  TelescopeIcon,
} from "@hugeicons/core-free-icons";
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
import { Message, MessageContent } from "@workspace/ui/components/message";
import { Bubble, BubbleContent } from "@workspace/ui/components/bubble";
import { Button } from "@workspace/ui/components/button";
import { Spinner } from "@workspace/ui/components/spinner";

export function Chat({
  id,
  initialMessages,
}: { id?: string | undefined; initialMessages?: UIMessage[] } = {}) {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status, error, stop, regenerate } = useChat({
    id,
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      // only send the last message to the server — the harness session
      // owns conversation memory, so replaying full history isn't needed
      prepareSendMessagesRequest({ messages, id }) {
        return { body: { message: messages[messages.length - 1], id } };
      },
    }),
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
    <MessageScrollerProvider>
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
            <MessageScrollerViewport>
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
                      <MessageContent>
                        {message.parts.map((part, partIndex) => {
                          if (part.type === "text") {
                            return (
                              <Bubble
                                key={partIndex}
                                variant={message.role === "user" ? "default" : "secondary"}
                              >
                                <BubbleContent>{part.text}</BubbleContent>
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
                          if (part.type.startsWith("tool-") || part.type === "dynamic-tool") {
                            return (
                              <Bubble key={partIndex} variant="outline">
                                <BubbleContent className="whitespace-pre-wrap font-mono text-xs">
                                  {JSON.stringify(part, null, 2)}
                                </BubbleContent>
                              </Bubble>
                            );
                          }
                          return null;
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
          <>
            <div>An error occurred.</div>
            <Button type="button" variant="outline" onClick={() => regenerate()}>
              Retry
            </Button>
          </>
        )}

        {(status === "submitted" || status === "streaming") && (
          <div>
            {status === "submitted" && <Spinner />}
            <Button type="button" variant="outline" onClick={() => stop()}>
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
