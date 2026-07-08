import { agent } from "./lib/harness.ts";

const session = await agent.createSession({ sessionId: "debug-turn-1" });
console.log("session created");

const result = await agent.stream({
  session,
  prompt: "Reply with exactly the word: pong",
});
console.log("stream started");

const reader = result.fullStream.getReader();
while (true) {
  const { value, done } = await reader.read();
  if (done) break;
  console.log(JSON.stringify(value, (_key, val) => {
    if (val instanceof Error) {
      return { name: val.name, message: val.message, stack: val.stack, cause: val.cause };
    }
    return val;
  }));
}
