import { handleCors } from "h3";
import { defineMiddleware } from "nitro";

export default defineMiddleware((event) => {
  if (!event.url.pathname.startsWith("/api/chat")) return undefined;

  const response = handleCors(event, {
    origin: ["zero://app", "null", "http://127.0.0.1:5173"],
    methods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type"],
    exposeHeaders: ["x-workflow-run-id", "x-workflow-stream-tail-index"],
    maxAge: "600",
  });
  if (response !== false) return response;
  return undefined;
});
