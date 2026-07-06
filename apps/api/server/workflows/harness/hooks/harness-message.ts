import { defineHook } from "workflow";
import type { HarnessMessage } from "@workspace/agent/agent";

// Deterministic token (chat:<chatId>) so the API route can resume the right
// in-progress conversation without tracking Vercel's own workflow run id.
export const harnessMessageHook = defineHook<{ message: HarnessMessage } | { end: true }>();

export const harnessHookToken = (chatId: string) => `chat:${chatId}`;
