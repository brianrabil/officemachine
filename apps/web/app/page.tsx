"use client";

import { useChat } from "@ai-sdk/react";
import { MessageScroller } from "@shadcn/react/message-scroller";
import { DefaultChatTransport } from "ai";
import { useState } from "react";
import { Button } from "@workspace/ui/components/button";
import { Input } from "@workspace/ui/components/input";

export default function Page() {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status } = useChat({
    id: "harness-test-chat",
    transport: new DefaultChatTransport({
      api: "/api/chat",
    }),
  });

  return (
    <div className="mx-auto flex h-svh w-full max-w-2xl flex-col p-6">
      <h1 className="mb-4 text-2xl font-semibold">Harness chat test</h1>

      <MessageScroller.Provider>
        <MessageScroller.Root className="relative flex flex-1 flex-col overflow-hidden">
          <MessageScroller.Viewport className="flex flex-1 flex-col overflow-y-auto">
            <MessageScroller.Content className="flex flex-col gap-3">
              {messages.map((message, index) => (
                <MessageScroller.Item
                  key={message.id}
                  messageId={`message-${index}`}
                  scrollAnchor={message.role === "user"}
                >
                  <div>
                    <strong>{message.role === "user" ? "You: " : "AI: "}</strong>
                    {message.parts.map((part, partIndex) => {
                      if (part.type === "text") {
                        return <span key={partIndex}>{part.text}</span>;
                      }
                      if (part.type === "reasoning") {
                        return (
                          <pre
                            key={partIndex}
                            className="text-muted-foreground whitespace-pre-wrap"
                          >
                            {part.text}
                          </pre>
                        );
                      }
                      if (part.type.startsWith("tool-") || part.type === "dynamic-tool") {
                        return (
                          <pre key={partIndex} className="whitespace-pre-wrap">
                            {JSON.stringify(part, null, 2)}
                          </pre>
                        );
                      }
                      return null;
                    })}
                  </div>
                </MessageScroller.Item>
              ))}
            </MessageScroller.Content>
          </MessageScroller.Viewport>
          <MessageScroller.Button className="absolute bottom-2 left-1/2 z-10 -translate-x-1/2 rounded-full border bg-background px-3 py-1 text-sm font-medium inert:opacity-0">
            Jump to latest
          </MessageScroller.Button>
        </MessageScroller.Root>
      </MessageScroller.Provider>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (input.trim()) {
            sendMessage({ text: input });
            setInput("");
          }
        }}
        className="mt-4 flex gap-2"
      >
        <Input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          disabled={status !== "ready"}
          placeholder="Say something..."
        />
        <Button type="submit" disabled={status !== "ready"}>
          Send
        </Button>
      </form>
    </div>
  );
}
