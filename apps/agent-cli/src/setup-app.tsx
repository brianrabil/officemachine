import { Text, useApp } from "ink";
import { useEffect } from "react";

import { SetupFlow } from "./components/ui/setup-flow";
import { ThemeProvider } from "./components/ui/theme-provider";
import { vercelTheme } from "./lib/terminal-themes/vercel";
import { providerNames } from "./options";

export const SetupApp = ({ cwd }: { cwd: string }) => {
  const app = useApp();

  const availableProviders = providerNames.filter(
    (provider) => provider === "ollama" || Boolean(process.env.AI_GATEWAY_API_KEY),
  );

  const selectedProvider = availableProviders[0];
  if (!selectedProvider) {
    throw new Error("No providers configured.");
  }
  const providerStatus = availableProviders.includes("ai-gateway")
    ? availableProviders.join(", ")
    : "ollama; ai-gateway missing AI_GATEWAY_API_KEY";

  useEffect(() => {
    const timeout = setTimeout(() => app.exit(), 1800);
    return () => clearTimeout(timeout);
  }, [app]);

  return (
    <ThemeProvider theme={vercelTheme}>
      <SetupFlow title="setup" titleFont="slim" titleColor={vercelTheme.colors.primary}>
        <SetupFlow.Badge label="agent-cli" />
        <SetupFlow.Step status="done">Workspace: {cwd}</SetupFlow.Step>
        <SetupFlow.Step status="success">Providers: {providerStatus}</SetupFlow.Step>
        <SetupFlow.Step status="done">
          AI SDK ToolLoopAgent uses bash-tool workspace tools
        </SetupFlow.Step>

        <SetupFlow.Step status="success">
          Run{" "}
          <Text color={vercelTheme.colors.primary}>
            bun run cli -- --provider {selectedProvider}
          </Text>
        </SetupFlow.Step>
      </SetupFlow>
    </ThemeProvider>
  );
};
