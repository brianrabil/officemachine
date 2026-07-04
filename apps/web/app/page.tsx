"use client";

import { useChat } from "@ai-sdk/react";
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
    <main className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold">Harness chat test</h1>

      <div className="flex flex-col gap-3">
        {messages.map((message) => (
          <div key={message.id}>
            <strong>{message.role === "user" ? "You: " : "AI: "}</strong>
            {message.parts.map((part, index) => {
              if (part.type === "text") {
                return <span key={index}>{part.text}</span>;
              }
              if (part.type === "reasoning") {
                return (
                  <pre key={index} className="text-muted-foreground whitespace-pre-wrap">
                    {part.text}
                  </pre>
                );
              }
              if (part.type.startsWith("tool-") || part.type === "dynamic-tool") {
                return (
                  <pre key={index} className="whitespace-pre-wrap">
                    {JSON.stringify(part, null, 2)}
                  </pre>
                );
              }
              return null;
            })}
          </div>
        ))}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (input.trim()) {
            sendMessage({ text: input });
            setInput("");
          }
        }}
        className="flex gap-2"
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
    </main>
  );
}
