import { useApp } from "ink";
import { useEffect } from "react";

import { HelpScreen } from "./components/ui/help-screen";
import { ThemeProvider } from "./components/ui/theme-provider";
import { vercelTheme } from "./lib/terminal-themes/vercel";

export const HelpApp = () => {
  const app = useApp();

  useEffect(() => {
    app.exit();
  }, [app]);

  return (
    <ThemeProvider theme={vercelTheme}>
      <HelpScreen
        description="Runs an AI SDK ToolLoopAgent in a TermCN terminal interface."
        font="slim"
        tagline="ToolLoopAgent CLI"
        title="agent-cli"
        usage="bun run cli -- [options]"
      >
        <HelpScreen.Section label="Commands">
          <HelpScreen.Row flag="/exit" description="Close the interactive session" />
          <HelpScreen.Row flag="exit" description="Close the interactive session" />
        </HelpScreen.Section>

        <HelpScreen.Section label="Options">
          <HelpScreen.Row flag="--provider <ai-gateway|ollama>" description="Model provider" />
          <HelpScreen.Row flag="--model <id>" description="Provider model id" />
          <HelpScreen.Row flag="--cwd <path>" description="Workspace directory" />
          <HelpScreen.Row flag="--max-steps <count>" description="Maximum ToolLoopAgent steps" />
          <HelpScreen.Row flag="--skills-dir <path>" description="bash-tool skills directory" />
          <HelpScreen.Row flag="--setup" description="Open the TermCN setup flow" />
          <HelpScreen.Row flag="-h, --help" description="Show this help screen" />
        </HelpScreen.Section>
      </HelpScreen>
    </ThemeProvider>
  );
};
