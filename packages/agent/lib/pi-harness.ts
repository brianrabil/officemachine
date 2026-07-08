import { createPi } from "@ai-sdk/harness-pi";
import { env } from "@workspace/config/env";
import { settings } from "@workspace/config/settings";

export const pi = createPi({
  model: `${settings.defaultProvider}/${settings.defaultModel}`,
  auth: {
    customEnv: {
      OPENCODE_API_KEY: env.OPENCODE_API_KEY!,
      OPENCODE_BASE_URL: env.OPENCODE_BASE_URL,
    },
  },
  thinkingLevel: "high",
});
