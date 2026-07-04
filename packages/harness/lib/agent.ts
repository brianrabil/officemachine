import { HarnessAgent } from '@ai-sdk/harness/agent';
import { codex } from '@ai-sdk/harness-codex';
import { createVercelSandbox } from '@ai-sdk/sandbox-vercel';

export const agent = new HarnessAgent({
  harness: codex,
  sandbox: createVercelSandbox({
    runtime: 'node24',
    ports: [4000],
  }),
});
