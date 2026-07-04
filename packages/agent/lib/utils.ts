import type { convertToModelMessages } from "ai";

export function latestUserMessage(messages: Awaited<ReturnType<typeof convertToModelMessages>>) {
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index];
    if (message?.role === "user") return message;
  }
}
